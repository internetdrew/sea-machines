import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { MapMouseEvent } from 'maplibre-gl';
import { useMap } from '@/components/ui/map';

/** Cursor feedback stays outside React's render cycle and writes at most once per frame. */
export function MissionPlacementCursor({ label }: { label: string }) {
  const { map } = useMap();
  const position = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const value = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const wrapper = position.current;
    const callout = panel.current;
    const text = value.current;
    if (!map || !wrapper || !callout || !text) return;
    const container = map.getContainer();
    let width = container.clientWidth, height = container.clientHeight;
    let calloutWidth = 240, calloutHeight = 72;
    let pending: MapMouseEvent | null = null;
    let frame = 0;
    const sizes = new ResizeObserver(entries => {
      for (const entry of entries) {
        const size = entry.borderBoxSize[0];
        if (!size) continue;
        if (entry.target === container) {
          width = size.inlineSize; height = size.blockSize;
        } else {
          calloutWidth = size.inlineSize; calloutHeight = size.blockSize;
        }
      }
    });
    sizes.observe(container);
    sizes.observe(callout);
    const render = () => {
      frame = 0;
      if (!pending) return;
      const { point, lngLat } = pending;
      pending = null;
      const coordinate = `${Math.abs(lngLat.lat).toFixed(4)}° ${lngLat.lat >= 0 ? 'N' : 'S'}, ${Math.abs(lngLat.lng).toFixed(4)}° ${lngLat.lng >= 0 ? 'E' : 'W'}`;
      if (text.textContent !== coordinate) text.textContent = coordinate;
      wrapper.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`;
      callout.style.transform = `translate(${point.x + calloutWidth + 10 > width ? 'calc(-100% - 10px)' : '10px'}, ${point.y + calloutHeight + 10 > height ? 'calc(-100% - 10px)' : '10px'})`;
      wrapper.style.visibility = 'visible';
    };
    const move = (event: MapMouseEvent) => {
      pending = event;
      if (!frame) frame = requestAnimationFrame(render);
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      pending = null;
      wrapper.style.visibility = 'hidden';
    };
    map.on('mousemove', move);
    map.on('mouseout', leave);
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      map.off('mousemove', move);
      map.off('mouseout', leave);
    };
  }, [map]);

  return map ? createPortal(
    <div ref={position} aria-hidden='true' className='pointer-events-none invisible absolute top-0 left-0 z-70'>
      <div ref={panel} className='whitespace-nowrap rounded-md border border-teal-400/30 bg-neutral-900 px-2.5 py-2 text-neutral-100 shadow-md'>
        <span className='mb-1 block text-[9px] font-medium uppercase tracking-[0.09em] text-teal-300'>{label}</span>
        <span ref={value} className='block font-mono text-xs tabular-nums'>00.0000° N, 000.0000° W</span>
      </div>
    </div>, map.getContainer(),
  ) : null;
}
