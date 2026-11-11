import type { Map } from 'maplibre-gl';
import type { Coordinate } from './vessel/navigation';
import { DEFAULT_MAP_ZOOM } from './vessel/navigation';
import { getFleetBounds } from './vessel/fleet-bounds';

// Account for the drawer so the whole mission fits in the usable map area.
export function fitMissionRoute(map: Map, points: Coordinate[]) {
  const bounds = getFleetBounds(points, 0);
  if (!bounds) return;
  const container = map.getContainer();
  const drawerWidth = container.querySelector('.mission-drawer-popup')?.getBoundingClientRect().width ?? 384;
  map.fitBounds(bounds, {
    padding: { top: 96, bottom: 80, left: 64, right: Math.min(drawerWidth + 122, container.clientWidth - 100) },
    maxZoom: DEFAULT_MAP_ZOOM,
    duration: 300,
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
}
