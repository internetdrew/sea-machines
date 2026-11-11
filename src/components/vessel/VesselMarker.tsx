import { useRef, useState, useSyncExternalStore } from 'react';
import type { RefObject } from 'react';
import type { Marker } from 'maplibre-gl';
import { Drawer } from '@base-ui/react/drawer';
import { Popover } from '@base-ui/react/popover';
import { MapMarker, MarkerContent } from '@/components/ui/map';
import { useFleetInteraction, useFleetInteractions } from '@/lib/vessel/use-interactions';
import { selectActiveVesselId, selectPlanningVesselId } from '@/lib/vessel/interactions';
import { getVesselIdentity, isMissionInProgress } from '@/lib/vessel/vessel';
import { getFuelAppearance } from '@/lib/vessel/fuel';
import boat from '@/assets/boat.svg?raw';
import selkie from '@/assets/patrol-boat.svg?raw';
import { VesselActionsPopover } from './VesselActionsPopover';
import type { VesselActionsProps } from './VesselActionsPopover';

type Props = Omit<VesselActionsProps, 'markerButton' | 'onOpenDrawer' | 'resolveFinalFocus'> & {
  marker: RefObject<Marker | null>;
  missionMarker: RefObject<Marker | null>;
};

const mobileQuery = '(max-width: 639px)';
const subscribeMobile = (notify: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const getMobile = () => window.matchMedia(mobileQuery).matches;


export function VesselMarker({ vessel, missionDrawer, activityDrawer, marker, missionMarker }: Props) {
  const warningCount = vessel.fuelTanks.filter(tank => tank.capacityLiters > 0 && getFuelAppearance(Math.max(0, Math.min(100, tank.remainingLiters / tank.capacityLiters * 100))).label !== 'Normal').length;
  const compactSnapPoint = `${104 + warningCount * 48}px`;
  const vesselSnapPoints = [compactSnapPoint, '344px', 1];
  const mobile = useSyncExternalStore(subscribeMobile, getMobile, () => false);
  const [snapPoint, setSnapPoint] = useState<Drawer.Root.SnapPoint | null>('344px');
  const Root = mobile ? Drawer.Root : Popover.Root;
  const Trigger = mobile ? Drawer.Trigger : Popover.Trigger;
  const { simulation } = vessel;
  const [initialFrame] = useState(() => simulation.getFrame());
  const interactions = useFleetInteractions();
  const popoverOpen = useFleetInteraction(state => state.popoverVesselId === vessel.id);
  const selected = useFleetInteraction(state => selectActiveVesselId(state) === vessel.id);
  const selectionDisabled = useFleetInteraction(state => selectPlanningVesselId(state) !== null);
  const missionActive = useSyncExternalStore(simulation.subscribe, () => isMissionInProgress(simulation.getSnapshot()));
  const [markerHovered, setMarkerHovered] = useState(false);
  const [markerFocused, setMarkerFocused] = useState(false);
  const openingDrawer = useRef(false);
  const markerButton = useRef<HTMLButtonElement | null>(null);
  return (
    <Root
      {...(mobile ? {
        modal: false,
        disablePointerDismissal: true,
        snapPoints: vesselSnapPoints,
        snapToSequentialPoints: true,
        snapPoint,
        onSnapPointChange: setSnapPoint,
        onOpenChangeComplete: (open: boolean) => { if (!open) setSnapPoint('344px'); },
      } : {})}
      open={popoverOpen && !selectionDisabled}
      onOpenChange={open => {
        if (open && selectionDisabled) return;
        if (open) {
          openingDrawer.current = false;
        }
        interactions.dispatch({ type: open ? 'open-actions' : 'close-actions', vesselId: vessel.id });
      }}
    >
      <MapMarker
        ref={missionMarker}
        longitude={initialFrame.position[0]}
        latitude={initialFrame.position[1]}
        rotationAlignment='viewport'
        pitchAlignment='viewport'
        subpixelPositioning
      >
        <MarkerContent className='pointer-events-none'>
          {missionActive ? (
            <svg
              aria-hidden='true'
              width='108'
              height='108'
              viewBox='0 0 144 144'
              fill='none'
              className='vessel-mission-brackets'
              data-engaged={markerHovered || markerFocused || selected}
            >
              <path
                d='M24 2H2V24M120 2H142V24M2 120V142H24M120 142H142V120'
                stroke='currentColor'
                strokeWidth='3'
              />
            </svg>
          ) : (
            <span />
          )}
        </MarkerContent>
      </MapMarker>
      <MapMarker
        ref={marker}
        longitude={initialFrame.position[0]}
        latitude={initialFrame.position[1]}
        rotation={initialFrame.heading}
        rotationAlignment='map'
        pitchAlignment='map'
        subpixelPositioning
      >
        <MarkerContent>
          <Trigger
            ref={markerButton}
            disabled={selectionDisabled}
            aria-describedby={selectionDisabled ? 'vessel-selection-status' : undefined}
            aria-label={`Show ${getVesselIdentity(vessel)} actions`}
            onPointerEnter={event => {
              if (event.pointerType === 'mouse' || event.pointerType === 'pen')
                setMarkerHovered(true);
            }}
            onPointerLeave={() => setMarkerHovered(false)}
            onPointerCancel={() => setMarkerHovered(false)}
            onFocus={event => {
              const focused = event.currentTarget.matches(':focus-visible');
              setMarkerFocused(focused);
            }}
            onBlur={() => setMarkerFocused(false)}
            className='block cursor-pointer disabled:cursor-default rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'
          >
            <svg
              data-vessel-hull={vessel.id}
              data-selected={selected}
              data-unavailable={selectionDisabled && !selected}
              viewBox='0 0 100 220'
              aria-hidden='true'
              dangerouslySetInnerHTML={{
                __html: (vessel.series.silhouette === 'selkie'
                  ? selkie
                  : boat
                ).replace(/<svg[^>]*>|<\/svg>|<title>[\s\S]*?<\/title>/g, ''),
              }}
              className='h-24 w-auto drop-shadow-lg data-[unavailable=true]:opacity-[0.38] data-[unavailable=false]:data-[selected=false]:hover:[&>path]:stroke-neutral-100/80 data-[selected=true]:[&>path]:stroke-[#f5e835]'
            />
          </Trigger>
        </MarkerContent>
        <VesselActionsPopover compactSnapPoint={compactSnapPoint} mobile={mobile} snapPoint={snapPoint} onSnapPointChange={setSnapPoint} vessel={vessel} missionDrawer={missionDrawer} activityDrawer={activityDrawer} markerButton={markerButton} onOpenDrawer={() => { openingDrawer.current = true; }} resolveFinalFocus={() => openingDrawer.current || (interactions.getSnapshot().popoverVesselId !== null && interactions.getSnapshot().popoverVesselId !== vessel.id) ? false : markerButton.current ?? false} />
      </MapMarker>
    </Root>
  );
}
