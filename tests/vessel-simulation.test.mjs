import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVesselSimulation } from '../src/lib/vessel/simulation.ts';
import {
  WAYPOINT,
  INITIAL_CENTER,
  destinationFrom,
} from '../src/lib/vessel/navigation.ts';
import { createMissionDraft, distanceNm } from '../src/lib/vessel/mission.ts';

function setup() {
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
  });
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
  simulation.setVisible(true);
  simulation.setPlaying(true);
  assert.equal(callbacks.size, 0);
  const draft = plan();
  assert.equal(simulation.deploy(draft), true);
  assert.deepEqual(simulation.getFrame().position, INITIAL_CENTER);
  assert.deepEqual(simulation.getFrame().nextWaypoint, WAYPOINT);
  assert.equal(simulation.getFrame().phase, 'transit');
  assert.equal(simulation.getFrame().speed, 12);
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
  ]) {
    assert.equal(simulation.deploy(draft), false);
    assert.equal(simulation.getFrame(), before);
    assert.equal(callbacks.size, 0);
  }
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
  assert.ok(Math.abs(simulation.getFrame().distance - 1 / 3) < 1e-9);
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
    Math.abs(simulation.getFrame().distance - paused - (12 * 10 * 0.1) / 3600) <
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
  assert.ok(speeds.has(6) && speeds.has(2) && speeds.has(0));
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
  assert.ok(Math.abs(simulation.getFrame().distance - 0.04) < 1e-9);
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
