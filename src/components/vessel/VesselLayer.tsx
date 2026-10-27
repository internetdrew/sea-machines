'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Popover } from '@base-ui/react/popover';
import { X } from 'lucide-react';
import { VesselFuel } from './VesselFuel';
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
import type { VesselSimulation } from '@/lib/vessel/simulation';
import { createVesselRenderer } from './renderer';
import type { VesselDisplayOptions } from './renderer';
import { Button } from '@base-ui/react/button';

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

// Demo tank readings until vessel fuel telemetry is available.
const DEMO_FUEL_TANKS = [
  { name: 'Port', remainingLiters: 210, capacityLiters: 250 },
  { name: 'Starboard', remainingLiters: 200, capacityLiters: 250 },
];

type Props = VesselDisplayOptions & {
  simulation: VesselSimulation;
  onPan: () => void;
};

export function VesselLayer({
  simulation,
  follow,
  showRangeRings,
  onPan,
}: Props) {
  const { map, mapLib, isLoaded } = useMap();
  const reducedMotion = useReducedMotion();
  const layoutTransition = {
    duration: reducedMotion ? 0 : 0.2,
    ease: [0.2, 0, 0, 1] as const,
  };
  const marker = useRef<Marker | null>(null);
  const tooltip = useRef<Popup | null>(null);
  const renderer = useRef<ReturnType<typeof createVesselRenderer> | null>(null);
  const snapshot = useSyncExternalStore(
    simulation.subscribe,
    simulation.getSnapshot,
  );

  const status = snapshot.playing
    ? { label: 'Active', colors: 'bg-emerald-100 text-emerald-800' }
    : snapshot.distance > 0 && !snapshot.arrived
      ? { label: 'Paused', colors: 'bg-amber-100 text-amber-800' }
      : { label: 'Idle', colors: 'bg-slate-200 text-slate-700' };

  useEffect(() => {
    if (!map || !mapLib || !isLoaded || !marker.current || !tooltip.current)
      return;
    const instance = createVesselRenderer(
      map,
      mapLib,
      simulation,
      { marker: marker.current, tooltip: tooltip.current },
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
    <Popover.Root>
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
            aria-label='Show SR-01 Stormrunner details'
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
        <MarkerTooltip ref={tooltip} offset={55}>
          SR-01 · STORMRUNNER
        </MarkerTooltip>
        <Popover.Portal>
          <Popover.Positioner
            side='top'
            sideOffset={8}
            className='z-50 data-anchor-hidden:invisible'
          >
            <Popover.Popup className='relative w-58 max-w-[calc(100vw-24px)] origin-(--transform-origin) rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none transition-[scale,opacity] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 motion-reduce:transition-none'>
              <Popover.Close
                aria-label='Close vessel details'
                className='absolute top-2 right-2 inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring transition-colors duration-150 motion-reduce:transition-none'
              >
                <X className='size-3.5' />
              </Popover.Close>
              <Popover.Title className='pr-4 text-sm font-medium'>
                SR-01
              </Popover.Title>

              <Popover.Description className='text-xs text-muted-foreground'>
                STORMRUNNER · Simulated
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
                <motion.span
                  layout={reducedMotion ? false : 'position'}
                  layoutDependency={status.label}
                  transition={{ layout: layoutTransition }}
                  className='px-3 py-0.5 bg-green-200/80 rounded-full'
                >
                  Ready
                </motion.span>
              </div>

              <dl className='mt-4 grid grid-cols-[auto_auto] justify-between gap-x-4 gap-y-2 text-xs tabular-nums [&>dd]:text-right'>
                <dt className='text-muted-foreground'>Latitude</dt>
                <dd>{formatCoordinate(snapshot.position[1], 'N', 'S')}</dd>
                <dt className='text-muted-foreground'>Longitude</dt>
                <dd>{formatCoordinate(snapshot.position[0], 'E', 'W')}</dd>
                <dt className='text-muted-foreground'>Heading</dt>
                <dd>
                  {String(Math.round(snapshot.heading)).padStart(3, '0')}°
                </dd>
                <dt className='text-muted-foreground'>Speed</dt>
                <dd>{snapshot.speed} kn</dd>
                <dt className='text-muted-foreground'>Next waypoint</dt>
                <dd>{snapshot.remaining.toFixed(2)} nm</dd>
              </dl>
              <VesselFuel tanks={DEMO_FUEL_TANKS} />

              <Button className='flex items-center cursor-pointer justify-center mt-6 gap-1 bg-black text-white w-full py-1.5 rounded-md'>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  width='24'
                  height='24'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  stroke-width='2'
                  stroke-linecap='round'
                  stroke-linejoin='round'
                  className='size-4'
                >
                  <circle cx='6' cy='19' r='3' />
                  <path d='M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15' />
                  <circle cx='18' cy='5' r='3' />
                </svg>{' '}
                Plan mission
              </Button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </MapMarker>
    </Popover.Root>
  );
}
