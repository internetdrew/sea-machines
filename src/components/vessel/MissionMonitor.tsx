import { useFleetInteractions } from '@/lib/vessel/use-interactions';
import { NavigationTooltip, NavigationTooltipProvider } from '@/components/NavigationTooltip';
import { useMap } from '@/components/ui/map';
import { TextSwap } from '@/components/TextSwap';
import { NumberPopIn } from '@/components/NumberPopIn';
import { MissionSpeedEditor } from './MissionSpeedEditor';
import { CLOSE_BUTTON_CLASS } from '@/components/CloseButton';
import { getVesselIdentity } from '@/lib/vessel/vessel';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from '@base-ui/react/button';
import { Drawer } from '@base-ui/react/drawer';
import { Progress } from '@base-ui/react/progress';
import { motion, useReducedMotion } from 'motion/react';
import { SlidersHorizontal, X } from 'lucide-react';
import { distanceNm, missionProgressPercent } from '@/lib/vessel/mission';
import {
  getMissionPhaseLabel,
  getVesselActivity,
  isMissionInProgress,
} from '@/lib/vessel/vessel';
import type { Vessel } from '@/lib/vessel/vessel';
import { MissionOperations } from './MissionOperations';

export function MissionMonitor({ vessel }: { vessel: Vessel }) {
  const interactions = useFleetInteractions();
  const { map } = useMap();
  const reducedMotion = useReducedMotion();
  const snapshot = useSyncExternalStore(
    vessel.simulation.subscribe,
    vessel.simulation.getSnapshot,
  );
  const [pendingStraight, setPendingStraight] = useState<number | null>(null);
  const [pendingTurn, setPendingTurn] = useState<number | null>(null);
  const [speedFailure, setSpeedFailure] = useState('');
  const [editingSpeeds, setEditingSpeeds] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const editButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (!confirmation) return;
    const timer = window.setTimeout(() => setConfirmation(''), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmation]);
  const title = useRef<HTMLHeadingElement | null>(null);
  const attachScrollArea = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const align = () =>
      element.style.setProperty(
        '--drawer-scrollbar-inset',
        `${(element.offsetWidth - element.clientWidth) / 2}px`,
      );
    align();
    const observer = new ResizeObserver(align);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
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
  const status = getVesselActivity(snapshot);
  if (!mission) return null;
  const active = isMissionInProgress(snapshot);
  const validSpeed = (value: number | null): value is number => value !== null && Number.isInteger(value) && value >= 1 && value <= vessel.simulation.maxSpeed;
  const speedError = !validSpeed(pendingStraight) || !validSpeed(pendingTurn)
    ? `Enter whole-knot speeds between 1 and ${Math.floor(vessel.simulation.maxSpeed)} kn.`
    : pendingTurn !== null && pendingTurn > pendingStraight! ? 'Turn speed must not exceed straight-line speed.' : '';
  const unchanged = pendingStraight === mission.speed && pendingTurn === mission.turnSpeed;
  const closeSpeedEditor = (applied: boolean) => {
    setEditingSpeeds(false);
    if (applied) setConfirmation('Mission speeds updated.');
    requestAnimationFrame(() => editButton.current?.focus({ preventScroll: true }));
  };
  const percent = missionProgressPercent(snapshot.distance, total, snapshot.arrived);
  return (
    <>
      <header className='shrink-0 px-5 pt-5 pb-5'>
        <Drawer.Description className='mb-2 pr-8 text-xs tracking-wide text-muted-foreground'>
          {getVesselIdentity(vessel)}
        </Drawer.Description>
        <Drawer.Title ref={title} tabIndex={-1} className='pr-8 text-lg font-medium outline-none'>Mission control</Drawer.Title>
        <Drawer.Close aria-label='Close mission control' className={`absolute top-5 right-5 ${CLOSE_BUTTON_CLASS}`}><X className='size-4' /></Drawer.Close>
        <div className='mt-3 flex items-center gap-2 text-[11px]' role='status'>
          <span className={`inline-flex items-center gap-1.5 ${snapshot.playing ? 'text-[#a8d1c7]' : 'text-neutral-300'}`}>
            <span aria-hidden='true' className='size-1.5 rounded-full bg-current' /><TextSwap text={status.label} />
          </span>
          {snapshot.playing && getMissionPhaseLabel(snapshot) && <span className='text-muted-foreground'>{getMissionPhaseLabel(snapshot)}</span>}
        </div>
      </header>
      <div
        ref={attachScrollArea}
        style={{ scrollbarGutter: 'stable both-edges' }}
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-[calc(1.25rem-var(--drawer-scrollbar-inset,0px))] scrollbar-thin scrollbar-gutter-both'
      >
        <div className='mission-drawer-body flow-root pb-6'>
          {vessel.fuelTanks.filter(tank => tank.capacityLiters > 0 && tank.remainingLiters / tank.capacityLiters <= 0.3).map(tank => {
            const critical = tank.remainingLiters / tank.capacityLiters <= 0.15;
            return <p key={tank.name} className={`mb-5 border-l-2 py-1 pl-3 text-xs font-medium ${critical ? 'border-red-400 text-red-400' : 'border-amber-400 text-amber-400'}`}>
              {tank.name} fuel {critical ? 'critical' : 'low'}
            </p>;
          })}
          {active && snapshot.nextWaypoint ? (
            <section aria-label='Next destination' className='rounded-lg border border-white/5 bg-white/[0.015] p-3.5 text-xs tabular-nums'>
              <h3 className='font-medium text-neutral-200'>Next: {mission.type === 'waypoint'
                ? `Waypoint ${snapshot.targetIndex + 1}`
                : snapshot.phase === 'transit' ? 'Grid start' : `Pass ${Math.floor(snapshot.targetIndex / 2) + 1}`}</h3>
              <dl className='mt-4 grid grid-cols-2 gap-4'>
                <div>
                  <dt className='text-[10px] text-muted-foreground'>Distance to waypoint</dt>
                  <dd className='mt-1 text-xl font-medium'><NumberPopIn value={snapshot.remaining.toFixed(2)} /> <span className='text-xs font-normal text-neutral-400'>nm</span></dd>
                </div>
                <div>
                  <dt className='text-[10px] text-muted-foreground'>Est. time to waypoint</dt>
                  <dd className='mt-1 text-xl font-medium'>{snapshot.playing && snapshot.speed > 0
                    ? <>~<NumberPopIn value={String(Math.max(1, Math.ceil(snapshot.remaining / snapshot.speed * 60)))} /> <span className='text-xs font-normal text-neutral-400'>min</span></>
                    : <span className='text-sm text-muted-foreground'>{snapshot.playing ? 'Calculating…' : 'Paused'}</span>}</dd>
                </div>
              </dl>
            </section>
          ) : (
          <section aria-label='Mission progress' className='text-xs tabular-nums'>
            <Progress.Root value={percent}>
              <div className='mb-3 flex items-baseline justify-between gap-3'>
                <Progress.Label className='font-medium text-neutral-200'>
                  {snapshot.phase === 'aborted' ? 'Progress before abort' : 'Route progress'}
                </Progress.Label>
                <Progress.Value className='text-[21px] font-medium'>{() => <NumberPopIn value={`${Math.round(percent)}%`} />}</Progress.Value>
              </div>
              <Progress.Track className='h-1 overflow-hidden rounded-full bg-neutral-800'>
                <Progress.Indicator style={{ width: '100%' }} className={`h-full origin-left rounded-full ${snapshot.phase === 'aborted' ? 'bg-neutral-400' : 'bg-[#8eafa9]'}`} render={
                  <motion.div initial={false} animate={{ transform: `scaleX(${percent / 100})` }} transition={{ duration: reducedMotion ? 0 : 0.25, ease: 'linear' }} />
                } />
              </Progress.Track>
            </Progress.Root>
            <p className='mt-2 text-[11px] text-muted-foreground'>{snapshot.distance.toFixed(2)} of {total.toFixed(2)} nm travelled</p>
            {active && snapshot.nextWaypoint && (
              <div className='mt-[15px] flex items-baseline justify-between gap-3'>
                <span className='font-medium'>Next: {mission.type === 'waypoint'
                  ? `Waypoint ${snapshot.targetIndex + 1}`
                  : snapshot.phase === 'transit' ? 'Grid start' : `Pass ${Math.floor(snapshot.targetIndex / 2) + 1}`}</span>
                <span className='text-right'>{snapshot.remaining.toFixed(2)} nm{snapshot.playing && snapshot.speed > 0 ? ` · ~${Math.max(1, Math.ceil(snapshot.remaining / snapshot.speed * 60))} min` : ''}</span>
              </div>
            )}
          </section>
          )}
          <section aria-label='Mission speeds' className='mt-7 text-xs tabular-nums'>
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-[11px] font-medium text-neutral-400'>Mission speeds</h3>
              {active && (
                <NavigationTooltipProvider delay={350}>
                  <NavigationTooltip label='Edit mission speeds' container={map?.getContainer()}>
                    <Button ref={editButton} aria-label='Edit mission speeds' aria-expanded={editingSpeeds} aria-controls='mission-speed-editor' onClick={() => { setConfirmation(''); setSpeedFailure(''); setPendingStraight(mission.speed); setPendingTurn(mission.turnSpeed); setEditingSpeeds(true); }} className={`${CLOSE_BUTTON_CLASS} text-neutral-300 ${editingSpeeds ? 'invisible' : ''}`}>
                      <SlidersHorizontal aria-hidden='true' className='size-4' />
                    </Button>
                  </NavigationTooltip>
                </NavigationTooltipProvider>
              )}
            </div>
            <div id='mission-speed-editor'>
            {editingSpeeds && active ? <MissionSpeedEditor vessel={vessel} straight={pendingStraight} turn={pendingTurn} setStraight={setPendingStraight} setTurn={setPendingTurn} error={speedError || speedFailure} onCancel={() => closeSpeedEditor(false)} /> : <dl className='mt-2 grid grid-cols-2 gap-3'>
              <div><dt className='text-[11px] text-neutral-400'>Straight-line</dt><dd className='mt-1 text-lg leading-tight font-medium'>{mission.speed}<span className='ml-1 text-[11px] font-normal text-neutral-400'>kn</span></dd></div>
              <div><dt className='text-[11px] text-neutral-400'>Turns</dt><dd className='mt-1 text-lg leading-tight font-medium'>{mission.turnSpeed}<span className='ml-1 text-[11px] font-normal text-neutral-400'>kn</span></dd></div>
            </dl>}
            </div>
            <p role='status' aria-live='polite' className='mt-2 text-[10px] text-muted-foreground'>{confirmation}</p>
          </section>
        </div>
      </div>
      <footer className='shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
        {editingSpeeds && active ? (
          <div className='flex flex-col gap-2'>
            <Button type='button' disabled={!!speedError || unchanged} className='mission-cta min-h-9 w-full cursor-pointer rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-white disabled:cursor-default disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white' onClick={() => {
              if (speedError || unchanged) return;
              if (validSpeed(pendingStraight) && validSpeed(pendingTurn) && vessel.simulation.setMissionSpeeds(pendingStraight, pendingTurn)) closeSpeedEditor(true);
              else setSpeedFailure('Unable to update speeds. The mission may have ended.');
            }}>Apply speeds</Button>
            <Button type='button' className='mission-cta min-h-9 w-full cursor-pointer rounded-md bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-100' onClick={() => closeSpeedEditor(false)}>Cancel</Button>
          </div>
        ) : active ? (
          <MissionOperations
            vessel={vessel}
            snapshot={snapshot}
            terminalFocus={title}
          />
        ) : (
          <Button
            onClick={() => { if (vessel.simulation.clearFinishedMission()) interactions.dispatch({ type: 'plan-new-mission', vesselId: vessel.id }); }}
            className='mission-cta flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
          >
            Plan a new mission
          </Button>
        )}
      </footer>
    </>
  );
}
