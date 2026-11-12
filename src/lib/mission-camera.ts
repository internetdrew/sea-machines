import type { Map } from 'maplibre-gl';
import type { Coordinate } from './vessel/navigation';
import { DEFAULT_MAP_ZOOM } from './vessel/navigation';
import { getFleetBounds } from './vessel/fleet-bounds';

export function missionMapPadding(map: Map) {
  const container = map.getContainer();
  const popup = container.querySelector<HTMLElement>('.mission-drawer-popup');
  if (window.matchMedia('(max-width: 639px)').matches) {
    const height = popup?.hasAttribute('data-compact') ? Number(popup.dataset.compactHeight ?? 120) : Number(popup?.dataset.expandedHeight ?? 260);
    return { top: 64, bottom: Math.min(height + Math.max(12, parseFloat(getComputedStyle(popup?.parentElement ?? container).paddingBottom) || 0) + 24, container.clientHeight - 100), left: 24, right: 24 };
  }
  return { top: 96, bottom: 80, left: 64, right: Math.min((popup?.getBoundingClientRect().width ?? 384) + 122, container.clientWidth - 100) };
}

export function missionMapOffset(map: Map): [number, number] {
  const padding = missionMapPadding(map);
  return [(padding.left - padding.right) / 2, (padding.top - padding.bottom) / 2];
}

// Account for the drawer so the whole mission fits in the usable map area.
export function fitMissionRoute(map: Map, points: Coordinate[]) {
  const bounds = getFleetBounds(points, 0);
  if (!bounds) return;
  map.fitBounds(bounds, {
    padding: missionMapPadding(map),
    maxZoom: DEFAULT_MAP_ZOOM,
    duration: 300,
    animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
}
