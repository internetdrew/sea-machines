import { useSyncExternalStore } from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import type { ReactNode, RefObject } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Drawer } from '@base-ui/react/drawer';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { CLOSE_BUTTON_CLASS } from '@/components/CloseButton';
import { VesselHoverCard } from './VesselHoverCard';
import { useFleetInteraction } from '@/lib/vessel/use-interactions';
import { selectPlanningVesselId } from '@/lib/vessel/interactions';
import { getVesselIdentity, isMissionInProgress } from '@/lib/vessel/vessel';
import type { Vessel } from '@/lib/vessel/vessel';
import type { MissionDrawerPayload } from './MissionDrawer';
import type { ActivityPayload } from './ActivityDrawer';

export type VesselActionsProps = {
  vessel: Vessel;
  missionDrawer: Drawer.Handle<MissionDrawerPayload>;
  activityDrawer: Drawer.Handle<ActivityPayload>;
  markerButton: RefObject<HTMLButtonElement | null>;
  onOpenDrawer: () => void;
  resolveFinalFocus: () => HTMLButtonElement | false;
};

const CTA_TRANSITION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] as const };

function ActivityAction({
  children,
  reducedMotion,
  horizontal,
}: {
  children: ReactNode;
  reducedMotion: boolean;
  horizontal: boolean;
}) {
  const present = useIsPresent();
  return (
    <motion.div
      className={
        horizontal
          ? 'w-[46.5%] min-w-0 shrink-0 overflow-hidden'
          : 'overflow-hidden'
      }
      inert={!present}
      aria-hidden={!present || undefined}
      initial={reducedMotion || horizontal ? false : { height: 0, opacity: 0 }}
      animate={horizontal ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
      exit={horizontal ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={reducedMotion ? { duration: 0 } : CTA_TRANSITION}
    >
      <motion.div
        className={horizontal ? 'pl-2' : 'pt-2'}
        initial={reducedMotion || horizontal ? false : { y: 4 }}
        animate={{ y: 0 }}
        exit={{ y: horizontal ? 0 : 4 }}
        transition={reducedMotion ? { duration: 0 } : CTA_TRANSITION}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function VesselActionsPopover({
  compactSnapPoint = '104px',
  mobile = false,
  snapPoint = '344px',
  onSnapPointChange,
  vessel,
  missionDrawer,
  activityDrawer,
  markerButton,
  onOpenDrawer,
  resolveFinalFocus,
}: VesselActionsProps & {
  compactSnapPoint?: string;
  mobile?: boolean;
  snapPoint?: Drawer.Root.SnapPoint | null;
  onSnapPointChange?: (point: Drawer.Root.SnapPoint) => void;
}) {
  const reducedMotion = useReducedMotion();
  const showActivity = !mobile || snapPoint !== compactSnapPoint;
  const { simulation } = vessel;
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );
  const planning = useFleetInteraction(
    state => selectPlanningVesselId(state) !== null,
  );
  const missionDrawerOpen = useFleetInteraction(
    state => state.missionPanel?.vesselId === vessel.id,
  );
  const Close = mobile ? Drawer.Close : Popover.Close;
  const card = (
    <VesselHoverCard
      vessel={vessel}
      snapshot={snapshot}
      detailLevel={
        mobile
          ? snapPoint === 1
            ? 'full'
            : snapPoint === compactSnapPoint
              ? 'compact'
              : 'summary'
          : 'full'
      }
      headerAction={
        <Close
          aria-label='Close vessel actions'
          className={`${CLOSE_BUTTON_CLASS} ${mobile ? 'min-h-11 min-w-11 -mt-3 -mr-3' : ''}`}
        >
          <X className='size-4' />
        </Close>
      }
    />
  );
  const actions = (
    <footer
      className={`vessel-actions-footer mt-4.5 flex border-t border-white/5 pt-3.5 ${mobile ? 'flex-row items-start' : 'flex-col'}`}
    >
      {/* Keep the trigger registered while Base UI captures its payload. */}
      <Drawer.Trigger
        hidden={missionDrawerOpen}
        data-vessel-id={vessel.id}
        handle={missionDrawer}
        payload={{
          vesselId: vessel.id,
          returnFocus: markerButton,
        }}
        onClick={() => {
          if (snapshot.phase === 'complete' || snapshot.phase === 'aborted')
            simulation.clearFinishedMission();
          onOpenDrawer();
        }}
        className={`flex min-h-11 w-full ${mobile ? 'min-w-0 flex-1' : ''} cursor-pointer items-center justify-center rounded-md px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${planning ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-950 hover:bg-white'}`}
      >
        {isMissionInProgress(snapshot) ? 'View mission' : 'Plan a mission'}
      </Drawer.Trigger>
      <AnimatePresence initial={false}>
        {showActivity && (
          <ActivityAction
            key='activity'
            reducedMotion={!!reducedMotion}
            horizontal={mobile}
          >
            <Drawer.Trigger
              data-vessel-id={vessel.id}
              handle={activityDrawer}
              payload={{ vesselId: vessel.id, returnFocus: markerButton }}
              onClick={onOpenDrawer}
              className='mission-cta flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
            >
              View activity
            </Drawer.Trigger>
          </ActivityAction>
        )}
      </AnimatePresence>
    </footer>
  );
  if (mobile)
    return (
      <Drawer.Portal>
        <Drawer.Viewport className='vessel-details-viewport pointer-events-none fixed inset-0 z-50 flex items-end justify-center'>
          <Drawer.Popup
            finalFocus={resolveFinalFocus}
            className='vessel-details-sheet pointer-events-auto relative flex w-full flex-col rounded-2xl border border-neutral-800 bg-neutral-900 text-sm text-neutral-100 shadow-[0_-8px_32px_rgba(0,0,0,0.24)] outline-none'
            data-level={
              snapPoint === 1
                ? 'full'
                : snapPoint === compactSnapPoint
                  ? 'compact'
                  : 'summary'
            }
          >
            <div className='shrink-0 px-5 pt-1'>
              <button
                type='button'
                aria-label={
                  snapPoint === compactSnapPoint
                    ? 'Expand vessel details'
                    : 'Collapse vessel details'
                }
                onClick={() =>
                  onSnapPointChange?.(
                    snapPoint === 1
                      ? '344px'
                      : snapPoint === compactSnapPoint
                        ? '344px'
                        : compactSnapPoint,
                  )
                }
                className='mx-auto flex h-8 w-16 cursor-pointer items-center justify-center rounded focus-visible:outline-2 focus-visible:outline-white'
              >
                <span
                  aria-hidden='true'
                  className='h-1 w-10 rounded-full bg-neutral-600'
                />
              </button>
              <Drawer.Title className='sr-only'>
                {getVesselIdentity(vessel)}
              </Drawer.Title>
              <Drawer.Description className='sr-only'>
                Vessel status and actions. Expand for position and fuel details.
              </Drawer.Description>
            </div>
            <Drawer.Content className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 touch-auto'>
              <div className='pb-4'>{card}</div>
            </Drawer.Content>
            {
              <div
                inert={snapPoint === compactSnapPoint}
                aria-hidden={snapPoint === compactSnapPoint || undefined}
                className='vessel-actions-dock px-5 pt-3 pb-4'
              >
                {actions}
                <button
                  type='button'
                  data-base-ui-swipe-ignore
                  onClick={() =>
                    onSnapPointChange?.(snapPoint === 1 ? '344px' : 1)
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
                      {snapPoint === 1 ? 'Show less' : 'Full vessel details'}
                    </span>
                    <AnimatePresence initial={false} mode='popLayout'>
                      <motion.span
                        key={snapPoint === 1 ? 'less' : 'details'}
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
                        {snapPoint === 1 ? 'Show less' : 'Full vessel details'}
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  {snapPoint === 1 ? (
                    <ChevronDown className='size-4' />
                  ) : (
                    <ChevronUp className='size-4' />
                  )}
                </button>
              </div>
            }
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    );
  return (
    <Popover.Portal>
      <Popover.Positioner
        side='right'
        sideOffset={20}
        collisionPadding={12}
        collisionAvoidance={{
          side: 'flip',
          align: 'shift',
          fallbackAxisSide: 'end',
        }}
        className='z-50 data-anchor-hidden:invisible'
      >
        <Popover.Popup
          finalFocus={resolveFinalFocus}
          className='relative w-72 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto origin-(--transform-origin) rounded-lg border border-neutral-800 bg-neutral-900 p-4.5 text-sm text-neutral-100 shadow-[0_8px_24px_rgba(0,0,0,0.22)] outline-none transition-[scale,opacity] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 motion-reduce:transition-none'
        >
          <Popover.Title className='sr-only'>
            {getVesselIdentity(vessel)}
          </Popover.Title>
          <Popover.Description className='sr-only'>
            Vessel awareness and actions
          </Popover.Description>
          {card}
          {actions}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );
}
