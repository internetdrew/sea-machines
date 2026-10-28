import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVesselSimulation } from '../src/lib/vessel/simulation.ts';
import {
  WAYPOINT,
  INITIAL_CENTER,
  destinationFrom,
} from '../src/lib/vessel/navigation.ts';
import { createMissionDraft, distanceNm, missionSpeedError, canReviewMission } from '../src/lib/vessel/mission.ts';
import { DEMO_PROPULSION } from '../src/lib/vessel/propulsion.ts';

function setup(propulsion) {
  let time = 0,
    nextId = 0;
  const callbacks = new Map();
  const simulation = createVesselSimulation({
    now: () => time,
    request: callback => {
      callbacks.set(++nextId, callback);
      return nextId;
    },
    cancel: id => callbacks.delete(id),
  }, propulsion);
  return {
    simulation,
    callbacks,
    step(ms = 1000 / 60) {
      time += ms;
      const scheduled = [...callbacks.values()];
      callbacks.clear();
      for (const callback of scheduled) callback(time);
    },
  };
}
const plan = (points = [WAYPOINT], speed = 12, turnSpeed = 4) => ({
  ...createMissionDraft(speed),
  origin: [...INITIAL_CENTER],
  waypoints: points,
  turnSpeed,
});

test('idle vessels have no demo target and deploy without teleporting', () => {
  const { simulation, callbacks } = setup();
  assert.equal(simulation.getFrame().speed, 0);
  assert.equal(simulation.getFrame().nextWaypoint, null);
  assert.equal(simulation.getFrame().phase, 'idle');
  assert.equal(simulation.getFrame().multiplier, 1);
  assert.equal(simulation.getFrame().cruiseSpeed, 27);
  assert.equal(simulation.maxSpeed, 40);
  simulation.setVisible(true);
  simulation.setPlaying(true);
  assert.equal(callbacks.size, 0);
  const draft = plan();
  assert.equal(simulation.deploy(draft), true);
  assert.deepEqual(simulation.getFrame().position, INITIAL_CENTER);
  assert.deepEqual(simulation.getFrame().nextWaypoint, WAYPOINT);
  assert.equal(simulation.getFrame().phase, 'transit');
  assert.equal(simulation.getFrame().speed, 0);
  assert.equal(callbacks.size, 1);
  draft.waypoints[0] = [0, 0];
  assert.deepEqual(
    simulation.getFrame().mission.targets[0],
    WAYPOINT,
    'deployed geometry is independent of its draft',
  );
  const current = simulation.getFrame();
  assert.equal(
    simulation.deploy(plan()),
    false,
    'a running mission cannot be silently replaced',
  );
  assert.equal(simulation.getFrame(), current);
});

test('invalid missions do not start the clock or change vessel state', () => {
  const { simulation, callbacks } = setup();
  simulation.setVisible(true);
  const before = simulation.getFrame();
  for (const draft of [
    plan([]),
    plan([[NaN, 0]]),
    plan([[0, 91]]),
    plan([WAYPOINT], 0),
    plan([WAYPOINT], 12, 13),
    plan([WAYPOINT], 41),
  ]) {
    assert.equal(simulation.deploy(draft), false);
    assert.equal(simulation.getFrame(), before);
    assert.equal(callbacks.size, 0);
  }
});

test('speed builds from rest, brakes before arrival, and changes continuously', () => {
  const { simulation, step } = setup();
  const destination = destinationFrom(INITIAL_CENTER, 0, 200 / 1852);
  simulation.setVisible(true);
  simulation.deploy(plan([destination], 12));
  let previous = simulation.getFrame();
  let reachedCruise = false, braked = false;
  for (let i = 0; i < 1200 && previous.playing; i++) {
    step(100);
    const current = simulation.getFrame();
    assert.ok(Number.isFinite(current.speed));
    assert.ok(current.distance >= previous.distance && current.distance <= 200 / 1852 + 1e-8);
    assert.ok(current.speed - previous.speed <= 0.240001);
    assert.ok(previous.speed - current.speed <= 0.080001);
    if (current.speed === 12) reachedCruise = true;
    if (current.playing && current.speed < previous.speed) braked = true;
    if (i === 9) {
      assert.ok(current.speed > 0 && current.speed < 2.4, 'throttle builds instead of applying full thrust immediately');
      assert.ok(current.distance > 0 && current.distance < 1.2 / 3600);
    }
    previous = current;
  }
  assert.ok(reachedCruise && braked);
  assert.equal(previous.arrived, true);
  assert.equal(previous.speed, 0);
  assert.deepEqual(previous.position, destination);
});

test('lowering cruise speed brakes gradually and pause preserves the simulated velocity', () => {
  const { simulation, step } = setup();
  simulation.setVisible(true);
  simulation.deploy(plan());
  for (let i = 0; i < 100; i++) step(250);
  assert.equal(simulation.getFrame().speed, 12);
  simulation.setSpeed(4);
  assert.equal(simulation.getFrame().speed, 12);
  step(250);
  const speed = simulation.getFrame().speed;
  assert.ok(Math.abs(speed - 11.8) < 1e-8);
  const position = simulation.getFrame().position;
  simulation.setPlaying(false);
  step(60000);
  assert.deepEqual(simulation.getFrame().position, position);
  simulation.setPlaying(true);
  assert.equal(simulation.getFrame().speed, speed);
  for (let i = 0; i < 50; i++) step(250);
  assert.ok(Math.abs(simulation.getFrame().speed - 4) < 1e-8);
});

test('short legs brake without reaching cruise and playback rate uses simulated time', () => {
  const target = destinationFrom(INITIAL_CENTER, 90, 5 / 1852);
  const slow = setup(), fast = setup();
  for (const run of [slow, fast]) {
    run.simulation.setVisible(true);
    run.simulation.deploy(plan([target], 12));
  }
  fast.simulation.setMultiplier(10);
  for (let i = 0; i < 10; i++) slow.step(100);
  fast.step(100);
  assert.ok(Math.abs(slow.simulation.getFrame().distance - fast.simulation.getFrame().distance) < 1e-9);
  assert.ok(Math.abs(slow.simulation.getFrame().speed - fast.simulation.getFrame().speed) < 1e-9);
  let peak = 0;
  for (let i = 0; i < 1000 && slow.simulation.getFrame().playing; i++) {
    slow.step(100);
    peak = Math.max(peak, slow.simulation.getFrame().speed);
  }
  assert.ok(peak > 0 && peak < 12);
  assert.equal(slow.simulation.getFrame().arrived, true);
  assert.deepEqual(slow.simulation.getFrame().position, target);
});

test('propulsion builds throttle, pushes harder at low speed, and tapers at high speed', () => {
  const { simulation, step } = setup();
  simulation.setVisible(true);
  const target = destinationFrom(INITIAL_CENTER, 0, 10);
  simulation.deploy(plan([target], 40));
  const times = new Map();
  let lowPush = 0, highPush = 0, previous = 0;
  for (let i = 1; i <= 1000; i++) {
    step(100);
    const speed = simulation.getFrame().speed;
    for (const threshold of [5, 12, 20, 39]) {
      if (speed >= threshold && !times.has(threshold)) times.set(threshold, i / 10);
    }
    if (previous >= 5 && previous <= 10) lowPush = Math.max(lowPush, speed - previous);
    if (previous >= 35) highPush = Math.max(highPush, speed - previous);
    assert.ok(speed <= simulation.maxSpeed);
    previous = speed;
  }
  assert.ok(times.get(5) > 2 && times.get(5) < 5);
  assert.ok(times.get(12) > times.get(5) && times.get(12) < 10);
  assert.ok(times.get(20) > times.get(12) + 3);
  assert.ok(times.get(39) > times.get(20) + 20);
  assert.ok(lowPush > highPush * 2);
});

test('a vessel profile limits mission requests and live speed commands independently', () => {
  const { simulation, step } = setup({ ...DEMO_PROPULSION, maxSpeed: 20 });
  simulation.setVisible(true);
  assert.equal(simulation.maxSpeed, 20);
  assert.equal(simulation.deploy(plan([WAYPOINT], 21)), false);
  assert.equal(simulation.getFrame().mission, null);
  assert.equal(simulation.deploy(plan([destinationFrom(INITIAL_CENTER, 0, 10)], 12)), true);
  simulation.setSpeed(200);
  assert.equal(simulation.getFrame().cruiseSpeed, 20);
  assert.equal(simulation.getFrame().speed, 0);
  for (let i = 0; i < 1000; i++) {
    step(100);
    assert.ok(simulation.getFrame().speed <= 20);
  }
  assert.ok(simulation.getFrame().speed > 19);
});

test('different vessels supply their own draft defaults and planning limits', () => {
  const small = setup({ ...DEMO_PROPULSION, cruiseSpeed: 8, maxSpeed: 16 });
  const fast = setup({ ...DEMO_PROPULSION, cruiseSpeed: 32, maxSpeed: 55 });
  assert.equal(small.simulation.getSnapshot().cruiseSpeed, 8);
  assert.equal(fast.simulation.getSnapshot().cruiseSpeed, 32);
  const draft = plan([WAYPOINT], 45);
  assert.ok(missionSpeedError(draft, small.simulation.maxSpeed));
  assert.equal(canReviewMission(draft, small.simulation.maxSpeed), false);
  assert.equal(small.simulation.deploy(draft), false);
  assert.equal(missionSpeedError(draft, fast.simulation.maxSpeed), null);
  assert.equal(canReviewMission(draft, fast.simulation.maxSpeed), true);
  assert.equal(fast.simulation.deploy(draft), true);
  small.simulation.setSpeed(100);
  fast.simulation.setSpeed(100);
  assert.equal(small.simulation.getFrame().cruiseSpeed, 16);
  assert.equal(fast.simulation.getFrame().cruiseSpeed, 55);
});

test('arrival cuts thrust to coast before applying the stronger active brake', () => {
  const { simulation, step } = setup();
  simulation.setVisible(true);
  simulation.deploy(plan([destinationFrom(INITIAL_CENTER, 0, 200 / 1852)], 12));
  let previous = simulation.getFrame();
  let coasted = false, activelyBraked = false;
  for (let i = 0; i < 1000 && previous.playing; i++) {
    step(100);
    const frame = simulation.getFrame();
    const drop = previous.speed - frame.speed;
    if (frame.speed > 5 && drop > 0.0001 && drop < 0.07) coasted = true;
    if (drop > 0.079 && frame.playing) activelyBraked = true;
    previous = frame;
  }
  assert.ok(coasted && activelyBraked);
  assert.equal(previous.arrived, true);
});

test('one frame clock drives movement; React snapshots remain throttled', () => {
  const { simulation, callbacks, step } = setup();
  let frames = 0,
    snapshots = 0;
  simulation.subscribeFrames(() => frames++);
  simulation.subscribe(() => snapshots++);
  simulation.setVisible(true);
  simulation.setMultiplier(10);
  simulation.deploy(plan());
  const baselineFrames = frames,
    baselineSnapshots = snapshots;
  const firstSnapshot = simulation.getSnapshot();
  step();
  assert.equal(simulation.getSnapshot(), firstSnapshot);
  for (let i = 1; i < 600; i++) step();
  assert.equal(frames - baselineFrames, 600);
  assert.ok(snapshots - baselineSnapshots <= 40);
  assert.ok(simulation.getFrame().distance > 0.3 && simulation.getFrame().distance < 1 / 3, 'startup covers less distance than instant cruise');
  assert.equal(callbacks.size, 1);
  assert.ok(simulation.getFrame().track.length < 40);
});

test('pause, visibility, and reset stop scheduling without catch-up movement', () => {
  const { simulation, callbacks, step } = setup();
  simulation.setVisible(true);
  simulation.setMultiplier(10);
  simulation.deploy(plan());
  step(100);
  simulation.setPlaying(false);
  const paused = simulation.getFrame().distance;
  const control = setup();
  control.simulation.setVisible(true);
  control.simulation.setMultiplier(10);
  control.simulation.deploy(plan());
  control.step(100);
  control.step(100);
  assert.equal(simulation.getFrame().speed, 0);
  assert.equal(callbacks.size, 0);
  step(60000);
  assert.equal(simulation.getFrame().distance, paused);
  simulation.setPlaying(true);
  simulation.setVisible(false);
  assert.equal(callbacks.size, 0);
  step(60000);
  simulation.setVisible(true);
  step(100);
  assert.ok(
    Math.abs(simulation.getFrame().distance - control.simulation.getFrame().distance) <
      1e-9,
  );
  simulation.reset();
  assert.equal(callbacks.size, 0);
  assert.equal(simulation.getSnapshot().distance, 0);
  assert.equal(simulation.getSnapshot().playing, false);
  assert.equal(simulation.getSnapshot().mission, null);
  assert.deepEqual(simulation.getFrame().track, [INITIAL_CENTER]);
});

test('all waypoints are visited in order, with turn-speed zones and exact arrival', () => {
  const { simulation, callbacks, step } = setup();
  const first = destinationFrom(INITIAL_CENTER, 0, 20 / 1852);
  const second = destinationFrom(first, 90, 20 / 1852);
  const last = destinationFrom(second, 180, 20 / 1852);
  const points = [first, second, last];
  simulation.setVisible(true);
  simulation.deploy(plan(points, 6, 2));
  const phases = new Set(),
    speeds = new Set(),
    targets = new Set();
  for (let i = 0; i < 1500 && simulation.getFrame().playing; i++) {
    step(100);
    const frame = simulation.getFrame();
    phases.add(frame.phase);
    speeds.add(frame.speed);
    targets.add(frame.targetIndex);
    if (frame.nextWaypoint) {
      assert.deepEqual(frame.nextWaypoint, points[frame.targetIndex]);
      const from = frame.targetIndex
        ? points[frame.targetIndex - 1]
        : INITIAL_CENTER;
      assert.ok(
        Math.abs(
          distanceNm(from, frame.position) +
            distanceNm(frame.position, frame.nextWaypoint) -
            distanceNm(from, frame.nextWaypoint),
        ) < 1e-7,
        'position stays on the active leg',
      );
    }
  }
  const frame = simulation.getFrame();
  assert.ok(
    phases.has('transit') && phases.has('mission') && phases.has('complete'),
  );
  assert.ok(Math.max(...speeds) <= 6);
  assert.ok([...speeds].some(speed => Math.abs(speed - 2) < 0.01) && speeds.has(0));
  assert.deepEqual([...targets].sort(), [0, 1, 2, 3]);
  assert.deepEqual(frame.position, last);
  assert.equal(frame.remaining, 0);
  assert.equal(frame.routeRemaining, 0);
  assert.equal(frame.arrived, true);
  assert.equal(frame.nextWaypoint, null);
  assert.equal(callbacks.size, 0);
  let index = 0;
  for (const point of frame.track)
    if (index < points.length && distanceNm(point, points[index]) < 1e-9)
      index++;
  assert.equal(index, points.length, 'history preserves every corner in order');
});

test('short grid legs retain elapsed time and a second deployment starts at the live position', () => {
  const { simulation, callbacks, step } = setup();
  const center = destinationFrom(INITIAL_CENTER, 90, 50 / 1852);
  const draft = {
    ...createMissionDraft(8),
    type: 'grid',
    grid: {
      center,
      origin: [0, 0],
      width: 20,
      height: 20,
      heading: 45,
      spacing: 10,
    },
  };
  simulation.setVisible(true);
  simulation.setMultiplier(3600);
  assert.equal(simulation.deploy(draft), true);
  const deployed = simulation.getFrame().mission;
  assert.deepEqual(
    deployed.origin,
    INITIAL_CENTER,
    'stale planning origin cannot teleport the vessel',
  );
  assert.ok(
    distanceNm(INITIAL_CENTER, deployed.targets[0]) <=
      distanceNm(INITIAL_CENTER, deployed.targets.at(-1)),
  );
  step(250);
  assert.equal(
    simulation.getFrame().arrived,
    true,
    'one tick can traverse several short passes',
  );
  assert.deepEqual(simulation.getFrame().position, deployed.targets.at(-1));
  assert.equal(
    simulation.getFrame().distance,
    simulation
      .getFrame()
      .mission.coordinates.slice(1)
      .reduce(
        (sum, point, i) => sum + distanceNm(deployed.coordinates[i], point),
        0,
      ),
  );
  let index = 0;
  for (const point of simulation.getFrame().track)
    if (
      index < deployed.targets.length &&
      distanceNm(point, deployed.targets[index]) < 1e-9
    )
      index++;
  assert.equal(index, deployed.targets.length);
  const position = [...simulation.getFrame().position];
  const nextTarget = destinationFrom(position, 180, 10 / 1852);
  assert.equal(simulation.deploy(plan([nextTarget])), true);
  assert.deepEqual(simulation.getFrame().position, position);
  assert.deepEqual(simulation.getFrame().mission.origin, position);
  assert.deepEqual(simulation.getFrame().nextWaypoint, nextTarget);
  step(250);
  assert.deepEqual(simulation.getFrame().position, nextTarget);
  assert.equal(callbacks.size, 0);
});

test('starting at a route point skips its zero-length leg and cannot replay a completed mission', () => {
  const { simulation, callbacks, step } = setup();
  const last = destinationFrom(INITIAL_CENTER, 90, 10 / 1852);
  simulation.setVisible(true);
  simulation.setMultiplier(3600);
  assert.equal(
    simulation.deploy(plan([INITIAL_CENTER, INITIAL_CENTER, last])),
    true,
  );
  assert.equal(simulation.getFrame().targetIndex, 1);
  assert.equal(simulation.getFrame().phase, 'mission');
  step(250);
  assert.deepEqual(simulation.getFrame().position, last);
  simulation.setPlaying(true);
  assert.equal(simulation.getFrame().playing, false);
  assert.equal(callbacks.size, 0);
});

test('speed commands preserve the clock and reset permits a fresh deployment', () => {
  const { simulation, callbacks, step } = setup();
  simulation.setVisible(true);
  simulation.deploy(plan());
  const pending = [...callbacks.keys()];
  simulation.setSpeed(24);
  simulation.setMultiplier(60);
  assert.deepEqual([...callbacks.keys()], pending);
  step(100);
  assert.ok(simulation.getFrame().distance > 0 && simulation.getFrame().distance < 0.04);
  assert.ok(simulation.getFrame().speed > 0 && simulation.getFrame().speed < 24);
  for (let i = 0; i < 100; i++) step(100);
  const frame = simulation.getFrame();
  assert.ok(Math.abs(frame.distance - 2) < 1e-9);
  assert.equal(frame.remaining, 0);
  assert.equal(frame.playing, false);
  assert.deepEqual(frame.position, WAYPOINT);
  assert.deepEqual(frame.track.at(-1), WAYPOINT);
  assert.equal(callbacks.size, 0);
  simulation.reset();
  assert.equal(simulation.deploy(plan()), true);
  assert.equal(callbacks.size, 1);
});

test('unsubscribing removes frame and UI listeners', () => {
  const { simulation, step } = setup();
  let calls = 0;
  const offFrame = simulation.subscribeFrames(() => calls++);
  const offUI = simulation.subscribe(() => calls++);
  offFrame();
  offUI();
  simulation.setVisible(true);
  simulation.deploy(plan());
  step(250);
  assert.equal(calls, 0);
});

test('abort stops at the current position, clears execution, and cannot resume', () => {
  const { simulation, callbacks, step } = setup();
  simulation.setVisible(true);
  simulation.deploy(plan());
  step(100);
  const before = simulation.getFrame();
  assert.equal(simulation.abort(), true);
  const aborted = simulation.getFrame();
  assert.deepEqual(aborted.position, before.position);
  assert.equal(aborted.heading, before.heading);
  assert.equal(aborted.distance, before.distance);
  assert.equal(aborted.phase, 'aborted');
  assert.equal(aborted.arrived, false);
  assert.equal(aborted.speed, 0);
  assert.equal(aborted.nextWaypoint, null);
  assert.equal(aborted.routeRemaining, 0);
  assert.equal(callbacks.size, 0);
  simulation.setPlaying(true);
  step(60000);
  assert.deepEqual(simulation.getFrame().position, before.position);
  assert.equal(simulation.getFrame().playing, false);
  assert.equal(simulation.abort(), false);
  assert.equal(simulation.clearFinishedMission(), true);
  assert.equal(simulation.getFrame().mission, null);
  assert.deepEqual(simulation.getFrame().position, before.position);
  assert.equal(simulation.deploy(plan()), true);
  assert.deepEqual(simulation.getFrame().mission.origin, before.position);
});

test('paused survey missions abort without changing the stop location', () => {
  const { simulation, callbacks, step } = setup();
  const draft = {
    ...createMissionDraft(12),
    type: 'grid',
    grid: {
      center: destinationFrom(INITIAL_CENTER, 90, 50 / 1852),
      origin: INITIAL_CENTER,
      width: 20,
      height: 20,
      spacing: 10,
      heading: 0,
    },
  };
  simulation.setVisible(true);
  simulation.deploy(draft);
  step(250);
  assert.equal(
    simulation.clearFinishedMission(),
    false,
    'running missions cannot be discarded as completed',
  );
  simulation.setPlaying(false);
  const paused = simulation.getFrame();
  assert.equal(simulation.abort(), true);
  assert.deepEqual(simulation.getFrame().position, paused.position);
  assert.equal(simulation.getFrame().phase, 'aborted');
  assert.equal(callbacks.size, 0);
  assert.equal(
    simulation.deploy(draft),
    true,
    'new deployment is allowed after abort',
  );
  assert.deepEqual(simulation.getFrame().mission.origin, paused.position);
});
