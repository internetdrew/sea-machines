import { useEffect } from 'react';
import { useMap } from '@/components/ui/map';

const SOURCE_ID = 'openseamap-seamarks';
const LAYER_ID = 'openseamap-seamarks-overlay';

export function SeamarkLayer() {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    map.addSource(SOURCE_ID, {
      type: 'raster',
      tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 18,
      attribution:
        '&copy; <a href="https://www.openseamap.org/" target="_blank" rel="noopener noreferrer">OpenSeaMap</a> contributors | <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    });

    // When toggled back on, keep seamarks underneath voyage lines.
    const firstVesselLayer = map.getStyle().layers.find(layer =>
      'source' in layer && typeof layer.source === 'string' &&
      layer.source.startsWith('vessel-lines-'),
    );
    map.addLayer({
      id: LAYER_ID,
      type: 'raster',
      source: SOURCE_ID,
      paint: { 'raster-fade-duration': 0 },
    }, firstVesselLayer?.id);

    return () => {
      if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
  }, [map, isLoaded]);

  return null;
}
