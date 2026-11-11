import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoActivity } from '../src/lib/vessel/demo-activity.ts';
import { FLEET_DEFINITIONS } from '../src/lib/vessel/fleet-definitions.ts';
import { createVesselSimulation } from '../src/lib/vessel/simulation.ts';
import { createMissionDraft } from '../src/lib/vessel/mission.ts';
import { destinationFrom } from '../src/lib/vessel/navigation.ts';

test('demo fleet starts with ten historical activities and remains idle at its initial positions', () => {
  const now = 1_800_000_000_000;
  let count = 0;
  for (const vessel of FLEET_DEFINITIONS) {
    const seed = createDemoActivity(vessel, now);
    const simulation = createVesselSimulation(
      undefined,
      vessel.series.propulsion,
      vessel.initialPosition,
      vessel.initialHeading,
      seed,
    );
    const entries = simulation.activity.getSnapshot();
    count += entries.length;
    assert.equal(entries.length, 5);
    assert.equal(entries[0].title, 'Mission completed');
    assert.deepEqual(entries[0].position, vessel.initialPosition);
    assert.ok(
      entries.every(
        (entry, i) =>
          entry.timestamp < now &&
          (!i || entry.timestamp <= entries[i - 1].timestamp),
      ),
    );
    assert.equal(simulation.getFrame().phase, 'idle');
    assert.equal(simulation.getFrame().mission, null);
    assert.deepEqual(simulation.getFrame().position, vessel.initialPosition);
  }
  assert.equal(count, 10);
});

test('live missions append after demo history with distinct event and mission IDs', () => {
  const vessel = FLEET_DEFINITIONS[0];
  const simulation = createVesselSimulation(
    undefined,
    vessel.series.propulsion,
    vessel.initialPosition,
    vessel.initialHeading,
    createDemoActivity(vessel),
  );
  const previous = simulation.activity.getSnapshot();
  assert.equal(
    simulation.deploy({
      ...createMissionDraft(12),
      waypoints: [destinationFrom(vessel.initialPosition, 0, 1)],
    }),
    true,
  );
  const entries = simulation.activity.getSnapshot();
  assert.equal(entries.length, 6);
  assert.equal(entries[0].id, 6);
  assert.equal(entries[0].missionId, 2);
  assert.deepEqual(entries.slice(1), previous);
});
