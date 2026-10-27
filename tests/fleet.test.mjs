import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFleetStore } from '../src/lib/vessel/fleet.ts';
import { createVesselSimulation } from '../src/lib/vessel/simulation.ts';
import { createMissionDraft } from '../src/lib/vessel/mission.ts';
import { INITIAL_CENTER, destinationFrom } from '../src/lib/vessel/navigation.ts';

test('fleet snapshots are cached and mission commands affect only their vessel', () => {
  let time = 0, next = 0;
  const callbacks = new Map();
  const clock = { now: () => time, request: cb => { callbacks.set(++next, cb); return next; }, cancel: id => callbacks.delete(id) };
  const vessels = ['SR-01', 'SR-02', 'SR-03'].map(id => ({ id, simulation: createVesselSimulation(clock) }));
  const store = createFleetStore(vessels);
  const initial = store.getSnapshot();
  assert.equal(store.getSnapshot(), initial);
  let notifications = 0;
  const unsubscribe = store.subscribe(() => notifications++);
  for (let i = 0; i < 2; i++) {
    vessels[i].simulation.setVisible(true);
    vessels[i].simulation.deploy({ ...createMissionDraft(12), waypoints: [destinationFrom(INITIAL_CENTER, i * 90, 1)] });
  }
  const deployed = store.getSnapshot();
  assert.notEqual(deployed, initial);
  assert.equal(deployed[2], initial[2], 'idle vessel snapshot is unchanged');
  assert.equal(store.getSnapshot(), deployed);
  function step() {
    time += 100;
    const frame = [...callbacks.values()]; callbacks.clear(); frame.forEach(cb => cb(time));
  }
  step();
  const secondBefore = vessels[1].simulation.getFrame();
  vessels[0].simulation.setPlaying(false);
  const paused = vessels[0].simulation.getFrame();
  assert.equal(vessels[1].simulation.getFrame(), secondBefore);
  step();
  assert.deepEqual(vessels[0].simulation.getFrame().position, paused.position);
  assert.notDeepEqual(vessels[1].simulation.getFrame().position, secondBefore.position);
  vessels[0].simulation.setPlaying(true);
  step();
  assert.notDeepEqual(vessels[0].simulation.getFrame().position, paused.position);
  vessels[0].simulation.abort();
  assert.equal(vessels[0].simulation.getFrame().phase, 'aborted');
  assert.equal(vessels[1].simulation.getFrame().playing, true);
  assert.equal(vessels[2].simulation.getFrame().mission, null);
  assert.equal(callbacks.size, 1);
  const count = notifications;
  unsubscribe();
  vessels[1].simulation.setPlaying(false);
  assert.equal(notifications, count, 'fleet subscription cleans up all vessel listeners');
});
