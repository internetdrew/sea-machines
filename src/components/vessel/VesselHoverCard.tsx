import { useMemo } from 'react';
import { TriangleAlert } from 'lucide-react';
import { distanceNm } from '@/lib/vessel/mission';
import { getFuelAppearance } from '@/lib/vessel/fuel';
import type { VesselFrame } from '@/lib/vessel/simulation';
import { isMissionInProgress, type Vessel } from '@/lib/vessel/vessel';

export function VesselHoverCard({ vessel, snapshot }: { vessel: Vessel; snapshot: VesselFrame }) {
  const mission = snapshot.mission;
  const total = useMemo(() => mission?.coordinates.reduce((sum, point, index, coordinates) =>
    sum + (index ? distanceNm(coordinates[index - 1], point) : 0), 0) ?? 0, [mission]);
  const progress = total ? Math.min(100, Math.round(snapshot.distance / total * 100)) : 0;
  const active = isMissionInProgress(snapshot);
  const minutes = snapshot.playing && snapshot.speed > 0 && snapshot.nextWaypoint
    ? Math.max(1, Math.ceil(snapshot.remaining / snapshot.speed * 60))
    : null;
  const warnings = vessel.fuelTanks.flatMap(tank => {
    if (tank.capacityLiters <= 0) return [];
    const percent = Math.max(0, Math.min(100, tank.remainingLiters / tank.capacityLiters * 100));
    const appearance = getFuelAppearance(percent);
    return appearance.label !== 'Normal'
      ? [{ name: tank.name, percent: Math.round(percent), color: appearance.text }]
      : [];
  });

  return <>
    <p className='font-semibold tracking-tight'>{vessel.id} {vessel.name}</p>
    <p className='mt-1 text-xs font-medium text-[#5eead4]'>
      {active ? snapshot.playing ? 'On mission' : 'Mission paused'
        : snapshot.phase === 'aborted' ? 'Mission aborted' : 'Idle'}
    </p>
    {active && <>
      <div className='mt-2 flex items-center justify-between gap-4 text-xs'>
        <span className='text-neutral-400'>Mission progress</span>
        <span className='tabular-nums'>{progress}%</span>
      </div>
      <p className='mt-1 text-xs text-neutral-400'>
      Next waypoint{' '}
      <span className='tabular-nums'>
        {!snapshot.playing
          ? snapshot.nextWaypoint ? <span className='text-neutral-100'>{snapshot.remaining.toFixed(2)} nm away</span> : '—'
          : minutes === null ? '· calculating ETA' : <span className='text-neutral-100'>in ~{minutes} min</span>}
      </span>
      </p>
    </>}
    {warnings.length > 0 && <div className='mt-2 border-t border-white/15 pt-2'>
      {warnings.map(tank => <p key={tank.name} className={`flex items-center gap-2 text-xs ${tank.color}`}>
        <TriangleAlert aria-hidden='true' className='size-3.5 shrink-0' />
        <span>{tank.name} fuel {tank.percent}%</span>
      </p>)}
    </div>}
  </>;
}
