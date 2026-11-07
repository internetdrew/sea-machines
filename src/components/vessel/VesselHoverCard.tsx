import { getVesselDisplayName } from '@/lib/vessel/vessel';
import { useMemo } from 'react';
import { TriangleAlert } from 'lucide-react';
import { distanceNm } from '@/lib/vessel/mission';
import { getFuelAppearance } from '@/lib/vessel/fuel';
import type { VesselFrame } from '@/lib/vessel/simulation';
import { isMissionInProgress, type Vessel } from '@/lib/vessel/vessel';

export function VesselHoverCard({
  vessel,
  snapshot,
}: {
  vessel: Vessel;
  snapshot: VesselFrame;
}) {
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
      <div className='flex items-baseline justify-between gap-3'>
        <p className='font-semibold tracking-tight'>{vessel.id}</p>
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
      </div>
      <p className='text-xs font-normal text-neutral-400'>
        {getVesselDisplayName(vessel)}
      </p>
      <dl className='mt-3 grid grid-cols-2 gap-x-4 text-xs tabular-nums'>
        <div className='min-w-0'>
          <dt className='text-neutral-400'>Speed</dt>
          <dd className='mt-1 font-medium text-neutral-100'>
            {snapshot.speed.toFixed(1)} kn
          </dd>
        </div>
        <div className='min-w-0'>
          <dt className='text-neutral-400'>Heading</dt>
          <dd className='mt-1 font-medium text-neutral-100'>
            {String(Math.round(snapshot.heading) % 360).padStart(3, '0')}°
          </dd>
        </div>
      </dl>
      <section aria-label='Fuel' className='mt-3'>
        <h3 className='text-[11px] font-medium text-neutral-400'>Fuel</h3>
        <dl className='mt-1.5 grid grid-cols-2 gap-x-4 gap-y-2 text-xs tabular-nums'>
          {tanks.map(tank => (
            <div key={tank.name} className='min-w-0'>
              <dt className='text-neutral-400'>{tank.name}</dt>
              <dd
                className={`mt-1 font-medium ${tank.warning ? tank.color : 'text-neutral-100'}`}
              >
                {tank.percent === null ? '—' : `${tank.percent}%`}
              </dd>
            </div>
          ))}
        </dl>
      </section>
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
      {tanks.some(tank => tank.warning) && (
        <div className='mt-2 border-t border-white/15 pt-2'>
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
