"use client";

import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Marker, Popup } from 'maplibre-gl';
import { MapMarker, MarkerContent, MarkerPopup, MarkerTooltip, useMap } from '@/components/ui/map';
import boat from '@/assets/boat.svg';
import { INITIAL_HEADING, INITIAL_POSITION } from '@/lib/vessel/navigation';
import type { VesselSimulation } from '@/lib/vessel/simulation';
import { createVesselRenderer } from './renderer';
import type { VesselDisplayOptions } from './renderer';

type Props = VesselDisplayOptions & { simulation: VesselSimulation; onPan: () => void };

export function VesselLayer({ simulation, follow, showRangeRings, onPan }: Props) {
  const { map, mapLib, isLoaded } = useMap();
  const marker = useRef<Marker | null>(null);
  const tooltip = useRef<Popup | null>(null);
  const renderer = useRef<ReturnType<typeof createVesselRenderer> | null>(null);
  const snapshot = useSyncExternalStore(simulation.subscribe, simulation.getSnapshot);

  useEffect(() => {
    if (!map || !mapLib || !isLoaded || !marker.current || !tooltip.current) return;
    const instance = createVesselRenderer(map, mapLib, simulation,
      { marker: marker.current, tooltip: tooltip.current },
      { follow: false, showRangeRings: false }, onPan);
    renderer.current = instance;
    return () => { instance.destroy(); renderer.current = null; };
  }, [map, mapLib, isLoaded, simulation, onPan]);

  useEffect(() => {
    renderer.current?.setOptions({ follow, showRangeRings });
  }, [map, mapLib, isLoaded, follow, showRangeRings]);

  return (
    <MapMarker ref={marker} {...INITIAL_POSITION} rotation={INITIAL_HEADING}
      rotationAlignment='map' pitchAlignment='map' subpixelPositioning>
      <MarkerContent>
        <img src={boat} alt='SR-01' className='h-24 w-auto drop-shadow-lg' draggable={false} />
      </MarkerContent>
      <MarkerTooltip ref={tooltip} offset={55}>SR-01 · STORMRUNNER</MarkerTooltip>
      <MarkerPopup offset={55} closeButton>
        <div className='min-w-44 pr-4'>
          <h2 className='text-sm font-medium'>SR-01</h2>
          <p className='mt-1 text-xs text-muted-foreground'>STORMRUNNER · Simulated vessel</p>
          <dl className='mt-3 grid grid-cols-2 gap-2 text-xs tabular-nums'>
            <dt className='text-muted-foreground'>Heading</dt>
            <dd>{String(Math.round(snapshot.heading)).padStart(3, '0')}°</dd>
            <dt className='text-muted-foreground'>Vessel speed</dt>
            <dd>{snapshot.speed} kn</dd>
            <dt className='text-muted-foreground'>Status</dt>
            <dd>{snapshot.arrived ? 'Arrived' : snapshot.playing ? 'Underway' : 'Paused'}</dd>
            <dt className='text-muted-foreground'>Waypoint</dt>
            <dd>{snapshot.remaining.toFixed(2)} nm</dd>
          </dl>
        </div>
      </MarkerPopup>
    </MapMarker>
  );
}
