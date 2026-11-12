import { test } from 'node:test';
import assert from 'node:assert/strict';
import { vesselDrawerSizes } from '../src/lib/vessel/drawer-layout.ts';

test('drawer snaps include measured content and chrome without changing the full frame', () => {
  const base = vesselDrawerSizes({ compact: 90, summary: 175, full: 300 }, 36, 116, 800);
  assert.deepEqual(base, { compact: 128, summary: 329, full: 454, actions: 116 });
  const warnings = vesselDrawerSizes({ compact: 140, summary: 225, full: 300 }, 36, 116, 800);
  assert.equal(warnings.compact - base.compact, 50);
  assert.equal(warnings.summary - base.summary, 50);
  assert.equal(warnings.full, base.full);
});

test('short screens cap the frame and retain ordered, reachable snaps', () => {
  const sizes = vesselDrawerSizes({ compact: 160, summary: 330, full: 500 }, 36, 116, 280);
  assert.equal(sizes.full, 280);
  assert.ok(sizes.summary - sizes.compact >= 2);
  assert.ok(sizes.full - sizes.summary >= 2);
});

test('wrapped actions and extra full-view content are included in natural size', () => {
  const sizes = vesselDrawerSizes({ compact: 90.3, summary: 175.7, full: 360.2 }, 36, 140.4, 800);
  assert.equal(sizes.actions, 141);
  assert.equal(sizes.full, 539);
  assert.equal(sizes.summary, 355);
});
