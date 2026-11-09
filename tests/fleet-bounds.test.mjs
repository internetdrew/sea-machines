import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getFleetBounds } from '../src/lib/vessel/fleet-bounds.ts';
import { destinationFrom, INITIAL_CENTER } from '../src/lib/vessel/navigation.ts';

test('fleet bounds include every vessel and its range rings', () => {
  const positions = Array.from({ length: 50 }, (_, index) => destinationFrom(INITIAL_CENTER, index * 37, index / 5));
  const [[west, south], [east, north]] = getFleetBounds(positions);
  for (const position of positions) {
    for (const heading of [0, 90, 180, 270]) {
      const [longitude, latitude] = destinationFrom(position, heading, 2);
      assert.ok(longitude >= west - 1e-9 && longitude <= east + 1e-9);
      assert.ok(latitude >= south && latitude <= north);
    }
  }
});

test('empty fleets fall back and single vessels have breathing room', () => {
  assert.equal(getFleetBounds([]), undefined);
  const [[west, south], [east, north]] = getFleetBounds([INITIAL_CENTER]);
  assert.ok(west < INITIAL_CENTER[0] && east > INITIAL_CENTER[0]);
  assert.ok(south < INITIAL_CENTER[1] && north > INITIAL_CENTER[1]);
});

test('fleets across the date line fit the short longitude span', () => {
  const [[west], [east]] = getFleetBounds([[179.8, 20], [-179.8, 20]]);
  assert.ok(east - west < 1);
});
