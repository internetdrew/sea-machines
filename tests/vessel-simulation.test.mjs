import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createVesselSimulation } from '../src/lib/vessel/simulation.ts';
import { WAYPOINT, INITIAL_CENTER } from '../src/lib/vessel/navigation.ts';

function setup() {
  let time = 0, nextId = 0;
  const callbacks = new Map();
  const simulation = createVesselSimulation({
    now: () => time,
    request: callback => { callbacks.set(++nextId, callback); return nextId; },
    cancel: id => callbacks.delete(id),
  });
  return {
    simulation, callbacks,
    step(ms = 1000 / 60) {
      time += ms;
      const scheduled = [...callbacks.values()];
      callbacks.clear();
      for (const callback of scheduled) callback(time);
    },
  };
}

test('one frame clock drives movement; React snapshots remain throttled', () => {
  const { simulation, callbacks, step } = setup();
  let frames = 0, snapshots = 0;
  simulation.subscribeFrames(() => frames++);
  simulation.subscribe(() => snapshots++);
  simulation.setVisible(true);
  simulation.setPlaying(true);
  const baselineFrames = frames, baselineSnapshots = snapshots;
  const firstSnapshot = simulation.getSnapshot();
  step();
  assert.equal(simulation.getSnapshot(), firstSnapshot, 'cached snapshot between publications');
  for (let i = 1; i < 600; i++) step();
  assert.equal(frames - baselineFrames, 600);
  assert.ok(snapshots - baselineSnapshots <= 40);
  assert.ok(Math.abs(simulation.getFrame().distance - 1 / 3) < 1e-9);
  assert.equal(callbacks.size, 1, 'only one pending frame');
  assert.ok(simulation.getFrame().track.length < 40, 'track samples independently of frame rate');
});

test('pause, visibility, and reset stop scheduling without catch-up movement', () => {
  const { simulation, callbacks, step } = setup();
  simulation.setVisible(true);
  simulation.setPlaying(true);
  step(100);
  simulation.setPlaying(false);
  const paused = simulation.getFrame().distance;
  assert.equal(callbacks.size, 0);
  step(60000);
  assert.equal(simulation.getFrame().distance, paused);
  simulation.setPlaying(true);
  simulation.setVisible(false);
  assert.equal(callbacks.size, 0);
  step(60000);
  simulation.setVisible(true);
  step(100);
  assert.ok(Math.abs(simulation.getFrame().distance - paused - 12 * 10 * .1 / 3600) < 1e-9);
  simulation.reset();
  assert.equal(callbacks.size, 0);
  assert.equal(simulation.getSnapshot().distance, 0);
  assert.equal(simulation.getSnapshot().playing, false);
  assert.deepEqual(simulation.getFrame().track, [INITIAL_CENTER]);
});

test('speed commands preserve the clock, arrival stops precisely, reset permits replay', () => {
  const { simulation, callbacks, step } = setup();
  simulation.setVisible(true);
  simulation.setPlaying(true);
  const pending = [...callbacks.keys()];
  simulation.setSpeed(24);
  simulation.setMultiplier(60);
  assert.deepEqual([...callbacks.keys()], pending, 'settings do not restart the loop');
  step(100);
  assert.ok(Math.abs(simulation.getFrame().distance - .04) < 1e-9);
  for (let i = 0; i < 100; i++) step(100);
  const frame = simulation.getFrame();
  assert.equal(frame.distance, 2);
  assert.equal(frame.remaining, 0);
  assert.equal(frame.arrived, true);
  assert.equal(frame.playing, false);
  assert.deepEqual(frame.position, WAYPOINT);
  assert.deepEqual(frame.track.at(-1), WAYPOINT);
  assert.equal(callbacks.size, 0);
  simulation.setPlaying(true);
  assert.equal(callbacks.size, 0);
  simulation.reset();
  simulation.setPlaying(true);
  assert.equal(callbacks.size, 1);
});

test('unsubscribing removes frame and UI listeners', () => {
  const { simulation, step } = setup();
  let calls = 0;
  const offFrame = simulation.subscribeFrames(() => calls++);
  const offUI = simulation.subscribe(() => calls++);
  offFrame(); offUI();
  simulation.setVisible(true);
  simulation.setPlaying(true);
  step(250);
  assert.equal(calls, 0);
});
