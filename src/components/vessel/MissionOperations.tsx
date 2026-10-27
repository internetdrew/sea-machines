import { useRef } from 'react';
import type { RefObject } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Button } from '@base-ui/react/button';
import { Pause, Play } from 'lucide-react';
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
    <div className='flex items-center gap-2'>
      <Button
        aria-label={snapshot.playing ? 'Pause mission' : 'Resume mission'}
        onClick={() => vessel.simulation.setPlaying(!vessel.simulation.getFrame().playing)}
        className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-3 font-medium focus-visible:outline-2 focus-visible:outline-ring ${compact ? 'border bg-background text-xs hover:bg-muted' : 'flex-1 bg-primary text-sm text-primary-foreground'}`}
      >
        {snapshot.playing ? <Pause className='size-3.5' /> : <Play className='size-3.5' />}
        {snapshot.playing ? compact ? 'Pause' : 'Pause mission' : compact ? 'Resume' : 'Resume mission'}
      </Button>
      <AlertDialog.Trigger ref={abortButton} render={<Button />} aria-label='Abort mission' className='min-h-10 cursor-pointer rounded-md px-3 text-xs text-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring'>
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
