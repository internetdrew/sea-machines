import {
  CONFIRM_BACKDROP_CLASS,
  CONFIRM_POPUP_CLASS,
  CONFIRM_CANCEL_CLASS,
  CONFIRM_DESTRUCTIVE_CLASS,
} from '@/components/ConfirmationStyles';
import { TextSwap } from '@/components/TextSwap';
import { useRef } from 'react';
import type { RefObject } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Button } from '@base-ui/react/button';
import { useMap } from '@/components/ui/map';
import type { VesselFrame } from '@/lib/vessel/simulation';
import type { Vessel } from '@/lib/vessel/vessel';
import { isMissionInProgress } from '@/lib/vessel/vessel';

export function MissionOperations({
  vessel,
  snapshot,
  terminalFocus,
  compact = false,
}: {
  compact?: boolean;
  vessel: Vessel;
  snapshot: VesselFrame;
  terminalFocus?: RefObject<HTMLElement | null>;
}) {
  const { map } = useMap();
  const keepMissionButton = useRef<HTMLButtonElement | null>(null);
  const abortButton = useRef<HTMLButtonElement | null>(null);
  return (
    <AlertDialog.Root>
      <div className={compact ? 'grid grid-cols-[1.5fr_1fr] gap-2 [&>button]:min-h-11' : 'flex flex-col gap-2'}>
        <Button
          aria-label={snapshot.playing ? 'Pause mission' : 'Resume mission'}
          onClick={() =>
            vessel.simulation.setPlaying(!vessel.simulation.getFrame().playing)
          }
          className='mission-cta inline-flex min-h-9 w-full cursor-pointer items-center justify-center gap-2 rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
        >
          <TextSwap text={snapshot.playing ? 'Pause mission' : 'Resume mission'} />
        </Button>
        <AlertDialog.Trigger
          ref={abortButton}
          render={<Button />}
          aria-label='Abort mission'
          className='mission-cta flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md border border-[#b86b6b38] bg-[#b84c4c15] px-3 py-2 text-xs font-medium text-[#f1b9b5] hover:border-[#ce7c7c88] hover:bg-[#b84c4c25] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0aba7]'
        >
          Abort mission
        </AlertDialog.Trigger>
      </div>
      <AlertDialog.Portal container={map?.getContainer()}>
        <AlertDialog.Backdrop className={CONFIRM_BACKDROP_CLASS} />
        <AlertDialog.Viewport className='fixed inset-0 z-90 flex items-center justify-center p-4'>
          <AlertDialog.Popup
            initialFocus={keepMissionButton}
            finalFocus={() =>
              isMissionInProgress(vessel.simulation.getFrame())
                ? abortButton.current
                : (terminalFocus?.current ?? map?.getCanvas() ?? false)
            }
            className={CONFIRM_POPUP_CLASS}
          >
            <AlertDialog.Title className='text-base font-medium'>
              Abort {vessel.id}’s mission?
            </AlertDialog.Title>
            <AlertDialog.Description className='mt-2 text-sm leading-relaxed text-neutral-400'>
              The vessel will stop at its current position and the remaining
              route will be discarded.
            </AlertDialog.Description>
            <div className='mt-6 flex justify-end gap-2'>
              <AlertDialog.Close
                ref={keepMissionButton}
                render={<Button />}
                className={CONFIRM_CANCEL_CLASS}
              >
                Stay on mission
              </AlertDialog.Close>
              <AlertDialog.Close
                render={<Button />}
                onClick={() => vessel.simulation.abort()}
                className={CONFIRM_DESTRUCTIVE_CLASS}
              >
                Abort mission
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
