'use client';

import { CLOSE_BUTTON_CLASS } from '@/components/CloseButton';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Popover } from '@base-ui/react/popover';
import { X } from 'lucide-react';
import { VesselHoverCard } from './VesselHoverCard';
import { ActiveMissionLayer } from './ActiveMissionLayer';
import type { Marker } from 'maplibre-gl';
import { MapMarker, MarkerContent, useMap } from '@/components/ui/map';
import boat from '@/assets/boat.svg?raw';
import selkie from '@/assets/patrol-boat.svg?raw';
import { createVesselRenderer } from './renderer';
import type { VesselDisplayOptions } from './renderer';
import { Drawer } from '@base-ui/react/drawer';
import type { MissionDrawerPayload } from './MissionDrawer';
import { getVesselIdentity, isMissionInProgress } from '@/lib/vessel/vessel';
import type { Vessel } from '@/lib/vessel/vessel';

type Props = VesselDisplayOptions & {
  vessel: Vessel;
  selected: boolean;
  planning: boolean;
  selectionDisabled: boolean;
  onSelectionChange: (id: string, open: boolean) => void;
  missionDrawer: Drawer.Handle<MissionDrawerPayload>;
  onPan: () => void;
};

export function VesselLayer({
  vessel,
  selected,
  planning,
  selectionDisabled,
  onSelectionChange,
  missionDrawer,
  follow,
  showRangeRings,
  onPan,
}: Props) {
  const { map, mapLib, isLoaded } = useMap();
  const { simulation } = vessel;
  const [initialFrame] = useState(() => simulation.getFrame());
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [markerHovered, setMarkerHovered] = useState(false);
  const [markerFocused, setMarkerFocused] = useState(false);
  const openingDrawer = useRef(false);
  const markerButton = useRef<HTMLButtonElement | null>(null);
  const marker = useRef<Marker | null>(null);
  const missionMarker = useRef<Marker | null>(null);
  const renderer = useRef<ReturnType<typeof createVesselRenderer> | null>(null);
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );

  const missionActive = isMissionInProgress(snapshot);

  useEffect(() => {
    if (
      !map ||
      !mapLib ||
      !isLoaded ||
      !marker.current ||
      !missionMarker.current
    )
      return;
    const instance = createVesselRenderer(
      map,
      mapLib,
      simulation,
      {
        marker: marker.current,
        missionMarker: missionMarker.current,
      },
      { follow: false, showRangeRings: false },
      onPan,
    );
    renderer.current = instance;
    return () => {
      instance.destroy();
      renderer.current = null;
    };
  }, [map, mapLib, isLoaded, simulation, onPan]);

  useEffect(() => {
    renderer.current?.setOptions({ follow, showRangeRings });
  }, [map, mapLib, isLoaded, follow, showRangeRings]);

  return (
    <Popover.Root
      open={popoverOpen && !selectionDisabled}
      onOpenChange={open => {
        if (open && selectionDisabled) return;
        if (open) {
          openingDrawer.current = false;
        }
        setPopoverOpen(open);
        onSelectionChange(vessel.id, open);
      }}
    >
      <ActiveMissionLayer vesselId={vessel.id} frame={snapshot} />
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
          <Popover.Trigger
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
          </Popover.Trigger>
        </MarkerContent>
        <Popover.Portal>
          <Popover.Positioner
            side='right'
            sideOffset={20}
            collisionPadding={12}
            className='z-50 data-anchor-hidden:invisible'
          >
            <Popover.Popup
              finalFocus={() =>
                openingDrawer.current ? false : (markerButton.current ?? false)
              }
              className='relative w-72 max-w-[calc(100vw-24px)] max-h-[calc(100dvh-24px)] overflow-y-auto origin-(--transform-origin) rounded-lg border border-white/10 bg-[#1d2123] p-4.5 text-sm text-neutral-100 shadow-[0_8px_24px_rgba(0,0,0,0.22)] outline-none transition-[scale,opacity] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 motion-reduce:transition-none'
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
                <Drawer.Trigger
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
                    openingDrawer.current = true;
                    setPopoverOpen(false);
                  }}
                  className={`flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md px-3 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${planning ? 'bg-[#2b3033] text-neutral-200 hover:bg-[#353b3f]' : 'bg-neutral-100 text-neutral-950 hover:bg-white'}`}
                >
                  {isMissionInProgress(snapshot)
                    ? 'View mission'
                    : 'Plan a mission'}
                </Drawer.Trigger>
              </footer>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </MapMarker>
    </Popover.Root>
  );
}
