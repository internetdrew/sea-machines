import { useCallback } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Drawer } from '@base-ui/react/drawer';

/** Mobile presentation only; mission state and planner content live in MissionDrawer. */
export function MissionMobileDrawer({ children, compact, onToggle, finalFocus, compactHeight, expandedHeight, choosingType, onCompactHeightChange, onExpandedHeightChange }: {
  children: ReactNode;
  compactHeight: number;
  expandedHeight: number;
  onExpandedHeightChange: (height: number) => void;
  choosingType: boolean;
  onCompactHeightChange: (height: number) => void;
  compact: boolean;
  onToggle: () => void;
  finalFocus: () => HTMLElement | false;
}) {
  const measureContent = useCallback((popup: HTMLDivElement | null) => {
    const viewport = popup?.parentElement;
    if (!popup || !viewport) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const content = popup.querySelector('.mission-drawer-content');
      const header = content?.querySelector(':scope > header');
      const body = content?.querySelector('.mission-drawer-body');
      const footer = content?.querySelector(':scope > footer');
      const handle = popup.querySelector('[data-mission-handle]');
      if (!header || !handle) return;
      const height = (element: Element | null | undefined) => element?.getBoundingClientRect().height ?? 0;
      const chrome = height(handle) + height(header) + 2;
      const style = getComputedStyle(viewport);
      const available = viewport.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      const full = Math.min(Math.ceil(chrome + height(body) + height(footer)), available);
      onExpandedHeightChange(full);
      onCompactHeightChange(Math.min(Math.ceil(chrome + (choosingType ? height(body) : 0)), full));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    const observeSections = () => {
      observer.disconnect();
      observer.observe(viewport);
      popup.querySelectorAll('header, footer, .mission-drawer-body, [data-mission-handle]').forEach(element => observer.observe(element));
      schedule();
    };
    const mutations = new MutationObserver(observeSections);
    mutations.observe(popup, { childList: true, subtree: true, characterData: true });
    observeSections();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      mutations.disconnect();
    };
  }, [choosingType, onCompactHeightChange, onExpandedHeightChange]);
  return (
    <Drawer.Viewport className='mission-mobile-viewport pointer-events-none fixed inset-0 z-60 flex items-end'>
      <Drawer.Popup
        ref={measureContent}
        style={{ '--mission-frame-height': `${expandedHeight}px` } as CSSProperties}
        data-expanded-height={expandedHeight}
        data-compact-height={compactHeight}
        data-choosing-type={choosingType || undefined}
        finalFocus={finalFocus}
        data-compact={compact || undefined}
        className='dark mission-drawer-popup mission-mobile-popup pointer-events-auto relative flex w-full flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900 text-foreground shadow-[0_-8px_32px_rgba(0,0,0,0.24)] outline-none'
      >
        <button
          data-mission-handle
          type='button'
          aria-label={compact ? 'Expand mission details' : 'Collapse mission details'}
          aria-expanded={!compact}
          onClick={onToggle}
          className='flex min-h-11 w-full shrink-0 cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-white'
        >
          <span aria-hidden='true' className='h-1 w-10 rounded-full bg-neutral-600' />
        </button>
        <Drawer.Content className='mission-drawer-content relative flex min-h-0 flex-1 flex-col overflow-hidden'>
          {children}
        </Drawer.Content>
      </Drawer.Popup>
    </Drawer.Viewport>
  );
}
