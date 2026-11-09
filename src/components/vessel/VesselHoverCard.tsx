import { getVesselDisplayName } from '@/lib/vessel/vessel';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, Copy, TriangleAlert } from 'lucide-react';
import { TextSwap } from '@/components/TextSwap';
import { distanceNm } from '@/lib/vessel/mission';
import { getFuelAppearance } from '@/lib/vessel/fuel';
import type { VesselFrame } from '@/lib/vessel/simulation';
import { isMissionInProgress, type Vessel } from '@/lib/vessel/vessel';

export function VesselHoverCard({
  vessel,
  snapshot,
  headerAction,
}: {
  vessel: Vessel;
  snapshot: VesselFrame;
  headerAction?: ReactNode;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const resetCopy = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [pressPulse, setPressPulse] = useState(false);
  const pressStarted = useRef<number | null>(null);
  const releasePulse = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(resetCopy.current);
      clearTimeout(releasePulse.current);
    };
  }, []);
  const copyPosition = async () => {
    clearTimeout(resetCopy.current);
    const [longitude, latitude] = snapshot.position;
    try {
      await navigator.clipboard.writeText(
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      );
      if (!mounted.current) return;
      setCopyState('copied');
      resetCopy.current = setTimeout(() => setCopyState('idle'), 2200);
    } catch {
      if (mounted.current) setCopyState('error');
    }
  };
  const mission = snapshot.mission;
  const total = useMemo(
    () =>
      mission?.coordinates.reduce(
        (sum, point, index, coordinates) =>
          sum + (index ? distanceNm(coordinates[index - 1], point) : 0),
        0,
      ) ?? 0,
    [mission],
  );
  const progress = total
    ? Math.min(100, Math.round((snapshot.distance / total) * 100))
    : 0;
  const active = isMissionInProgress(snapshot);
  const minutes =
    snapshot.playing && snapshot.speed > 0 && snapshot.nextWaypoint
      ? Math.max(1, Math.ceil((snapshot.remaining / snapshot.speed) * 60))
      : null;
  const tanks = vessel.fuelTanks.map(tank => {
    if (tank.capacityLiters <= 0)
      return {
        name: tank.name,
        percent: null,
        color: 'text-neutral-400',
        warning: false,
      };
    const percent = Math.max(
      0,
      Math.min(100, (tank.remainingLiters / tank.capacityLiters) * 100),
    );
    const appearance = getFuelAppearance(percent);
    return {
      name: tank.name,
      percent: Math.round(percent),
      color: appearance.text,
      warning: appearance.label !== 'Normal',
    };
  });

  return (
    <>
      <div className='flex items-center justify-between gap-3'>
        <p className='font-semibold tracking-tight'>{vessel.id}</p>
        <div className='flex items-center gap-3.5'>
          <p
            className={`shrink-0 text-xs font-medium ${active ? (snapshot.playing ? 'text-teal-300' : 'text-amber-400') : 'text-neutral-400'}`}
          >
            {active
              ? snapshot.playing
                ? snapshot.phase === 'transit'
                  ? 'In transit'
                  : 'Mission active'
                : 'Mission paused'
              : 'Idle'}
          </p>
          {headerAction}
        </div>
      </div>
      <p className='mt-0.5 text-xs font-normal text-neutral-400'>
        {getVesselDisplayName(vessel)}
      </p>
      <dl className='mt-5 grid grid-cols-2 gap-x-4 text-xs tabular-nums'>
        <div className='min-w-0'>
          <dt className='text-neutral-400'>Speed</dt>
          <dd className='mt-1 font-medium text-neutral-100'>
            {snapshot.speed.toFixed(1)} kn
          </dd>
        </div>
        <div className='min-w-0 text-right'>
          <dt className='text-neutral-400'>Heading</dt>
          <dd className='mt-1 font-medium text-neutral-100'>
            {String(Math.round(snapshot.heading) % 360).padStart(3, '0')}°
          </dd>
        </div>
      </dl>
      <div className='relative mt-5'>
        <button
          type='button'
          data-press-pulse={pressPulse}
          onPointerDown={event => {
            if (event.button === 0) pressStarted.current = performance.now();
          }}
          onPointerCancel={() => {
            pressStarted.current = null;
            clearTimeout(releasePulse.current);
            setPressPulse(false);
          }}
          onClick={event => {
            const started = pressStarted.current;
            pressStarted.current = null;
            // Trackpad taps can emit a click without a perceptible :active phase.
            // Only extend quick pointer presses; keyboard and held clicks stay native.
            if (event.detail > 0 && (started === null || performance.now() - started < 100)) {
              clearTimeout(releasePulse.current);
              setPressPulse(true);
              releasePulse.current = setTimeout(() => setPressPulse(false), 120);
            }
            void copyPosition();
          }}
          aria-label='Copy vessel position, latitude and longitude'
          className='vessel-position-copy group relative isolate block w-full cursor-pointer rounded text-left before:pointer-events-none before:absolute before:-inset-1.5 before:-z-10 before:rounded-md before:content-[""] focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-neutral-100'
        >
          <span
            className={`flex h-4 items-center justify-between text-xs font-medium ${copyState === 'copied' ? 'text-[#86efac]' : 'text-neutral-400'}`}
          >
            <TextSwap
              text={copyState === 'copied' ? 'Position Copied' : 'Position'}
              duration={0.09}
              offset={2}
              blur={1}
            />
            <span
              aria-hidden='true'
              data-copied={copyState === 'copied'}
              className='vessel-position-copy-icon vessel-copy-icon-swap inline-grid size-3.5'
            >
              <span className='vessel-copy-glyph' data-icon='copy'>
                <Copy className='size-3.5' />
              </span>
              <span className='vessel-copy-glyph' data-icon='check'>
                <Check className='size-3.5' />
              </span>
            </span>
          </span>
          <span role='status' className='sr-only'>
            {copyState === 'copied'
              ? 'Vessel position copied'
              : copyState === 'error'
                ? 'Unable to copy vessel position'
                : ''}
          </span>
          <span className='mt-2 grid grid-cols-2 gap-x-3 text-xs tabular-nums'>
            <span className='min-w-0'>
              <span className='block text-neutral-400'>Latitude</span>
              <span className='mt-1 block whitespace-nowrap font-medium text-neutral-100'>
                {Math.abs(snapshot.position[1]).toFixed(4)}°{' '}
                {snapshot.position[1] >= 0 ? 'N' : 'S'}
              </span>
            </span>
            <span className='min-w-0 text-right'>
              <span className='block text-neutral-400'>Longitude</span>
              <span className='mt-1 block whitespace-nowrap font-medium text-neutral-100'>
                {Math.abs(snapshot.position[0]).toFixed(4)}°{' '}
                {snapshot.position[0] >= 0 ? 'E' : 'W'}
              </span>
            </span>
          </span>
          {copyState === 'error' && (
            <span className='mt-2 block text-[11px] text-amber-400'>
              Unable to copy. Try again.
            </span>
          )}
        </button>
      </div>
      {active && (
        <>
          <div className='mt-2 flex items-center justify-between gap-4 text-xs'>
            <span className='text-neutral-400'>Mission progress</span>
            <span className='tabular-nums'>{progress}%</span>
          </div>
          <p className='mt-1 text-xs text-neutral-400'>
            Next waypoint{' '}
            <span className='tabular-nums'>
              {snapshot.nextWaypoint ? (
                <span className='text-neutral-100'>
                  {snapshot.remaining.toFixed(2)} nm
                  {minutes !== null ? ` · ~${minutes} min` : ''}
                </span>
              ) : (
                '—'
              )}
            </span>
          </p>
        </>
      )}
      <section aria-label='Fuel' className='mt-5'>
        <h3 className='text-xs font-medium text-neutral-400'>Fuel</h3>
        <dl className='mt-2 space-y-2 text-xs tabular-nums'>
          {tanks.map(tank => (
            <div
              key={tank.name}
              className='grid grid-cols-[5rem_minmax(0,1fr)_2.25rem] items-center gap-3'
            >
              <dt className='text-neutral-400'>{tank.name}</dt>
              <dd className='col-span-2 grid grid-cols-subgrid items-center'>
                <span
                  aria-hidden='true'
                  className='h-1.5 overflow-hidden rounded-full bg-white/10'
                >
                  <span
                    className={`block h-full rounded-full ${tank.warning ? 'bg-amber-400' : 'bg-neutral-100'}`}
                    style={{ width: `${tank.percent ?? 0}%` }}
                  />
                </span>
                <span
                  className={`text-right font-medium ${tank.warning ? tank.color : 'text-neutral-100'}`}
                >
                  {tank.percent === null ? '—' : `${tank.percent}%`}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
      {tanks.some(tank => tank.warning) && (
        <div className='mt-4'>
          {tanks
            .filter(tank => tank.warning)
            .map(tank => (
              <p
                key={tank.name}
                className={`flex items-center gap-2 text-xs ${tank.color}`}
              >
                <TriangleAlert
                  aria-hidden='true'
                  className='size-3.5 shrink-0'
                />
                <span>{tank.name} fuel low</span>
              </p>
            ))}
        </div>
      )}
    </>
  );
}
