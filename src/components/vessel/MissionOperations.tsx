import { TextSwap } from '@/components/TextSwap';
import { useRef } from 'react';
import type { RefObject } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Button } from '@base-ui/react/button';
import { useMap } from '@/components/ui/map';
import type { VesselFrame } from '@/lib/vessel/simulation';
import type { Vessel } from '@/lib/vessel/vessel';
import { isMissionInProgress } from '@/lib/vessel/vessel';

export function MissionOperations({ vessel, snapshot, compact = false, terminalFocus }: {
  vessel: Vessel;
  snapshot: VesselFrame;
  compact?: boolean;
  terminalFocus?: RefObject<HTMLElement | null>;
}) {
  const { map } = useMap();
  const abortButton = useRef<HTMLButtonElement | null>(null);
  return <AlertDialog.Root>
    <div className={compact ? 'flex items-center gap-2' : 'flex flex-col gap-2'}>
      <Button
        aria-label={snapshot.playing ? 'Pause mission' : 'Resume mission'}
        onClick={() => vessel.simulation.setPlaying(!vessel.simulation.getFrame().playing)}
        className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-md px-3 font-medium focus-visible:outline-2 focus-visible:outline-ring ${compact ? 'min-h-10 border bg-background text-xs hover:bg-white/[0.08]' : 'min-h-9 w-full bg-neutral-100 py-2 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline-offset-2 focus-visible:outline-white'}`}
      >
        <TextSwap text={snapshot.playing ? compact ? 'Pause' : 'Pause mission' : compact ? 'Resume' : 'Resume mission'} />
      </Button>
      <AlertDialog.Trigger ref={abortButton} render={<Button />} aria-label='Abort mission' className={compact ? 'min-h-10 cursor-pointer rounded-md px-3 text-xs text-foreground hover:bg-white/[0.08] hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring' : 'flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md border border-transparent bg-[#2b3033] px-3 py-2 text-xs font-medium text-[#bcbcb7] hover:bg-white/10 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-100'}>
        {compact ? 'Abort' : 'Abort mission'}
      </AlertDialog.Trigger>
    </div>
    <AlertDialog.Portal container={map?.getContainer()}>
      <AlertDialog.Backdrop className='fixed inset-0 z-80 bg-black/30' />
      <AlertDialog.Viewport className='fixed inset-0 z-90 flex items-center justify-center p-4'>
        <AlertDialog.Popup
          finalFocus={() => isMissionInProgress(vessel.simulation.getFrame()) ? abortButton.current : terminalFocus?.current ?? map?.getCanvas() ?? false}
          className='w-full max-w-sm rounded-2xl border bg-background p-6 text-foreground shadow-xl outline-none'
        >
          <AlertDialog.Title className='text-base font-medium'>Abort {vessel.id}’s mission?</AlertDialog.Title>
          <AlertDialog.Description className='mt-2 text-sm leading-relaxed text-muted-foreground'>The vessel will stop at its current position and the remaining route will be discarded.</AlertDialog.Description>
          <div className='mt-6 flex justify-end gap-2'>
            <AlertDialog.Close render={<Button />} className='min-h-9 cursor-pointer rounded-md border px-3 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'>Keep mission</AlertDialog.Close>
            <AlertDialog.Close render={<Button />} onClick={() => vessel.simulation.abort()} className='min-h-9 cursor-pointer rounded-md bg-destructive px-3 text-xs font-medium text-white focus-visible:outline-2 focus-visible:outline-ring'>Abort mission</AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Viewport>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
