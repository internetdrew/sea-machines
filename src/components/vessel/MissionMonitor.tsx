import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { Button } from '@base-ui/react/button';
import { Drawer } from '@base-ui/react/drawer';
import { Progress } from '@base-ui/react/progress';
import { X } from 'lucide-react';
import { distanceNm } from '@/lib/vessel/mission';
import { getMissionPhaseLabel, getVesselActivity, isMissionInProgress } from '@/lib/vessel/vessel';
import type { Vessel } from '@/lib/vessel/vessel';
import { MissionOperations } from './MissionOperations';
import { VesselFuel } from './VesselFuel';
import { VesselTelemetry } from './VesselTelemetry';

export function MissionMonitor({ vessel }: { vessel: Vessel }) {
  const snapshot = useSyncExternalStore(vessel.simulation.subscribe, vessel.simulation.getSnapshot);
  const title = useRef<HTMLHeadingElement | null>(null);
  const attachScrollArea = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const align = () => element.style.setProperty('--drawer-scrollbar-inset', `${(element.offsetWidth - element.clientWidth) / 2}px`);
    align();
    const observer = new ResizeObserver(align);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const mission = snapshot.mission;
  const total = useMemo(() => mission?.coordinates.reduce((sum, point, index, coordinates) => sum + (index ? distanceNm(coordinates[index - 1], point) : 0), 0) ?? 0, [mission]);
  const status = getVesselActivity(snapshot);
  if (!mission) return null;
  const active = isMissionInProgress(snapshot);
  const percent = total ? Math.min(100, snapshot.distance / total * 100) : 0;
  return <>
    <header className='shrink-0 px-6 pt-6 pb-4'>
      <Drawer.Title ref={title} tabIndex={-1} className='pr-8 text-lg font-medium outline-none'>Mission control</Drawer.Title>
      <Drawer.Description className='mt-1 text-xs text-muted-foreground'>{vessel.id} · {vessel.name}</Drawer.Description>
      <Drawer.Close aria-label='Close mission control' className='absolute top-5 right-5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'><X className='size-4' /></Drawer.Close>
      <div className='mt-3 flex items-center gap-2 text-[11px]'>
        <span className={`rounded-full px-2.5 py-0.5 font-medium ${status.colors}`} role='status'>{status.label}</span>
        {getMissionPhaseLabel(snapshot) && <span className='text-muted-foreground'>{getMissionPhaseLabel(snapshot)}</span>}
      </div>
    </header>
    <div ref={attachScrollArea} className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-[calc(1.5rem-var(--drawer-scrollbar-inset,0px))] pb-6 [scrollbar-width:thin] [scrollbar-gutter:stable_both-edges]'>
      <section aria-label='Vessel telemetry' className='border-t'>
        <VesselTelemetry snapshot={snapshot} />
        <VesselFuel tanks={vessel.fuelTanks} />
      </section>
      <section className='mt-6 border-t pt-4 text-xs tabular-nums' aria-label='Mission progress'>
        <div className='flex items-center justify-between gap-3'>
          <h3 className='text-sm font-medium'>{mission.type === 'grid' ? 'Grid mission' : 'Waypoint mission'}</h3>
          <span className='text-muted-foreground'>{mission.type === 'grid' ? `${mission.targets.length / 2} passes` : `${mission.targets.length} waypoint${mission.targets.length === 1 ? '' : 's'}`}</span>
        </div>
        <Progress.Root value={percent} className='mt-4'>
          <div className='mb-2 flex items-center justify-between gap-2'>
            <Progress.Label className='text-muted-foreground'>{snapshot.phase === 'aborted' ? 'Progress before abort' : 'Route progress'}</Progress.Label>
            <Progress.Value>{() => `${Math.round(percent)}%`}</Progress.Value>
          </div>
          <Progress.Track className='h-1.5 overflow-hidden rounded-full bg-muted'><Progress.Indicator className={`h-full rounded-full ${snapshot.phase === 'aborted' ? 'bg-slate-400' : 'bg-teal-600'}`} /></Progress.Track>
        </Progress.Root>
        <p className='mt-2 text-[11px] text-muted-foreground'>{snapshot.distance.toFixed(2)} of {total.toFixed(2)} nm travelled</p>
        <dl className='mt-4 grid grid-cols-2 gap-3'>
          {active && <>
            <div><dt className='text-muted-foreground'>Next destination</dt><dd className='mt-1 font-medium'>{snapshot.phase === 'transit' ? 'Start point' : mission.type === 'waypoint' ? `Waypoint ${snapshot.targetIndex + 1} of ${mission.targets.length}` : `Pass ${Math.floor(snapshot.targetIndex / 2) + 1} of ${mission.targets.length / 2}`}</dd></div>
            <div><dt className='text-muted-foreground'>Route remaining</dt><dd className='mt-1 font-medium'>{snapshot.routeRemaining.toFixed(2)} nm</dd></div>
          </>}
          <div><dt className='text-muted-foreground'>Straight-line speed</dt><dd className='mt-1 font-medium'>{mission.speed} kn</dd></div>
          <div><dt className='text-muted-foreground'>Turn speed</dt><dd className='mt-1 font-medium'>{mission.turnSpeed} kn</dd></div>
        </dl>
      </section>
    </div>
    <footer className='shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
      {active ? <MissionOperations vessel={vessel} snapshot={snapshot} terminalFocus={title} /> : <Button onClick={() => vessel.simulation.clearFinishedMission()} className='min-h-10 w-full cursor-pointer rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring'>Plan a new mission</Button>}
    </footer>
  </>;
}
