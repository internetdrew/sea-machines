import { useEffect, useRef } from 'react';
import { useMap } from '@/components/ui/map';
import { placeVesselLabel } from '@/lib/vessel/label-placement';
import type { LabelRect, LabelSide } from '@/lib/vessel/label-placement';
import type { Vessel } from '@/lib/vessel/vessel';

// Separate viewport overlay: vessel headings never rotate the identity text.
export function FleetLabels({ vessels }: { vessels: readonly Vessel[] }) {
  const { map, isLoaded } = useMap();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!map || !isLoaded || !root.current) return;
    const overlay = root.current;
    const entries = vessels.map(vessel => {
      const label = document.createElement('div');
      label.className = 'vessel-identity';
      label.textContent = vessel.id;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      line.classList.add('vessel-identity-leader');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.append(path);
      overlay.append(line, label);
      return { vessel, label, line, path, side: 'below' as LabelSide };
    });
    const outlines = new WeakMap<SVGGeometryElement, DOMPoint[]>();
    const update = () => {
      const container = map.getContainer().getBoundingClientRect();
      const images = [...map.getContainer().querySelectorAll<SVGSVGElement>('[data-vessel-hull]')];
      // Batch all geometry reads before positioning any labels.
      const measurements = entries.flatMap(entry => {
        const image = images.find(image => image.dataset.vesselHull === entry.vessel.id);
        if (!image) return [];
        const outline = image.querySelector<SVGGeometryElement>('path');
        const matrix = outline?.getScreenCTM();
        if (!outline || !matrix) return [];
        let points = outlines.get(outline);
        if (!points) {
          const length = outline.getTotalLength();
          points = Array.from({ length: Math.ceil(length) + 1 }, (_, index) => outline.getPointAtLength(Math.min(index, length)));
          outlines.set(outline, points);
        }
        let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
        for (const point of points) {
          const screen = point.matrixTransform(matrix);
          left = Math.min(left, screen.x); right = Math.max(right, screen.x);
          top = Math.min(top, screen.y); bottom = Math.max(bottom, screen.y);
        }
        // Include the 1.5-unit SVG outline, transformed into screen pixels.
        const strokeX = 0.75 * Math.hypot(matrix.a, matrix.c);
        const strokeY = 0.75 * Math.hypot(matrix.b, matrix.d);
        return [{ entry, hull: { x: left - strokeX - container.left, y: top - strokeY - container.top, width: right - left + 2 * strokeX, height: bottom - top + 2 * strokeY }, size: { width: entry.label.offsetWidth, height: entry.label.offsetHeight } }];
      });
      const occupied: LabelRect[] = measurements.map(item => item.hull);
      for (const { entry, hull, size } of measurements) {
        const placement = placeVesselLabel(hull, size, container, occupied, entry.side);
        occupied.push(placement);
        entry.side = placement.side;
        entry.label.style.transform = `translate(${placement.x}px, ${placement.y}px)`;
        const centerX = hull.x + hull.width / 2, centerY = hull.y + hull.height / 2;
        const endX = Math.max(placement.x, Math.min(centerX, placement.x + size.width));
        const endY = Math.max(placement.y, Math.min(centerY, placement.y + size.height));
        const dx = endX - centerX, dy = endY - centerY;
        const factor = Math.min(dx ? hull.width / 2 / Math.abs(dx) : Infinity, dy ? hull.height / 2 / Math.abs(dy) : Infinity);
        const normalBelow = placement.side === 'below' && Math.abs(placement.y - hull.y - hull.height - 14) < 1;
        entry.line.style.visibility = normalBelow ? 'hidden' : 'visible';
        entry.path.setAttribute('d', `M${centerX + dx * factor} ${centerY + dy * factor}L${endX} ${endY}`);
      }
    };
    const unsubscribe = vessels.map(vessel => vessel.simulation.subscribeFrames(update));
    map.on('move', update);
    map.on('resize', update);
    update();
    return () => {
      unsubscribe.forEach(cleanup => cleanup());
      map.off('move', update);
      map.off('resize', update);
      entries.forEach(({ label, line }) => { label.remove(); line.remove(); });
    };
  }, [map, isLoaded, vessels]);
  return <div ref={root} className='vessel-identities' aria-hidden='true' />;
}
