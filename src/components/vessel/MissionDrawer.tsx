import { useCallback, useState } from 'react';
import { syncDrawerControls } from '@/lib/drawer-controls-motion';
import type { RefObject } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { useMap } from '@/components/ui/map';
import type { Vessel } from '@/lib/vessel/vessel';
import { MissionPlanner } from './MissionPlanner';
import { createMissionDraft } from '@/lib/vessel/mission';
import type { MissionDraft } from '@/lib/vessel/mission';

export type MissionDrawerPayload = {
  vesselId: string;
  returnFocus: RefObject<HTMLElement | null>;
};

export function MissionDrawer({
  handle,
  vessels,
}: {
  handle: Drawer.Handle<MissionDrawerPayload>;
  vessels: readonly Vessel[];
}) {
  const { map } = useMap();
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, MissionDraft>>({});
  const attachDrawerMotion = useCallback((popup: HTMLDivElement | null) => {
    if (popup && map) return syncDrawerControls(map.getContainer(), popup);
  }, [map]);
  return (
    <Drawer.Root
      handle={handle}
      open={open}
      onOpenChange={setOpen}
      swipeDirection='right'
      modal={false}
      disablePointerDismissal
    >
      {({ payload }) => {
        const vessel = vessels.find(
          candidate => candidate.id === payload?.vesselId,
        );
        return (
          <Drawer.Portal container={map?.getContainer()}>
            <Drawer.Viewport className='pointer-events-none fixed inset-0 my-(--map-edge-inset) mr-4 z-60 flex justify-end overflow-hidden'>
              <Drawer.Popup
                ref={attachDrawerMotion}
                finalFocus={() => payload?.returnFocus.current ?? false}
                className='mission-drawer-popup pointer-events-auto relative flex flex-col rounded-2xl h-full w-96 max-w-[calc(100vw-24px)] overflow-hidden border-l bg-background text-foreground shadow-xl outline-none'
              >
                <Drawer.Content className='relative flex min-h-0 flex-1 flex-col overflow-hidden'>
                  {vessel && (
                    <MissionPlanner
                      key={vessel.id}
                      vessel={vessel}
                      draft={drafts[vessel.id] ?? createMissionDraft(vessel.simulation.getSnapshot().speed)}
                      onDraftChange={draft => setDrafts(current => ({ ...current, [vessel.id]: draft }))}
                      isOpen={open}
                      onSave={() => handle.close()}
                      onCancel={() => {
                        setDrafts(current => {
                          const next = { ...current };
                          delete next[vessel.id];
                          return next;
                        });
                        handle.close();
                      }}
                    />
                  )}
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        );
      }}
    </Drawer.Root>
  );
}
