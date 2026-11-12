import { missionProgressPercent } from '@/lib/vessel/mission';
import { getVesselDisplayName } from '@/lib/vessel/vessel';
import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { VesselPosition, VesselPositionContent } from './VesselPosition';
import { distanceNm } from '@/lib/vessel/mission';
import { getFuelAppearance } from '@/lib/vessel/fuel';
import type { VesselFrame } from '@/lib/vessel/simulation';
import { isMissionInProgress, type Vessel } from '@/lib/vessel/vessel';

type Props = {
  vessel: Vessel;
  snapshot: VesselFrame;
  headerAction?: ReactNode;
  showHeader?: boolean;
  detailLevel?: 'compact' | 'summary' | 'full';
};

export function VesselHoverCard(props: Props) {
  return <VesselCardContent {...props} position={<VesselPosition snapshot={props.snapshot} />} />;
}


export function VesselCardHeader({ vessel, snapshot, headerAction }: Pick<Props, 'vessel' | 'snapshot' | 'headerAction'>) {
  const active = isMissionInProgress(snapshot);
  return (
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
            <p className='font-semibold tracking-tight'>{vessel.id}</p>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] border px-1.5 py-0.5 text-[10px] leading-[14px] font-medium ${active ? (snapshot.playing ? 'border-teal-300/15 bg-teal-300/5 text-teal-300' : 'border-amber-400/15 bg-amber-400/5 text-amber-400') : 'border-white/10 bg-white/[0.03] text-neutral-400'}`}
            >
              <span aria-hidden='true' className='size-[5px] shrink-0 rounded-full bg-current' />
              {active
                ? snapshot.playing
                  ? snapshot.phase === 'transit'
                    ? 'In transit'
                    : 'Mission active'
                  : 'Mission paused'
                : 'Idle'}
            </span>
          </div>
          <p className='mt-0.5 text-xs font-normal text-neutral-400'>
            {getVesselDisplayName(vessel)}
          </p>
        </div>
        {headerAction}
      </div>
  );
}

/** Pure vessel presentation: probes never mount copy feedback or animation effects. */
export function VesselCardContent({ vessel, snapshot, headerAction, detailLevel = 'full', position, showHeader = true }: Props & { position?: ReactNode; }) {
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
  const progress = missionProgressPercent(snapshot.distance, total, snapshot.arrived);
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
      {showHeader && <VesselCardHeader vessel={vessel} snapshot={snapshot} headerAction={headerAction} />}
      <dl hidden={detailLevel === 'compact'} className={`vessel-summary-telemetry grid grid-cols-2 gap-x-4 text-xs tabular-nums ${detailLevel === 'summary' ? 'mt-3.5' : 'mt-5'}`}>
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
      <div hidden={detailLevel !== 'full'}>
        {detailLevel === 'full' && (position ?? <VesselPositionContent snapshot={snapshot} />)}
      </div>
      {active && detailLevel === 'full' && (
        <section aria-label='Mission' className='mt-5 text-xs'>
          <dl className='space-y-1'>
            <div className='flex items-baseline justify-between gap-3'>
              <dt className='text-neutral-400'>Mission progress</dt>
              <dd className='text-right tabular-nums'>{progress}%</dd>
            </div>
            <div className='flex items-baseline justify-between gap-3'>
              <dt className='shrink-0 text-neutral-400'>Next waypoint</dt>
              <dd className='text-right text-neutral-100 tabular-nums'>
                {snapshot.nextWaypoint ? (
                  <>
                    {snapshot.remaining.toFixed(2)} nm
                    {minutes !== null ? ` · ~${minutes} min` : ''}
                  </>
                ) : '—'}
              </dd>
            </div>
          </dl>
        </section>
      )}
      <section hidden={detailLevel !== 'full'} aria-label='Fuel' className='vessel-fuel-section mt-5'>
        <h3 className='text-xs font-medium text-neutral-400'>Fuel</h3>
        <dl className='mt-2 space-y-2 text-xs tabular-nums'>
          {tanks.map(tank => (
            <div
              key={tank.name}
              className='grid grid-cols-[6.5rem_minmax(0,1fr)_2.25rem] items-center gap-3'
            >
              <dt className='flex items-center gap-1.5 text-neutral-400'>{tank.name}{tank.warning && <span className='rounded border border-amber-400/15 bg-amber-400/[0.03] px-1 py-0.5 text-[9px] leading-3 text-amber-400'>Low</span>}</dt>
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
      {detailLevel !== 'full' && tanks.some(tank => tank.warning) && (
        <div className={detailLevel === 'compact' ? 'mt-3 space-y-2' : detailLevel === 'summary' ? 'mt-3.5 space-y-2' : 'mt-4'}>
          {tanks
            .filter(tank => tank.warning)
            .map(tank => (
              <p
                key={tank.name}
                className={`flex items-center gap-2 text-xs ${tank.color} min-h-10 rounded-lg border px-3 py-2 ${detailLevel === 'summary' ? 'border-amber-400/[0.07] bg-amber-400/[0.025]' : 'border-amber-400/10 bg-amber-400/[0.03]'}`}
              >
                <TriangleAlert
                  aria-hidden='true'
                  className='size-3.5 shrink-0'
                />
                <span className='min-w-0 flex-1'>{tank.name} fuel low</span>
                <span className='shrink-0 font-semibold tabular-nums'>{tank.percent}%</span>
              </p>
            ))}
        </div>
      )}
    </>
  );
}
