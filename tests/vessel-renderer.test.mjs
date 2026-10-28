import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import * as navigation from '../src/lib/vessel/navigation.ts';
import { createVesselSimulation } from '../src/lib/vessel/simulation.ts';
import { createMissionDraft } from '../src/lib/vessel/mission.ts';

test('boat, rings, trail, and camera render one authoritative frame without a default route', async () => {
  const elements = [], markers = [], listeners = new Map(), sources = new Map(), layers = new Map();
  class Element {
    style = {};
    classList = { add() {} };
    attributes = {};
    children = [];
    removed = false;
    constructor(tag) { this.tag = tag; elements.push(this); }
    append(...children) { this.children.push(...children); }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key]; }
    querySelectorAll() { return []; }
    remove() { this.removed = true; }
  }
  class Marker {
    constructor(options) { this.element = options.element; markers.push(this); }
    setLngLat(position) { this.position = position; return this; }
    setRotation(heading) { this.heading = heading; return this; }
    addTo() { return this; }
    remove() { this.removed = true; }
  }
  const errors = [];
  let rejectUpdates = false;
  let cameraWrites = 0;
  let camera = navigation.INITIAL_CENTER;
  const emit = name => { for (const callback of listeners.get(name) ?? []) callback(); };
  const map = {
    jumpTo({ center }) { cameraWrites++; camera = center; emit('move'); },
    getCenter: () => ({ lng: camera[0], lat: camera[1] }),
    fire: (name, event) => { if (name === 'error') errors.push(event.error); },
    getZoom: () => 12.5,
    addSource(id, specification) {
      sources.set(id, { specification, writes: 0, data: structuredClone(specification.data), setData(data) {
        this.data = structuredClone(data); this.writes++; return rejectUpdates ? Promise.reject(new Error('Worker failed')) : Promise.resolve();
      } });
    },
    getSource: id => sources.get(id),
    removeSource(id) { assert.ok(![...layers.values()].some(layer => layer.source === id)); sources.delete(id); },
    addLayer(layer) { layers.set(layer.id, layer); },
    getLayer: id => layers.get(id),
    removeLayer: id => layers.delete(id),
    on(name, callback) { const group = listeners.get(name) ?? new Set(); group.add(callback); listeners.set(name, group); },
    off(name, callback) { listeners.get(name)?.delete(callback); },
  };
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync('src/components/vessel/renderer.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    require: name => {
      if (name === '@/lib/vessel/navigation') return navigation;
      throw new Error(`Unexpected runtime import: ${name}`);
    },
    document: { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag) },
  });
  let now = 0, next = 0;
  const scheduled = new Map();
  const simulation = createVesselSimulation({ now: () => now, request: callback => { scheduled.set(++next, callback); return next; }, cancel: id => scheduled.delete(id) });
  let pans = 0;
  const vesselMarker = new Marker({ element: new Element('mapcn-marker') });
  const tooltip = { open: true, position: null, isOpen() { return this.open; }, setLngLat(position) { this.position = position; } };
  const renderer = exports.createVesselRenderer(map, { Marker }, simulation,
    { marker: vesselMarker, tooltip },
    { follow: true, showRangeRings: true }, () => pans++);
  assert.equal([...layers.values()].some(layer => layer.id.endsWith('-route')), false, 'no default waypoint route');
  const tail = [...layers.values()].find(layer => layer.id.endsWith('-tail'));
  const live = sources.get(tail.source);
  const history = [...sources].find(([id]) => id.endsWith('-history'))[1];
  const future = [...sources].find(([id]) => id.endsWith('-future'))[1];
  const historyLayer = [...layers.values()].find(layer => layer.id.endsWith('-history-line'));
  const remainingLayer = [...layers.values()].find(layer => layer.id.endsWith('-remaining'));
  assert.notEqual(historyLayer.paint['line-color'], remainingLayer.paint['line-color'], 'travelled and upcoming paths use distinct colors');
  assert.deepEqual(Array.from(historyLayer.paint['line-dasharray']), [2, 3], 'travelled path is dashed');
  assert.equal(elements.some(element => element.tag === 'line' || element.tag === 'polyline'), false, 'no SVG route or trail');
  const initialCameraWrites = cameraWrites;
  renderer.setOptions({ follow: true, showRangeRings: true });
  assert.equal(cameraWrites, initialCameraWrites, 'unchanged center does not trigger camera events');
  const style = JSON.parse(JSON.stringify({
    version: 8,
    sources: Object.fromEntries([...sources].map(([id, source]) => [id, source.specification])),
    layers: [...layers.values()],
  }));
  assert.deepEqual(validateStyleMin(style), [], 'native line layers satisfy the installed MapLibre style specification');
  simulation.setVisible(true);
  simulation.deploy({ ...createMissionDraft(12), origin: navigation.INITIAL_CENTER, waypoints: [navigation.WAYPOINT] });
  simulation.setPlaying(true);
  let snapshots = 0;
  simulation.subscribe(() => snapshots++);
  function step() {
    now += 1000 / 60;
    const callbacks = [...scheduled.values()]; scheduled.clear();
    for (const callback of callbacks) callback(now);
  }
  const oldUI = simulation.getSnapshot();
  const futureWrites = future.writes;
  step();
  assert.equal(simulation.getSnapshot(), oldUI, 'UI did not tick');
  assert.equal(markers[0].position, simulation.getFrame().position);
  assert.equal(tooltip.position, simulation.getFrame().position, 'open mapcn tooltip follows the live marker');
  assert.equal(markers[1].position, simulation.getFrame().position);
  assert.equal(camera, simulation.getFrame().position);
  assert.deepEqual(live.data.features[0].geometry.coordinates.at(-1), simulation.getFrame().position, 'trail tip uses live frame');
  assert.deepEqual(live.data.features[1].geometry.coordinates[0], simulation.getFrame().position, 'remaining route starts at the same live position');
  assert.deepEqual(live.data.features[1].geometry.coordinates[1], navigation.WAYPOINT);
  for (let i = 0; i < 1199; i++) step();
  assert.ok(snapshots <= 80);
  assert.ok(history.data.features[0].geometry.coordinates.length > 2, 'sampled track is a native geographic line');
  assert.ok(history.writes < 40, 'history is not rebuilt every frame');
  assert.deepEqual(live.data.features[0].geometry.coordinates[1], simulation.getFrame().position);
  assert.equal(live.data.features.length, 2, 'per-frame source contains only the trail tip and current leg');
  assert.equal(future.writes, futureWrites, 'future route is not rebuilt each frame');
  const pendingBefore = [...scheduled.keys()];
  renderer.setOptions({ follow: false, showRangeRings: false });
  assert.deepEqual([...scheduled.keys()], pendingBefore, 'display toggles do not restart simulation');
  assert.equal(markers[1].element.children[0].attributes['data-visible'], 'false');
  const writesBeforePan = live.writes;
  camera = [camera[0] + 0.01, camera[1]];
  emit('move');
  assert.equal(live.writes, writesBeforePan, 'camera changes do not rebuild geographic lines');
  emit('dragstart');
  assert.equal(pans, 1);
  simulation.setMultiplier(3600);
  for (let i = 0; i < 100 && simulation.getFrame().playing; i++) step();
  assert.equal(simulation.getFrame().phase, 'complete');
  for (const source of sources.values()) assert.equal(source.data.features.length, 0, 'completion clears all route and trail sources');
  simulation.deploy({ ...createMissionDraft(12), waypoints: [navigation.destinationFrom(navigation.WAYPOINT, 90, 1), navigation.destinationFrom(navigation.WAYPOINT, 90, 2)] });
  step();
  assert.equal(future.data.features.length, 1);
  assert.ok(history.data.features.length > 0);
  simulation.abort();
  for (const source of sources.values()) assert.equal(source.data.features.length, 0, 'abort clears all route and trail sources');
  emit('move');
  for (const source of sources.values()) assert.equal(source.data.features.length, 0, 'camera changes cannot restore an ended mission');
  simulation.reset();
  assert.equal(history.data.features.length, 0);
  assert.equal(live.data.features.length, 0);
  assert.equal(markers[0].position, simulation.getFrame().position);
  rejectUpdates = true;
  simulation.setSpeed(18);
  await Promise.resolve();
  assert.equal(errors.length, 1, 'active worker failure uses MapLibre error event');
  errors.length = 0;
  simulation.setSpeed(12);
  renderer.destroy();
  renderer.destroy(); // Strict Mode/style changes can repeat cleanup paths.
  await Promise.resolve();
  assert.equal(errors.length, 0, 'pending worker failure is harmless after disposal');
  assert.equal(layers.size, 0, 'native line layers cleaned up');
  assert.equal(sources.size, 0, 'native line sources cleaned up');
  assert.equal(vesselMarker.removed, undefined, 'mapcn retains ownership of its marker');
  assert.equal(markers[1].removed, true, 'renderer removes only its own markers');
  assert.ok([...listeners.values()].every(group => group.size === 0));
  assert.ok(elements.filter(element => element.tag === 'svg').every(element => element.removed || markers.some(marker => marker.element.children.includes(element))));
  rejectUpdates = false;
  // The mapcn isLoaded effect tears down before setStyle and reattaches once
  // the replacement style loads. Recreate against the same simulation/marker.
  simulation.setVisible(true);
  simulation.deploy({ ...createMissionDraft(12), origin: navigation.INITIAL_CENTER, waypoints: [navigation.WAYPOINT] });
  simulation.setPlaying(true);
  step();
  const replacement = exports.createVesselRenderer(map, { Marker }, simulation,
    { marker: vesselMarker, tooltip }, { follow: false, showRangeRings: true }, () => pans++);
  assert.equal(layers.size, 5, 'trail and remaining-route layers recreated after a style swap');
  const replacementTail = [...layers.values()].find(layer => layer.id.endsWith('-tail'));
  const replacementLive = sources.get(replacementTail.source);
  assert.deepEqual(replacementLive.data.features[0].geometry.coordinates[1], simulation.getFrame().position, 'restores current position, not initial position');
  replacement.destroy();
  assert.equal(layers.size, 0);
  assert.equal(sources.size, 0);
});
