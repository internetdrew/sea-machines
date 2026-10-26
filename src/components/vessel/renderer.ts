import type * as MapLibre from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import { INITIAL_CENTER, RANGE_DISTANCES, WAYPOINT } from '@/lib/vessel/navigation';
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
  vessel: { marker: MapLibre.Marker; tooltip: MapLibre.Popup },
  initialOptions: VesselDisplayOptions,
  onPan: () => void,
) {
  let options = initialOptions;
  let disposed = false;
  let rendering = false;
  let pixelsPerNm = -1;

  // mapcn owns the vessel marker and its interactions. We only move it.
  const { marker, tooltip } = vessel;

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
  const routeLayerId = `${prefix}-route`;
  const tailLayerId = `${prefix}-tail`;
  const historyLayerId = `${prefix}-history-line`;
  const liveData: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { kind: 'route' }, geometry: { type: 'LineString', coordinates: [WAYPOINT, INITIAL_CENTER] } },
      { type: 'Feature', properties: { kind: 'tail' }, geometry: { type: 'LineString', coordinates: [INITIAL_CENTER, INITIAL_CENTER] } },
    ],
  };
  map.addSource(liveSourceId, { type: 'geojson', data: liveData });
  map.addSource(historySourceId, { type: 'geojson', data: {
    type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [INITIAL_CENTER, INITIAL_CENTER] },
  } });
  map.addLayer({
    id: historyLayerId, type: 'line', source: historySourceId,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#78999e', 'line-width': 2, 'line-opacity': 0.5 },
  });
  map.addLayer({
    id: tailLayerId, type: 'line', source: liveSourceId,
    filter: ['==', ['get', 'kind'], 'tail'],
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': '#78999e', 'line-width': 2, 'line-opacity': 0.5 },
  });
  map.addLayer({
    id: routeLayerId, type: 'line', source: liveSourceId,
    filter: ['==', ['get', 'kind'], 'route'],
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: { 'line-color': '#579b9c', 'line-width': 1.5, 'line-opacity': 0.65, 'line-dasharray': [5, 5] },
  });
  const liveSource = map.getSource<MapLibre.GeoJSONSource>(liveSourceId)!;
  const historySource = map.getSource<MapLibre.GeoJSONSource>(historySourceId)!;
  let previousFrame: VesselFrame | undefined;
  let previousTrack: VesselFrame['track'] | undefined;

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
        // Keep the first route coordinate fixed at the waypoint: dash phase
        // stays anchored there as only the boat end of the line changes.
        liveData.features[0].geometry.coordinates = [WAYPOINT, frame.position];
        liveData.features[1].geometry.coordinates = [frame.track[frame.track.length - 1], frame.position];
        // Only two two-point segments enter the worker on each simulation frame.
        updateSource(liveSource, liveData);
        if (frame.track !== previousTrack) {
          updateSource(historySource, {
            type: 'Feature', properties: {},
            geometry: { type: 'LineString', coordinates: frame.track.length > 1
              ? [...frame.track] : [frame.position, frame.position] },
          });
          previousTrack = frame.track;
        }
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
      for (const id of [routeLayerId, tailLayerId, historyLayerId]) {
        if (map.getLayer(id)) map.removeLayer(id);
      }
      for (const id of [liveSourceId, historySourceId]) {
        if (map.getSource(id)) map.removeSource(id);
      }
    },
  };
}
