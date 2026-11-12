import type { RefObject } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { X } from 'lucide-react';
import { TextSwap } from '@/components/TextSwap';
import { NumberPopIn } from '@/components/NumberPopIn';
import { CLOSE_BUTTON_CLASS } from '@/components/CloseButton';
import { getVesselActivity, getVesselIdentity } from '@/lib/vessel/vessel';
import type { Vessel } from '@/lib/vessel/vessel';
import type { VesselFrame } from '@/lib/vessel/simulation';

export function MissionMobileMonitorHeader({
  vessel,
  snapshot,
  title,
}: {
  vessel: Vessel;
  snapshot: VesselFrame;
  title: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <header className='mission-monitor-mobile-header flex shrink-0 items-center gap-2 px-5'>
      <Drawer.Description className='min-w-0 flex-1 truncate text-[11px] font-medium'>
        {getVesselIdentity(vessel)}
      </Drawer.Description>
      <Drawer.Title ref={title} tabIndex={-1} className='sr-only'>
        Mission control
      </Drawer.Title>
      <span
        role='status'
        className={`inline-flex items-center gap-1.5 text-[10px] ${snapshot.playing ? 'text-[#a8d1c7]' : 'text-neutral-300'}`}
      >
        <span aria-hidden='true' className='size-1 rounded-full bg-current' />
        <TextSwap text={getVesselActivity(snapshot).label} />
      </span>
      <Drawer.Close
        aria-label='Close mission control'
        className={`min-h-11 min-w-11 ${CLOSE_BUTTON_CLASS}`}
      >
        <X className='size-4' />
      </Drawer.Close>
    </header>
  );
}

export function MissionMobileDestination({
  snapshot,
}: {
  snapshot: VesselFrame;
}) {
  const mission = snapshot.mission!;
  const next =
    mission.type === 'waypoint'
      ? `Waypoint ${snapshot.targetIndex + 1}`
      : snapshot.phase === 'transit'
        ? 'Grid start'
        : `Pass ${Math.floor(snapshot.targetIndex / 2) + 1}`;
  return (
    <section
      aria-label='Next destination'
      className='flex items-end justify-between gap-4 py-2 text-xs tabular-nums'
    >
      <div>
        <h3 className='text-xs font-medium'>Next: {next}</h3>
        <p
          className='mt-1 text-[26px] leading-tight font-medium'
          aria-label={`Distance to waypoint: ${snapshot.remaining.toFixed(2)} nautical miles`}
        >
          <NumberPopIn value={snapshot.remaining.toFixed(2)} />{' '}
          <span className='text-xs font-normal text-neutral-400'>nm</span>
        </p>
      </div>
      <div className='text-right'>
        <p className='text-[10px] text-neutral-400'>Est. arrival</p>
        <p className='mt-1 text-[26px] leading-tight font-medium'>
          {snapshot.playing && snapshot.speed > 0 ? (
            <>
              ~
              <NumberPopIn
                value={String(
                  Math.max(
                    1,
                    Math.ceil((snapshot.remaining / snapshot.speed) * 60),
                  ),
                )}
              />{' '}
              <span className='text-xs font-normal text-neutral-400'>min</span>
            </>
          ) : (
            <span className='text-xs text-neutral-400'>
              {snapshot.playing ? 'Calculating…' : 'Paused'}
            </span>
          )}
        </p>
      </div>
    </section>
  );
}
