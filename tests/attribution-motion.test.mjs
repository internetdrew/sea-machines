import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function setup(reduced = false) {
  const listeners = new Map(), pending = [];
  const classes = new Set(['maplibregl-compact', 'maplibregl-compact-show']);
  const attributes = new Set(['open']);
  const button = {
    click() { assert.fail('attribution must never synthesize a click'); },
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
    getBoundingClientRect: () => ({ width: 24 }),
  };
  const inner = { style: { opacity: '' } };
  const attribution = {
    style: { clipPath: '' },
    classList: { contains: value => classes.has(value), remove: value => classes.delete(value), add: value => classes.add(value) },
    matches: () => false,
    setAttribute: value => attributes.add(value),
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type) { listeners.delete(type); },
    removeAttribute: value => attributes.delete(value),
    querySelector: selector => selector.endsWith('-button') ? button : inner,
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/lib/attribution-motion.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: () => ({ animate: () => {
      let resolve;
      const promise = new Promise(done => { resolve = done; });
      promise.cancel = () => {};
      pending.push(resolve);
      return promise;
    } }),
    window: { matchMedia: () => ({ matches: reduced, addEventListener() {}, removeEventListener() {} }) },
    getComputedStyle: element => ({ borderLeftWidth: '1', borderRightWidth: '1', clipPath: 'inset(0 0 0 20px round 999px)', opacity: element === inner ? '0.5' : '1' }),
  });
  return { controls: exports.animateAttributionCollapse(attribution), classes, attributes, pending, listeners };
}

test('timed collapse closes native details without generating clicks', async () => {
  const { controls, classes, attributes, pending } = setup();
  controls.collapse();
  assert.ok(classes.has('maplibregl-compact-show'));
  pending[0]();
  await Promise.resolve();
  assert.equal(classes.has('maplibregl-compact-show'), false);
  assert.equal(attributes.has('open'), false);
  controls.destroy();
});

test('reduced motion collapses directly with no animation or generated input', () => {
  const { controls, classes, attributes, pending } = setup(true);
  controls.collapse();
  assert.equal(classes.has('maplibregl-compact-show'), false);
  assert.equal(attributes.size, 0);
  assert.equal(pending.length, 0);
});

test('a real second press cancels collapse and stale completion cannot close credits', async () => {
  const { controls, listeners, pending, classes, attributes } = setup();
  controls.collapse();
  listeners.get('click')({ detail: 1, preventDefault() {}, stopImmediatePropagation() {} });
  pending[0]();
  await Promise.resolve();
  assert.ok(classes.has('maplibregl-compact-show'));
  assert.ok(attributes.has('open'));
  controls.destroy();
  assert.equal(listeners.size, 0);
});

test('unmount cancels pending completion without changing attribution state', async () => {
  const { controls, classes, pending } = setup();
  controls.collapse();
  controls.destroy();
  pending[0]();
  await Promise.resolve();
  assert.ok(classes.has('maplibregl-compact-show'));
});


test('keyboard toggles immediately without generating animation or input', () => {
  const { controls, listeners, classes, attributes, pending } = setup();
  const press = () => listeners.get('click')({ detail: 0, preventDefault() {}, stopImmediatePropagation() {} });
  press();
  assert.equal(classes.has('maplibregl-compact-show'), false);
  assert.equal(attributes.has('open'), false);
  press();
  assert.ok(classes.has('maplibregl-compact-show'));
  assert.ok(attributes.has('open'));
  assert.equal(pending.length, 0);
  controls.destroy();
});

test('pointer entry reverses automatic collapse and stale close cannot win', async () => {
  const { controls, listeners, classes, pending } = setup();
  controls.collapse();
  listeners.get('mouseenter')();
  assert.equal(pending.length, 4);
  pending[0]();
  await Promise.resolve();
  assert.ok(classes.has('maplibregl-compact-show'));
  pending[2]();
  await Promise.resolve();
  assert.ok(classes.has('maplibregl-compact-show'));
  controls.destroy();
});
