import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeVesselLabel } from '../src/lib/vessel/label-placement.ts';
const hull = { x: 100, y: 100, width: 80, height: 40 };
const size = { width: 64, height: 28 };
const viewport = { width: 500, height: 400 };

test('identity sits 14 pixels below the visible hull bounds', () => {
  const label = placeVesselLabel(hull, size, viewport, [hull]);
  assert.equal(label.x, 108);
  assert.equal(label.y, 154);
  assert.equal(label.side, 'below');
});

test('identity avoids another label and keeps its alternate side when space clears', () => {
  const first = placeVesselLabel(hull, size, viewport, [hull]);
  const alternate = placeVesselLabel(hull, size, viewport, [hull, first]);
  assert.equal(alternate.side, 'above');
  assert.equal(placeVesselLabel(hull, size, viewport, [hull], alternate.side).side, 'above');
});

test('identity remains inside the viewport at a map edge', () => {
  const edgeHull = { x: 470, y: 365, width: 80, height: 40 };
  const label = placeVesselLabel(edgeHull, size, viewport, [edgeHull]);
  assert.ok(label.x >= 12 && label.x + size.width <= viewport.width - 12);
  assert.ok(label.y >= 12 && label.y + size.height <= viewport.height - 12);
});

test('identity searches further when all four adjacent placements are blocked', () => {
  const blockers = ['below', 'above', 'right', 'left'].map(side => placeVesselLabel(hull, size, viewport, [], side));
  const label = placeVesselLabel(hull, size, viewport, [hull, ...blockers]);
  assert.ok(!blockers.some(blocker => Math.abs(label.x - blocker.x) < size.width && Math.abs(label.y - blocker.y) < size.height));
});
