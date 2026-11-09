import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FLEET_DEFINITIONS } from '../src/lib/vessel/fleet-definitions.ts';
import { getVesselIdentity } from '../src/lib/vessel/vessel.ts';
import { createVesselSimulation } from '../src/lib/vessel/simulation.ts';
import { createMissionDraft } from '../src/lib/vessel/mission.ts';

test('fleet definitions keep individual identity separate from series', () => {
  assert.equal(new Set(FLEET_DEFINITIONS.map(vessel => vessel.id)).size, FLEET_DEFINITIONS.length);
  const [stormrunner, selkie] = FLEET_DEFINITIONS;
  assert.equal(stormrunner.name, undefined);
  assert.equal(selkie.name, undefined);
  assert.equal(getVesselIdentity(stormrunner), 'SR-01 · Stormrunner');
  assert.equal(getVesselIdentity(selkie), 'PV-02 · Selkie');
  assert.equal(getVesselIdentity({ ...selkie, name: 'Discovery' }), 'PV-02 · Discovery');
  assert.equal(getVesselIdentity({ ...selkie, name: ' ' }), 'PV-02 · Selkie');
});

test('each series provides its own planning speeds and descriptive range', () => {
  const [stormrunner, selkie] = FLEET_DEFINITIONS;
  for (const [definition, cruise, maximum, range] of [[stormrunner, 27, 40, 700], [selkie, 22, 30, 400]]) {
    const simulation = createVesselSimulation(undefined, definition.series.propulsion, definition.initialPosition, definition.initialHeading);
    assert.equal(simulation.getFrame().cruiseSpeed, cruise);
    assert.equal(createMissionDraft(cruise).speed, cruise);
    assert.equal(definition.series.propulsion.maxSpeed, maximum);
    assert.equal(definition.series.publishedRange.nauticalMiles, range);
    assert.deepEqual(simulation.getFrame().position, definition.initialPosition);
    assert.equal(simulation.getFrame().heading, definition.initialHeading);
  }
  assert.notEqual(stormrunner.initialFuelTanks, selkie.initialFuelTanks);
});
