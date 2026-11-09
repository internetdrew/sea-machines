import { useCallback, useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from 'react';
import { syncMissionDrawerSize } from '@/lib/mission-drawer-size';
import { syncDrawerControls } from '@/lib/drawer-controls-motion';
import type { ComponentProps, RefObject } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { useMap } from '@/components/ui/map';
import type { Vessel } from '@/lib/vessel/vessel';
import { MissionPlanner } from './MissionPlanner';
import type { MissionPlanningStep } from './MissionPlanner';
import { fitMissionRoute } from '@/lib/mission-camera';
import { createMissionDraft, missionCoordinates, buildGridPlan } from '@/lib/vessel/mission';
import { DEFAULT_MAP_ZOOM } from '@/lib/vessel/navigation';
import type { MissionDraft } from '@/lib/vessel/mission';
import { MissionMonitor } from './MissionMonitor';

function MissionDrawerBody({ onSelectionChange, ...props }: ComponentProps<typeof MissionPlanner> & { onSelectionChange?: (id: string | null, planning: boolean) => void }) {
  const { map } = useMap();
  const snapshot = useSyncExternalStore(props.vessel.simulation.subscribe, props.vessel.simulation.getSnapshot);
  const planning = !snapshot.mission;
  useEffect(() => {
    if (!props.isOpen) return;
    onSelectionChange?.(props.vessel.id, planning);
    return () => onSelectionChange?.(null, false);
  }, [props.isOpen, props.vessel.id, planning, onSelectionChange]);
  const frameOpening = useEffectEvent(() => {
    if (!map) return;
    const coordinates = missionCoordinates(props.draft);
    if (planning && coordinates.length > 1) {
      fitMissionRoute(map, [props.vessel.simulation.getFrame().position, ...coordinates, ...(props.draft.type === 'grid' ? buildGridPlan(props.draft.grid).boundary : [])]);
      return;
    }
    const container = map.getContainer();
    const width = container.querySelector('.mission-drawer-popup')?.getBoundingClientRect().width ?? 384;
    const occupied = Math.min(width + 32, container.clientWidth - 80);
    map.easeTo({ center: props.vessel.simulation.getFrame().position, zoom: Math.max(map.getZoom(), DEFAULT_MAP_ZOOM), offset: [-occupied / 2, 0], duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 });
  });
  useEffect(() => {
    if (!map || !props.isOpen) return;
    // Run once for this drawer/vessel, after its DOM has mounted. Never follow
    // live telemetry or pull the camera back after the operator pans.
    const frame = requestAnimationFrame(() => frameOpening());
    return () => cancelAnimationFrame(frame);
  }, [map, props.isOpen, props.vessel]);
  return snapshot.mission ? <MissionMonitor vessel={props.vessel} /> : <MissionPlanner {...props} />;
}

export type MissionDrawerPayload = {
  vesselId: string;
  returnFocus: RefObject<HTMLElement | null>;
};

export function MissionDrawer({
  handle,
  vessels,
  onDeploy,
  onSelectionChange,
}: {
  handle: Drawer.Handle<MissionDrawerPayload>;
  vessels: readonly Vessel[];
  onDeploy?: () => void;
  onSelectionChange?: (id: string | null, planning: boolean) => void;
}) {
  const { map } = useMap();
  const [open, setOpen] = useState(false);
  const closeGuard = useRef<(() => boolean) | null>(null);
  const registerCloseGuard = useCallback((guard: () => boolean) => {
    closeGuard.current = guard;
    return () => { if (closeGuard.current === guard) closeGuard.current = null; };
  }, []);
  const [steps, setSteps] = useState<Record<string, MissionPlanningStep>>({});
  const [drafts, setDrafts] = useState<Record<string, MissionDraft>>({});
  const attachDrawerMotion = useCallback((popup: HTMLDivElement | null) => {
    if (!popup || !map) return;
    const stopMotion = syncDrawerControls(map.getContainer(), popup);
    const stopSizing = syncMissionDrawerSize(popup);
    return () => { stopSizing(); stopMotion?.(); };
  }, [map]);
  return (
    <Drawer.Root
      handle={handle}
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen) {
          if (closeGuard.current && !closeGuard.current()) { details.cancel(); return; }
          onSelectionChange?.(null, false);
        }
        setOpen(nextOpen);
      }}
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
                className='dark mission-drawer-popup pointer-events-auto relative flex self-start flex-col rounded-2xl max-h-full w-96 max-w-[calc(100vw-24px)] overflow-hidden border border-white/15 bg-[#262626] text-foreground shadow-xl outline-none'
              >
                <Drawer.Content className='mission-drawer-content relative flex min-h-0 flex-1 flex-col overflow-hidden'>
                  {vessel && (
                    <MissionDrawerBody
                      key={vessel.id}
                      vessel={vessel}
                      draft={drafts[vessel.id] ?? createMissionDraft(vessel.simulation.getSnapshot().cruiseSpeed)}
                      onDraftChange={draft => setDrafts(current => ({ ...current, [vessel.id]: draft }))}
                      isOpen={open}
                      onSelectionChange={onSelectionChange}
                      step={steps[vessel.id] ?? 'type'}
                      onStepChange={step => setSteps(current => ({ ...current, [vessel.id]: step }))}
                      registerCloseGuard={registerCloseGuard}
                      onDeploy={draft => {
                        if (!vessel.simulation.deploy(draft)) return false;
                        onDeploy?.();
                        setSteps(current => ({ ...current, [vessel.id]: 'type' }));
                        setDrafts(current => {
                          const next = { ...current };
                          delete next[vessel.id];
                          return next;
                        });
                        const deployment = vessel.simulation.getFrame().mission!;
                        if (map) {
                          const longitudes = deployment.coordinates.map(([lon]) => deployment.origin[0] + ((lon - deployment.origin[0] + 540) % 360) - 180);
                          const latitudes = deployment.coordinates.map(([, lat]) => lat);
                          map.fitBounds([[Math.min(...longitudes), Math.min(...latitudes)], [Math.max(...longitudes), Math.max(...latitudes)]], {
                            padding: { top: 80, bottom: 80, left: 64, right: Math.min((map.getContainer().querySelector('.mission-drawer-popup')?.getBoundingClientRect().width ?? 384) + 80, map.getContainer().clientWidth - 100) },
                            maxZoom: 17,
                            duration: 350,
                            animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
                          });
                        }
                        return true;
                      }}
                      onCancel={() => {
                        closeGuard.current = null;
                        setSteps(current => ({ ...current, [vessel.id]: 'type' }));
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
