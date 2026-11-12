import { useCallback, useLayoutEffect, useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import useMeasure from 'react-use-measure';
import { Drawer } from '@base-ui/react/drawer';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { vesselDrawerSizes } from '@/lib/vessel/drawer-layout';
import type { VesselDrawerSizes } from '@/lib/vessel/drawer-layout';
import type { VesselFrame } from '@/lib/vessel/simulation';
import { getVesselIdentity, type Vessel } from '@/lib/vessel/vessel';
import { VesselCardContent } from './VesselHoverCard';
import { useVesselDrawerState } from '@/lib/vessel/drawer-context';

type Props = { vessel: Vessel; snapshot: VesselFrame; header: ReactNode; card: ReactNode; actions: ReactNode; resolveFinalFocus: () => HTMLButtonElement | false; };
export function VesselActionsDrawer({ vessel, snapshot, header, card, actions, resolveFinalFocus }: Props) {
  const state = useVesselDrawerState();
  if (!state) throw new Error('VesselActionsDrawer requires a mobile VesselActionsRoot');
  return <DrawerContent {...{ vessel, snapshot, header, card, actions, resolveFinalFocus }} {...state} />;
}
function DrawerContent({ vessel, snapshot, header, card, actions, resolveFinalFocus, view, sizes, setView, setSizes }: Props & NonNullable<ReturnType<typeof useVesselDrawerState>>) {
  const reducedMotion = useReducedMotion();
  // Measure inert natural layouts, never the animated/scroll-constrained frame.
  const [measureViewport, viewportBounds] = useMeasure({ offsetSize: true });
  const [measureChrome, chromeBounds] = useMeasure({ offsetSize: true });
  const [measureActions, actionsBounds] = useMeasure({ offsetSize: true });
  const [measureCompact, compactBounds] = useMeasure({ offsetSize: true });
  const [measureSummary, summaryBounds] = useMeasure({ offsetSize: true });
  const [measureFull, fullBounds] = useMeasure({ offsetSize: true });
  const viewportElement = useRef<HTMLDivElement | null>(null);
  const setViewport = useCallback((element: HTMLDivElement | null) => {
    viewportElement.current = element;
    measureViewport(element);
  }, [measureViewport]);

  useLayoutEffect(() => {
    const viewport = viewportElement.current;
    if (!viewport || !compactBounds.height || !summaryBounds.height || !fullBounds.height || !actionsBounds.height || !chromeBounds.height) return;
    const style = getComputedStyle(viewport);
    const available = viewportBounds.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    if (available <= 0) return;
    const next = vesselDrawerSizes({
      compact: compactBounds.height,
      summary: summaryBounds.height,
      full: fullBounds.height,
    }, chromeBounds.height, actionsBounds.height, available);
    if (!sizes || Object.keys(next).some(key => next[key as keyof VesselDrawerSizes] !== sizes[key as keyof VesselDrawerSizes])) setSizes(next);
  }, [compactBounds.height, summaryBounds.height, fullBounds.height, chromeBounds.height, actionsBounds.height, viewportBounds.height, sizes, setSizes]);

  return (
    <Drawer.Viewport ref={setViewport} className='vessel-details-viewport pointer-events-none fixed inset-0 z-50 flex items-end justify-center'>
      <Drawer.Popup
        finalFocus={resolveFinalFocus}
        className='vessel-details-sheet pointer-events-auto relative flex w-full flex-col rounded-2xl border border-neutral-800 bg-neutral-900 text-sm text-neutral-100 shadow-[0_-8px_32px_rgba(0,0,0,0.24)] outline-none'
        data-level={view}
        data-measuring={!sizes || undefined}
        style={{ '--vessel-frame-height': sizes ? `${sizes.full}px` : '100%', '--vessel-actions-height': sizes ? `${sizes.actions}px` : '0px', '--vessel-summary-offset': sizes ? `${sizes.full - sizes.summary}px` : '0px', '--vessel-chrome-height': `${chromeBounds.height}px` } as CSSProperties}
      >
        <div ref={measureChrome} className='shrink-0 px-5 pt-1'>
          <button
            type='button'
            aria-label={
              view === 'compact'
                ? 'Expand vessel details'
                : 'Collapse vessel details'
            }
            onClick={() =>
              setView(view === 'summary' ? 'compact' : 'summary')
            }
            className='mx-auto flex h-8 w-16 cursor-pointer items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-white'
          >
            <span
              aria-hidden='true'
              className='h-1 w-10 rounded-full bg-neutral-600'
            />
          </button>
          <div className='vessel-details-header py-2'>{header}</div>
          <Drawer.Title className='sr-only'>
            {getVesselIdentity(vessel)}
          </Drawer.Title>
          <Drawer.Description className='sr-only'>
            Vessel status and actions. Expand for position and fuel details.
          </Drawer.Description>
        </div>
        <div className='vessel-details-body min-h-0 flex-1'>
          <Drawer.Content className='vessel-details-scroll h-full overflow-y-auto overscroll-contain px-5 touch-auto'>
            <div className='pb-4'>{card}</div>
          </Drawer.Content>
        </div>
        <div
          ref={measureActions}
          inert={view === 'compact'}
          aria-hidden={view === 'compact' || undefined}
          className='vessel-actions-dock px-5 pt-3 pb-4'
        >
          {actions}
          <button
            type='button'
            data-base-ui-swipe-ignore
            onClick={() =>
              setView(view === 'full' ? 'summary' : 'full')
            }
            className='flex min-h-11 w-full items-center justify-center gap-1 text-xs text-neutral-400 focus-visible:outline-2 focus-visible:outline-white'
          >
            <span className='relative inline-grid'>
              <span
                aria-hidden='true'
                className='invisible col-start-1 row-start-1 whitespace-nowrap'
              >
                Full vessel details
              </span>
              <span className='sr-only'>
                {view === 'full' ? 'Show less' : 'Full vessel details'}
              </span>
              <AnimatePresence initial={false} mode='popLayout'>
                <motion.span
                  key={view === 'full' ? 'less' : 'details'}
                  aria-hidden='true'
                  className='absolute inset-0 text-center whitespace-nowrap'
                  initial={
                    reducedMotion
                      ? false
                      : { opacity: 0, filter: 'blur(1px)' }
                  }
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{
                    opacity: 0,
                    filter: reducedMotion ? 'blur(0px)' : 'blur(1px)',
                  }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.14,
                    ease: 'easeOut',
                  }}
                >
                  {view === 'full' ? 'Show less' : 'Full vessel details'}
                </motion.span>
              </AnimatePresence>
            </span>
            {view === 'full' ? (
              <ChevronDown className='size-4' />
            ) : (
              <ChevronUp className='size-4' />
            )}
          </button>
        </div>
        <div aria-hidden='true' inert className='vessel-measurements pointer-events-none absolute inset-x-0 top-0 invisible text-sm'>
          {(['compact', 'summary', 'full'] as const).map(level => (
            <div key={level} ref={level === 'compact' ? measureCompact : level === 'summary' ? measureSummary : measureFull} className='vessel-details-measure px-5 pb-4' data-level={level}>
              <VesselCardContent vessel={vessel} snapshot={snapshot} detailLevel={level} showHeader={false} />
            </div>
          ))}
        </div>
      </Drawer.Popup>
    </Drawer.Viewport>
  );
}
