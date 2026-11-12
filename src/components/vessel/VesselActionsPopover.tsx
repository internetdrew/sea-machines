import { useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import { CLOSE_BUTTON_CLASS } from '@/components/CloseButton';
import { VesselActionsDrawer } from './VesselActionsDrawer';
import { useVesselDrawerState } from '@/lib/vessel/drawer-context';
import { VesselCardHeader, VesselHoverCard } from './VesselHoverCard';
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

export function VesselActionsPopover(props: VesselActionsProps & { mobile: boolean; }) {
  return props.mobile
    ? <Drawer.Portal><VesselActionsContent {...props} /></Drawer.Portal>
    : <Popover.Portal><VesselActionsContent {...props} /></Popover.Portal>;
}

function VesselActionsContent({ mobile, vessel, missionDrawer, activityDrawer, markerButton, onOpenDrawer, resolveFinalFocus }: VesselActionsProps & { mobile: boolean; }) {
  const view = useVesselDrawerState()?.view ?? 'full';
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
  const closeAction = (
    <Close
      aria-label='Close vessel actions'
      className={`${CLOSE_BUTTON_CLASS} ${mobile ? 'min-h-11 min-w-11' : ''}`}
    >
      <X className='size-4' />
    </Close>
  );
  const header = <VesselCardHeader vessel={vessel} snapshot={snapshot} headerAction={closeAction} />;
  const card = (
    <VesselHoverCard
      vessel={vessel}
      snapshot={snapshot}
      detailLevel={mobile ? view : 'full'}
      showHeader={!mobile}
      headerAction={closeAction}
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
      <div className={mobile ? 'w-[46.5%] min-w-0 shrink-0 pl-2' : 'pt-2'}>
        <Drawer.Trigger
          data-vessel-id={vessel.id}
          handle={activityDrawer}
          payload={{ vesselId: vessel.id, returnFocus: markerButton }}
          onClick={onOpenDrawer}
          className='mission-cta flex min-h-11 w-full cursor-pointer items-center justify-center rounded-md bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
        >
          View activity
        </Drawer.Trigger>
      </div>
    </footer>
  );
  if (mobile) return <VesselActionsDrawer {...{ vessel, snapshot, header, card, actions, resolveFinalFocus }} />;
  return (
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
  );
}
