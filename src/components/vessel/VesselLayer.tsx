'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Popover } from '@base-ui/react/popover';
import { X } from 'lucide-react';
import { VesselFuel } from './VesselFuel';
import { VesselTelemetry } from './VesselTelemetry';
import { VesselHoverCard } from './VesselHoverCard';
import { ActiveMissionLayer } from './ActiveMissionLayer';
import type { Marker, Popup } from 'maplibre-gl';
import {
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from '@/components/ui/map';
import boat from '@/assets/boat.svg?raw';
import selkie from '@/assets/patrol-boat.svg?raw';
import { createVesselRenderer } from './renderer';
import type { VesselDisplayOptions } from './renderer';
import { Drawer } from '@base-ui/react/drawer';
import type { MissionDrawerPayload } from './MissionDrawer';
import {
  getVesselDisplayName,
  getVesselIdentity,
  getVesselActivity,
  isMissionInProgress,
} from '@/lib/vessel/vessel';
import type { Vessel } from '@/lib/vessel/vessel';

type Props = VesselDisplayOptions & {
  vessel: Vessel;
  missionDrawer: Drawer.Handle<MissionDrawerPayload>;
  onPan: () => void;
};

export function VesselLayer({
  vessel,
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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const marker = useRef<Marker | null>(null);
  const missionMarker = useRef<Marker | null>(null);
  const tooltip = useRef<Popup | null>(null);
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
      !missionMarker.current ||
      !tooltip.current
    )
      return;
    const instance = createVesselRenderer(
      map,
      mapLib,
      simulation,
      {
        marker: marker.current,
        missionMarker: missionMarker.current,
        tooltip: tooltip.current,
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
      open={popoverOpen}
      onOpenChange={open => {
        if (open) {
          openingDrawer.current = false;
          setDetailsOpen(false);
          setCopyState('idle');
          tooltip.current?.remove();
        }
        setPopoverOpen(open);
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
              data-engaged={markerHovered || markerFocused || popoverOpen}
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
            className='block cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'
          >
            <svg
              data-vessel-hull={vessel.id}
              viewBox='0 0 100 220'
              aria-hidden='true'
              dangerouslySetInnerHTML={{ __html: (vessel.series.silhouette === 'selkie' ? selkie : boat).replace(/<svg[^>]*>|<\/svg>|<title>[\s\S]*?<\/title>/g, '') }}
              className='h-24 w-auto drop-shadow-lg'
            />
          </Popover.Trigger>
        </MarkerContent>
        <MarkerTooltip
          ref={tooltip}
          className={popoverOpen ? 'hidden' : undefined}
          variant='card'
          placement='beside'
          offset={74}
          subpixelPositioning
        >
          <VesselHoverCard vessel={vessel} snapshot={snapshot} />
        </MarkerTooltip>
        <Popover.Portal>
          <Popover.Positioner
            side='top'
            sideOffset={8}
            className='z-50 data-anchor-hidden:invisible'
          >
            <Popover.Popup
              finalFocus={() =>
                openingDrawer.current ? false : (markerButton.current ?? false)
              }
              className='relative w-64 max-w-[calc(100vw-24px)] origin-(--transform-origin) rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none transition-[scale,opacity] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 motion-reduce:transition-none'
            >
              <Popover.Close
                aria-label='Close vessel actions'
                className='absolute top-2 right-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring transition-colors duration-150 motion-reduce:transition-none'
              >
                <X className='size-3.5' />
              </Popover.Close>
              <Popover.Title className='pr-4 text-sm font-medium'>
                {vessel.id}
              </Popover.Title>

              <Popover.Description className='text-xs text-muted-foreground'>
                {getVesselDisplayName(vessel)}
              </Popover.Description>

              {detailsOpen ? <>
                <button type='button' onClick={() => setDetailsOpen(false)} className='mt-3 cursor-pointer text-xs text-muted-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring'>Back to actions</button>
                <p className='mt-3 text-xs text-muted-foreground'>{getVesselActivity(snapshot).label}</p>
                <VesselTelemetry snapshot={snapshot} />
                <VesselFuel tanks={vessel.fuelTanks} />
              </> : <>
              <Drawer.Trigger
                handle={missionDrawer}
                payload={{ vesselId: vessel.id, returnFocus: markerButton }}
                onClick={() => {
                  if (
                    snapshot.phase === 'complete' ||
                    snapshot.phase === 'aborted'
                  )
                    simulation.clearFinishedMission();
                  openingDrawer.current = true;
                  setPopoverOpen(false);
                }}
                className='flex text-sm font-medium items-center cursor-pointer justify-center mt-4 gap-1 bg-black text-white w-full py-1.5 rounded-md disabled:cursor-default disabled:opacity-50'
              >
                {isMissionInProgress(snapshot)
                  ? 'View mission'
                  : 'Plan a mission'}
              </Drawer.Trigger>
              <div className='mt-2 flex flex-col gap-1 border-t pt-2'>
                <button type='button' onClick={() => setDetailsOpen(true)} className='cursor-pointer rounded px-2 py-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'>View vessel details</button>
                <button type='button' onClick={async () => {
                  try {
                    const [longitude, latitude] = simulation.getFrame().position;
                    await navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
                    setCopyState('copied');
                  } catch { setCopyState('error'); }
                }} className='cursor-pointer rounded px-2 py-2 text-left text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'>Copy position</button>
                <p role='status' className='px-2 text-[11px] text-muted-foreground'>{copyState === 'copied' ? 'Position copied (latitude, longitude)' : copyState === 'error' ? 'Unable to copy. Position is available in vessel details.' : ''}</p>
              </div>
              </>}

            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </MapMarker>
    </Popover.Root>
  );
}
