import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeVesselLabel, relativeLabelRect } from '../src/lib/vessel/label-placement.ts';
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


test('hull bounds use the overlay origin and scale rather than SVG screen matrices', () => {
  const local = relativeLabelRect(
    { x: 160, y: 280, width: 120, height: 60 },
    { x: 40, y: 100, width: 780, height: 1688 },
    { width: 390, height: 844 },
  );
  assert.deepEqual(local, { x: 60, y: 90, width: 60, height: 30 });
  const label = placeVesselLabel(local, size, { width: 390, height: 844 }, [local]);
  assert.equal(label.y, 134);
  assert.equal(label.x + label.width / 2, local.x + local.width / 2);
});
