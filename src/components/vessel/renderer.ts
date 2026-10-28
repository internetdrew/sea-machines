import type * as MapLibre from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import { INITIAL_CENTER, RANGE_DISTANCES } from '@/lib/vessel/navigation';
import type { VesselFrame, VesselSimulation } from '@/lib/vessel/simulation';

export type VesselDisplayOptions = { follow: boolean; showRangeRings: boolean };
let rendererSequence = 0;
const svgNamespace = 'http://www.w3.org/2000/svg';

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K) {
  return document.createElementNS(svgNamespace, tag);
}

// Owns all map presentation and cleanup. There is no animation clock here:
// simulation frames and map camera events both go through renderFrame().
export function createVesselRenderer(
  map: MapLibre.Map,
  mapLib: typeof MapLibre,
  simulation: VesselSimulation,
  vessel: { marker: MapLibre.Marker; missionMarker?: MapLibre.Marker; tooltip: MapLibre.Popup },
  initialOptions: VesselDisplayOptions,
  onPan: () => void,
) {
  let options = initialOptions;
  let disposed = false;
  let rendering = false;
  let pixelsPerNm = -1;

  // mapcn owns the vessel marker and its interactions. We only move it.
  const { marker, missionMarker, tooltip } = vessel;

  const ringElement = document.createElement('div');
  ringElement.setAttribute('aria-hidden', 'true');
  ringElement.style.pointerEvents = 'none';
  const ringsSvg = svgElement('svg');
  ringsSvg.classList.add('vessel-range-rings');
  ringsSvg.setAttribute('data-visible', String(options.showRangeRings));
  ringsSvg.setAttribute('viewBox', '-2.2 -2.2 4.4 4.4');
  ringsSvg.style.overflow = 'visible';
  ringsSvg.innerHTML = RANGE_DISTANCES.map(radius => `
    <circle cx="0" cy="0" r="${radius}" fill="none" stroke="#78999e" stroke-opacity="0.3" stroke-width="1" vector-effect="non-scaling-stroke" />
    <text x="${radius}" y="0" dx="0.03" fill="white" style="font-family:monospace" dominant-baseline="middle">${radius} nm</text>
  `).join('');
  const ringLabels = ringsSvg.querySelectorAll('text');
  ringElement.append(ringsSvg);
  const rings = new mapLib.Marker({
    element: ringElement, subpixelPositioning: true,
    rotationAlignment: 'map', pitchAlignment: 'map',
  }).setLngLat(INITIAL_CENTER).addTo(map);

  const prefix = `vessel-lines-${++rendererSequence}`;
  const liveSourceId = `${prefix}-live`;
  const historySourceId = `${prefix}-history`;
  const futureSourceId = `${prefix}-future`;
  const tailLayerId = `${prefix}-tail`;
  const historyLayerId = `${prefix}-history-line`;
  const futureLayerId = `${prefix}-future-line`;
  const remainingLayerId = `${prefix}-remaining`;
  const transitLayerId = `${prefix}-transit`;
  const liveData: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [],
  };
  map.addSource(liveSourceId, { type: 'geojson', data: liveData });
  map.addSource(historySourceId, { type: 'geojson', data: {
    type: 'FeatureCollection', features: [],
  } });
  map.addSource(futureSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: historyLayerId, type: 'line', source: historySourceId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#94a3b8', 'line-width': 1.5, 'line-opacity': 0.65, 'line-dasharray': [2, 3] },
  });
  map.addLayer({
    id: tailLayerId, type: 'line', source: liveSourceId,
    filter: ['==', ['get', 'kind'], 'tail'],
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': '#94a3b8', 'line-width': 1.5, 'line-opacity': 0.65, 'line-dasharray': [2, 3] },
  });
  map.addLayer({
    id: futureLayerId, type: 'line', source: futureSourceId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#14b8a6', 'line-width': 2, 'line-opacity': 1 },
  });
  map.addLayer({
    id: remainingLayerId, type: 'line', source: liveSourceId,
    filter: ['==', ['get', 'kind'], 'remaining'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#14b8a6', 'line-width': 2, 'line-opacity': 1 },
  });
  map.addLayer({
    id: transitLayerId, type: 'line', source: liveSourceId,
    filter: ['==', ['get', 'kind'], 'transit'],
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': '#14b8a6', 'line-width': 1.5, 'line-opacity': 0.85, 'line-dasharray': [4, 3] },
  });
  const liveSource = map.getSource<MapLibre.GeoJSONSource>(liveSourceId)!;
  const historySource = map.getSource<MapLibre.GeoJSONSource>(historySourceId)!;
  const futureSource = map.getSource<MapLibre.GeoJSONSource>(futureSourceId)!;
  let previousFrame: VesselFrame | undefined;
  let previousTrack: VesselFrame['track'] | undefined;
  let previousMission: VesselFrame['mission'] | undefined;
  let previousTargetIndex = -1;
  let previousTrailVisible = false;

  function updateSource(source: MapLibre.GeoJSONSource, data: Parameters<MapLibre.GeoJSONSource['setData']>[0]) {
    void source.setData(data).catch(error => {
      // Style reloads can remove a source while its worker update is pending.
      // Surface active failures through MapLibre's normal error event.
      if (!disposed) map.fire('error', { error });
    });
  }

  function renderFrame(frame: VesselFrame, followCamera = true) {
    if (disposed || rendering) return;
    rendering = true;
    try {
      // Apply the camera first; every overlay then uses the same projection.
      if (followCamera && options.follow) {
        const center = map.getCenter();
        if (center.lng !== frame.position[0] || center.lat !== frame.position[1]) {
          map.jumpTo({ center: frame.position });
        }
      }
      marker.setLngLat(frame.position).setRotation(frame.heading);
      missionMarker?.setLngLat(frame.position);
      if (tooltip.isOpen()) tooltip.setLngLat(frame.position);
      const visible = String(options.showRangeRings);
      if (ringsSvg.getAttribute('data-visible') !== visible) {
        ringsSvg.setAttribute('data-visible', visible);
      }
      // Keep the group synchronized during its fade-out as well as fade-in.
      rings.setLngLat(frame.position);
      // Vessel-relative range circles in the Mercator map plane. No GeoJSON
      // or worker geometry is rebuilt as the vessel advances.
      const scale = 1852 * 512 * 2 ** map.getZoom() /
        (2 * Math.PI * 6371008.8 * Math.cos(frame.position[1] * Math.PI / 180));
      if (Math.abs(scale - pixelsPerNm) > 0.01) {
        const size = String(scale * 4.4);
        ringsSvg.setAttribute('width', size);
        ringsSvg.setAttribute('height', size);
        for (const label of ringLabels) {
          label.setAttribute('font-size', String(10 / scale));
        }
        pixelsPerNm = scale;
      }
      if (frame !== previousFrame) {
        const active = frame.mission !== null && frame.phase !== 'complete' && frame.phase !== 'aborted';
        liveData.features = active ? [
          { type: 'Feature', properties: { kind: 'tail' }, geometry: { type: 'LineString', coordinates: [frame.track.at(-1) ?? frame.position, frame.position] } },
          { type: 'Feature', properties: { kind: frame.mission?.type === 'grid' && frame.targetIndex === 0 ? 'transit' : 'remaining' }, geometry: { type: 'LineString', coordinates: [frame.position, frame.nextWaypoint ?? frame.position] } },
        ] : [];
        // Only the trail tip and current leg change at frame rate.
        updateSource(liveSource, liveData);
        if (frame.track !== previousTrack || active !== previousTrailVisible) {
          updateSource(historySource, {
            type: 'FeatureCollection', features: active && frame.track.length > 1 ? [{
              type: 'Feature', properties: {},
              geometry: { type: 'LineString', coordinates: [...frame.track] },
            }] : [],
          });
          previousTrack = frame.track;
        }
        if (frame.mission !== previousMission || frame.targetIndex !== previousTargetIndex || active !== previousTrailVisible) {
          const coordinates = active ? frame.mission!.targets.slice(frame.targetIndex) : [];
          updateSource(futureSource, { type: 'FeatureCollection', features: coordinates.length > 1 ? [{
            type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates },
          }] : [] });
          previousMission = frame.mission;
          previousTargetIndex = frame.targetIndex;
        }
        previousTrailVisible = active;
        previousFrame = frame;
      }
    } finally {
      rendering = false;
    }
  }

  const drawOnCameraChange = () => renderFrame(simulation.getFrame(), false);
  const handlePan = () => {
    options = { ...options, follow: false };
    onPan();
  };
  const unsubscribe = simulation.subscribeFrames(renderFrame);
  map.on('move', drawOnCameraChange);
  map.on('resize', drawOnCameraChange);
  map.on('dragstart', handlePan);
  renderFrame(simulation.getFrame());

  return {
    setOptions(next: VesselDisplayOptions) {
      options = next;
      renderFrame(simulation.getFrame());
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      map.off('move', drawOnCameraChange);
      map.off('resize', drawOnCameraChange);
      map.off('dragstart', handlePan);
      rings.remove();
      for (const id of [tailLayerId, historyLayerId, futureLayerId, remainingLayerId, transitLayerId]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of [liveSourceId, historySourceId, futureSourceId]) {
        if (map.getSource(id)) map.removeSource(id);
      }
    },
  };
}
