'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Popover } from '@base-ui/react/popover';
import { X } from 'lucide-react';
import { VesselFuel } from './VesselFuel';
import { VesselTelemetry } from './VesselTelemetry';
import { VesselHoverCard } from './VesselHoverCard';
import { ActiveMissionLayer } from './ActiveMissionLayer';
import { TextSwap } from '@/components/ui/text-swap';
import type { Marker, Popup } from 'maplibre-gl';
import {
  MapMarker,
  MarkerContent,
  MarkerTooltip,
  useMap,
} from '@/components/ui/map';
import boat from '@/assets/boat.svg';
import { INITIAL_HEADING, INITIAL_POSITION } from '@/lib/vessel/navigation';
import { createVesselRenderer } from './renderer';
import type { VesselDisplayOptions } from './renderer';
import { Drawer } from '@base-ui/react/drawer';
import type { MissionDrawerPayload } from './MissionDrawer';
import {
  getMissionPhaseLabel,
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
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [markerHovered, setMarkerHovered] = useState(false);
  const [markerFocused, setMarkerFocused] = useState(false);
  const openingDrawer = useRef(false);
  const markerButton = useRef<HTMLButtonElement | null>(null);
  const reducedMotion = useReducedMotion();
  const layoutTransition = {
    duration: reducedMotion ? 0 : 0.2,
    ease: [0.2, 0, 0, 1] as const,
  };
  const marker = useRef<Marker | null>(null);
  const missionMarker = useRef<Marker | null>(null);
  const tooltip = useRef<Popup | null>(null);
  const renderer = useRef<ReturnType<typeof createVesselRenderer> | null>(null);
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );

  const status = getVesselActivity(snapshot);
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
        if (open) openingDrawer.current = false;
        setPopoverOpen(open);
      }}
    >
      <ActiveMissionLayer vesselId={vessel.id} frame={snapshot} />
      <MapMarker
        ref={missionMarker}
        {...INITIAL_POSITION}
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
        {...INITIAL_POSITION}
        rotation={INITIAL_HEADING}
        rotationAlignment='map'
        pitchAlignment='map'
        subpixelPositioning
      >
        <MarkerContent>
          <Popover.Trigger
            ref={markerButton}
            aria-label={`Show ${vessel.id} ${vessel.name} details`}
            onPointerEnter={event => {
              if (event.pointerType === 'mouse' || event.pointerType === 'pen')
                setMarkerHovered(true);
            }}
            onPointerLeave={() => setMarkerHovered(false)}
            onPointerCancel={() => setMarkerHovered(false)}
            onFocus={event =>
              setMarkerFocused(event.currentTarget.matches(':focus-visible'))
            }
            onBlur={() => setMarkerFocused(false)}
            className='block cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring'
          >
            <img
              src={boat}
              alt=''
              className='h-24 w-auto drop-shadow-lg'
              draggable={false}
            />
          </Popover.Trigger>
        </MarkerContent>
        <MarkerTooltip
          ref={tooltip}
          variant='card'
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
                aria-label='Close vessel details'
                className='absolute top-2 right-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring transition-colors duration-150 motion-reduce:transition-none'
              >
                <X className='size-3.5' />
              </Popover.Close>
              <Popover.Title className='pr-4 text-sm font-medium'>
                {vessel.id}
              </Popover.Title>

              <Popover.Description className='text-xs text-muted-foreground'>
                {vessel.name}
              </Popover.Description>

              <div className='flex text-[11px] items-center gap-2 mt-2 select-none'>
                <motion.span
                  layout={!reducedMotion}
                  layoutDependency={status.label}
                  transition={{ layout: layoutTransition }}
                  style={{ borderRadius: 9999 }}
                  className={`inline-flex px-3 py-0.5 font-medium ${status.colors}`}
                  role='status'
                >
                  <motion.span
                    layout={reducedMotion ? false : 'position'}
                    transition={{ layout: layoutTransition }}
                  >
                    <TextSwap text={status.label} />
                  </motion.span>
                </motion.span>
                {/* Health badge pending a defined readiness/health model.
                <motion.span
                  layout={reducedMotion ? false : 'position'}
                  layoutDependency={status.label}
                  transition={{ layout: layoutTransition }}
                  className='px-3 py-0.5 bg-green-200/80 rounded-full'
                >
                  Ready
                </motion.span>
                */}
              </div>

              <VesselTelemetry snapshot={snapshot} />
              {snapshot.mission && getMissionPhaseLabel(snapshot) && (
                <p className='mt-2 text-xs text-muted-foreground'>
                  {getMissionPhaseLabel(snapshot)}
                </p>
              )}
              <VesselFuel tanks={vessel.fuelTanks} />

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
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </MapMarker>
    </Popover.Root>
  );
}
