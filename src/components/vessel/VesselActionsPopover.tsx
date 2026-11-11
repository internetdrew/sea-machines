import { useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
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

export function VesselActionsPopover({ vessel, missionDrawer, activityDrawer, markerButton, onOpenDrawer, resolveFinalFocus }: VesselActionsProps) {
  const { simulation } = vessel;
  const snapshot = useSyncExternalStore(simulation.subscribe, simulation.getSnapshot);
  const planning = useFleetInteraction(state => selectPlanningVesselId(state) !== null);
  const missionDrawerOpen = useFleetInteraction(state => state.missionPanel?.vesselId === vessel.id);
  return (
        <Popover.Portal>
          <Popover.Positioner
            side='right'
            sideOffset={20}
            collisionPadding={12}
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
              <VesselHoverCard
                vessel={vessel}
                snapshot={snapshot}
                headerAction={
                  <Popover.Close
                    aria-label='Close vessel actions'
                    className={CLOSE_BUTTON_CLASS}
                  >
                    <X className='size-4' />
                  </Popover.Close>
                }
              />
              <footer className='mt-4.5 flex flex-col gap-2 border-t border-white/5 pt-3.5'>
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
                    if (
                      snapshot.phase === 'complete' ||
                      snapshot.phase === 'aborted'
                    )
                      simulation.clearFinishedMission();
                    onOpenDrawer();
                  }}
                  className={`flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${planning ? 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700' : 'bg-neutral-100 text-neutral-950 hover:bg-white'}`}
                >
                  {isMissionInProgress(snapshot)
                    ? 'View mission'
                    : 'Plan a mission'}
                </Drawer.Trigger>
                <Drawer.Trigger data-vessel-id={vessel.id} handle={activityDrawer} payload={{ vesselId: vessel.id, returnFocus: markerButton }} onClick={onOpenDrawer} className='mission-cta flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'>View activity</Drawer.Trigger>
              </footer>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
  );
}
