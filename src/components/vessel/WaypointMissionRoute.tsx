import { useEffect, useRef, useState } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { useMap } from '@/components/ui/map';
import type { Coordinate } from '@/lib/vessel/navigation';

const DRAW_DURATION_MS = 240;
const easeOutCubic = (progress: number) => 1 - (1 - progress) ** 3;

function lineData(coordinates: Coordinate[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: coordinates.length < 2 ? [] : [{
      type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates },
    }],
  };
}

// Keep every leg in one persistent map source, including the leg being drawn.
export function WaypointMissionRoute({ id, coordinates, revision, visible }: {
  id: string; coordinates: Coordinate[]; revision: number; visible: boolean;
}) {
  const { map, isLoaded } = useMap();
  const [ready, setReady] = useState(false);
  const previous = useRef({ coordinates, revision });
  const sourceId = `${id}-source`;
  const layerId = `${id}-line`;

  useEffect(() => {
    if (!map || !isLoaded) return;
    map.addSource(sourceId, { type: 'geojson', data: lineData([]) });
    map.addLayer({
      id: layerId, type: 'line', source: sourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#14b8a6', 'line-width': 3 },
    });
    setReady(true);
    return () => {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [map, isLoaded, sourceId, layerId]);

  useEffect(() => {
    if (!map || !ready) return;
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    if (!source) return;
    const before = previous.current;
    previous.current = { coordinates, revision };
    const prefixMatches = before.coordinates.every((point, i) =>
      coordinates[i]?.[0] === point[0] && coordinates[i]?.[1] === point[1]);
    const appended = revision !== before.revision && prefixMatches &&
      (coordinates.length === before.coordinates.length + 1 ||
        (before.coordinates.length === 0 && coordinates.length === 2));
    if (!visible || !appended || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      source.setData(lineData(visible ? coordinates : []));
      return;
    }
    const prefix = coordinates.slice(0, -1);
    const from = prefix[prefix.length - 1];
    const to = coordinates[coordinates.length - 1];
    // Follow the short longitude span across the date line.
    const longitudeDelta = ((to[0] - from[0] + 540) % 360) - 180;
    source.setData(lineData([...prefix, from]));
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const progress = Math.min(1, (now - start) / DRAW_DURATION_MS);
      const eased = easeOutCubic(progress);
      source.setData(lineData(progress === 1 ? coordinates : [...prefix, [
        from[0] + longitudeDelta * eased,
        from[1] + (to[1] - from[1]) * eased,
      ]]));
      if (progress < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [map, ready, sourceId, coordinates, revision, visible]);

  return null;
}
