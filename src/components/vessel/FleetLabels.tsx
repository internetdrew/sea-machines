import { useFleetInteraction } from '@/lib/vessel/use-interactions';
import { selectPlanningVesselId } from '@/lib/vessel/interactions';
import { useLayoutEffect, useRef } from 'react';
import { useMap } from '@/components/ui/map';
import { placeVesselLabel, relativeLabelRect } from '@/lib/vessel/label-placement';
import type { LabelRect, LabelSide } from '@/lib/vessel/label-placement';
import type { Vessel } from '@/lib/vessel/vessel';

// Separate viewport overlay: vessel headings never rotate the identity text.
export function FleetLabels({ vessels }: { vessels: readonly Vessel[] }) {
  const planningVesselId = useFleetInteraction(selectPlanningVesselId);
  const lockedVesselId = planningVesselId;
  const { map, isLoaded } = useMap();
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!map || !isLoaded || !root.current) return;
    const overlay = root.current;
    const entries = vessels.map(vessel => {
      const label = document.createElement('div');
      label.className = 'vessel-identity';
      label.dataset.vesselId = vessel.id;
      const content = document.createElement('div');
      content.className = 'vessel-identity-content';
      const fleetId = document.createElement('span');
      fleetId.textContent = vessel.id;
      const series = document.createElement('span');
      series.className = 'vessel-identity-series';
      series.textContent = vessel.series.label;
      content.append(fleetId, series);
      label.append(content);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      line.classList.add('vessel-identity-leader');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.append(path);
      overlay.append(line, label);
      return { vessel, label, line, path, side: 'below' as LabelSide };
    });
    const update = () => {
      const overlayBounds = overlay.getBoundingClientRect();
      const viewport = { width: overlay.clientWidth, height: overlay.clientHeight };
      if (!overlayBounds.width || !overlayBounds.height) return;
      const images = [...map.getContainer().querySelectorAll<SVGSVGElement>('[data-vessel-hull]')];
      // Batch all geometry reads before positioning any labels.
      const measurements = entries.flatMap(entry => {
        const image = images.find(image => image.dataset.vesselHull === entry.vessel.id);
        if (!image) return [];
        const outline = image.querySelector<SVGGeometryElement>('path');
        if (!outline) return [];
        // Use rendered CSS bounds, not SVG screen matrices: ancestor transforms
        // and zoom are not represented consistently by getScreenCTM in WebKit.
        const bounds = relativeLabelRect(outline.getBoundingClientRect(), overlayBounds, viewport);
        // A small inset allowance includes the hull stroke in collision checks.
        const hull = { x: bounds.x - 1, y: bounds.y - 1, width: bounds.width + 2, height: bounds.height + 2 };
        return [{ entry, hull, size: { width: entry.label.offsetWidth, height: entry.label.offsetHeight } }];
      });
      const occupied: LabelRect[] = measurements.map(item => item.hull);
      for (const { entry, hull, size } of measurements) {
        const placement = placeVesselLabel(hull, size, viewport, occupied, entry.side);
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
    // Coalesce telemetry/resize notifications and read after marker DOM writes.
    let pendingFrame = 0;
    const scheduleUpdate = () => {
      if (pendingFrame) return;
      pendingFrame = requestAnimationFrame(() => { pendingFrame = 0; update(); });
    };
    const rendered = () => {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
      update();
    };
    const unsubscribe = vessels.map(vessel => vessel.simulation.subscribeFrames(scheduleUpdate));
    map.on('render', rendered);
    map.on('resize', scheduleUpdate);
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    entries.forEach(({ label }) => resizeObserver.observe(label));
    update();
    return () => {
      resizeObserver.disconnect();
      unsubscribe.forEach(cleanup => cleanup());
      cancelAnimationFrame(pendingFrame);
      map.off('render', rendered);
      map.off('resize', scheduleUpdate);
      entries.forEach(({ label, line }) => { label.remove(); line.remove(); });
    };
  }, [map, isLoaded, vessels]);
  useLayoutEffect(() => {
    if (!root.current) return;
    // Preserve the badge nodes; only their content and target dimensions change.
    const labels = [...root.current.querySelectorAll<HTMLElement>('.vessel-identity')];
    const targets = labels.flatMap(label => {
      const vessel = vessels.find(vessel => vessel.id === label.dataset.vesselId);
      const content = label.querySelector<HTMLElement>('.vessel-identity-content');
      const series = label.querySelector<HTMLElement>('.vessel-identity-series');
      if (!vessel || !content || !series) return [];
      label.dataset.unavailable = String(lockedVesselId !== null && lockedVesselId !== vessel.id);
      series.textContent = vessel.series.label + (planningVesselId === vessel.id ? ' · Planning' : '');
      return [{ label, content }];
    });
    const sizes = targets.map(({ label, content }) => ({ label, width: content.offsetWidth + 18, height: content.offsetHeight + 12 }));
    sizes.forEach(({ label, width, height }) => {
      label.style.width = `${width}px`;
      label.style.height = `${height}px`;
    });
  }, [map, isLoaded, vessels, planningVesselId, lockedVesselId]);
  return <div ref={root} className='vessel-identities' aria-hidden='true' />;
}
