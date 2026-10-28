import { test } from 'node:test';
import assert from 'node:assert/strict';
import { placeMapTooltip } from '../src/lib/map-tooltip-placement.ts';

const layout = { x: 500, y: 350, width: 240, height: 140, viewportWidth: 1000, viewportHeight: 700, gap: 74, preferredSide: 'left' };

test('tooltip leaves a clear gap beside the vessel and prefers the requested side', () => {
  const left = placeMapTooltip(layout);
  assert.equal(left.side, 'left');
  assert.equal(layout.x + left.offset[0] + layout.width / 2, layout.x - 74);
  const right = placeMapTooltip({ ...layout, preferredSide: 'right' });
  assert.equal(right.side, 'right');
  assert.equal(layout.x + right.offset[0] - layout.width / 2, layout.x + 74);
});

test('tooltip retains its side as heading changes, switching only when it no longer fits', () => {
  assert.equal(placeMapTooltip({ ...layout, preferredSide: 'right', previousSide: 'left' }).side, 'left');
  assert.equal(placeMapTooltip({ ...layout, x: 100, previousSide: 'left' }).side, 'right');
});

test('narrow viewports fall back vertically without touching the marker', () => {
  const result = placeMapTooltip({ ...layout, x: 200, viewportWidth: 400 });
  assert.equal(result.side, 'top');
  assert.equal(layout.y + result.offset[1] + layout.height / 2, layout.y - 74);
  assert.equal(result.offset[0], 0);
});

test('placement near viewport corners keeps all card edges inside the margin', () => {
  for (const x of [30, 970]) for (const y of [30, 670]) {
    const { offset } = placeMapTooltip({ ...layout, x, y });
    assert.ok(x + offset[0] - layout.width / 2 >= 12);
    assert.ok(x + offset[0] + layout.width / 2 <= 988);
    assert.ok(y + offset[1] - layout.height / 2 >= 12);
    assert.ok(y + offset[1] + layout.height / 2 <= 688);
  }
});
