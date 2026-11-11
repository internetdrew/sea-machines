import { useFleetInteraction, useFleetInteractions } from '@/lib/vessel/use-interactions';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { syncMissionDrawerSize } from '@/lib/mission-drawer-size';
import type { ComponentProps, RefObject } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { useMap } from '@/components/ui/map';
import type { Vessel } from '@/lib/vessel/vessel';
import { MissionPlanner } from './MissionPlanner';
import type { MissionPlanningStep } from './MissionPlanner';
import { fitMissionRoute } from '@/lib/mission-camera';
import {
  createVesselMissionDraft,
  missionCoordinates,
  buildGridPlan,
} from '@/lib/vessel/mission';
import { DEFAULT_MAP_ZOOM } from '@/lib/vessel/navigation';
import type { MissionDraft } from '@/lib/vessel/mission';
import { MissionMonitor } from './MissionMonitor';

function MissionDrawerBody(props: ComponentProps<typeof MissionPlanner>) {
  const { map } = useMap();
  const snapshot = useSyncExternalStore(
    props.vessel.simulation.subscribe,
    props.vessel.simulation.getSnapshot,
  );
  const planning = !snapshot.mission;
  const frameOpening = useEffectEvent(() => {
    if (!map) return;
    const coordinates = missionCoordinates(props.draft);
    if (planning && coordinates.length > 1) {
      fitMissionRoute(map, [
        props.vessel.simulation.getFrame().position,
        ...coordinates,
        ...(props.draft.type === 'grid'
          ? buildGridPlan(props.draft.grid).boundary
          : []),
      ]);
      return;
    }
    const container = map.getContainer();
    const width =
      container.querySelector('.mission-drawer-popup')?.getBoundingClientRect()
        .width ?? 384;
    const occupied = Math.min(width + 74, container.clientWidth - 80);
    map.easeTo({
      center: props.vessel.simulation.getFrame().position,
      zoom: Math.max(map.getZoom(), DEFAULT_MAP_ZOOM),
      offset: [-occupied / 2, 0],
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : 300,
    });
  });
  useEffect(() => {
    if (!map || !props.isOpen) return;
    // Run once for this drawer/vessel, after its DOM has mounted. Never follow
    // live telemetry or pull the camera back after the operator pans.
    const frame = requestAnimationFrame(() => frameOpening());
    return () => cancelAnimationFrame(frame);
  }, [map, props.isOpen, props.vessel]);
  return snapshot.mission ? (
    <MissionMonitor vessel={props.vessel} />
  ) : (
    <MissionPlanner {...props} />
  );
}

export type MissionDrawerPayload = {
  vesselId: string;
  returnFocus: RefObject<HTMLElement | null>;
};

export function MissionDrawer({
  handle,
  vessels,
  onDeploy,
}: {
  handle: Drawer.Handle<MissionDrawerPayload>;
  vessels: readonly Vessel[];
  onDeploy?: () => void;
}) {
  const { map } = useMap();
  const interactions = useFleetInteractions();
  const open = useFleetInteraction(state => state.missionPanel !== null);
  const closeGuard = useRef<(() => boolean) | null>(null);
  const registerCloseGuard = useCallback((guard: () => boolean) => {
    closeGuard.current = guard;
    return () => {
      if (closeGuard.current === guard) closeGuard.current = null;
    };
  }, []);
  const [steps, setSteps] = useState<Record<string, MissionPlanningStep>>({});
  const [drafts, setDrafts] = useState<Record<string, MissionDraft>>({});
  const attachDrawerMotion = useCallback(
    (popup: HTMLDivElement | null) => {
      if (!popup || !map) return;
      return syncMissionDrawerSize(popup);
    },
    [map],
  );
  return (
    <Drawer.Root
      handle={handle}
      open={open}
      onOpenChange={(nextOpen, details) => {
        if (!nextOpen) {
          if (closeGuard.current && !closeGuard.current()) {
            details.cancel();
            return;
          }
          interactions.dispatch({ type: 'close-mission' });
        }
        if (nextOpen) {
          const id = details.trigger?.getAttribute('data-vessel-id');
          const vessel = vessels.find(candidate => candidate.id === id);
          if (!vessel) { details.cancel(); return; }
          const current = interactions.getSnapshot().missionPanel;
          if (current?.planning && current.vesselId !== id) { details.cancel(); return; }
          interactions.dispatch({ type: 'open-mission', vesselId: vessel.id, planning: !vessel.simulation.getSnapshot().mission });
        }
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
            <Drawer.Viewport className='mission-drawer-viewport pointer-events-none fixed inset-0 my-(--map-edge-inset) ml-4 mr-[calc(var(--map-edge-inset,1rem)+2.125rem+0.5rem)] z-60 flex justify-end overflow-hidden'>
              <Drawer.Popup
                ref={attachDrawerMotion}
                finalFocus={() => payload?.returnFocus.current ?? false}
                className='dark mission-drawer-popup pointer-events-auto relative flex self-start flex-col rounded-2xl max-h-full w-96 max-w-full overflow-hidden border border-neutral-800 bg-neutral-900 text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.22)] outline-none'
              >
                <Drawer.Content className='mission-drawer-content relative flex min-h-0 flex-1 flex-col overflow-hidden'>
                  {vessel && (
                    <MissionDrawerBody
                      key={vessel.id}
                      vessel={vessel}
                      draft={
                        drafts[vessel.id] ??
                        createVesselMissionDraft(
                          vessel.simulation.maxSpeed,
                        )
                      }
                      onDraftChange={draft =>
                        setDrafts(current => ({
                          ...current,
                          [vessel.id]: draft,
                        }))
                      }
                      isOpen={open}
                      step={steps[vessel.id] ?? 'type'}
                      onStepChange={step => {
                        if (step !== 'type') interactions.dispatch({ type: 'lock-planning', vesselId: vessel.id });
                        setSteps(current => ({
                          ...current,
                          [vessel.id]: step,
                        }));
                      }}
                      registerCloseGuard={registerCloseGuard}
                      onDeploy={draft => {
                        if (!vessel.simulation.deploy(draft)) return false;
                        interactions.dispatch({ type: 'mission-deployed', vesselId: vessel.id });
                        // Deployment replaces the planner and its focused button.
                        requestAnimationFrame(() => {
                          map
                            ?.getContainer()
                            .querySelector<HTMLElement>('.mission-drawer-popup')
                            ?.focus({ preventScroll: true });
                        });
                        onDeploy?.();
                        setSteps(current => ({
                          ...current,
                          [vessel.id]: 'type',
                        }));
                        setDrafts(current => {
                          const next = { ...current };
                          delete next[vessel.id];
                          return next;
                        });
                        const deployment =
                          vessel.simulation.getFrame().mission!;
                        if (map) {
                          const longitudes = deployment.coordinates.map(
                            ([lon]) =>
                              deployment.origin[0] +
                              ((lon - deployment.origin[0] + 540) % 360) -
                              180,
                          );
                          const latitudes = deployment.coordinates.map(
                            ([, lat]) => lat,
                          );
                          map.fitBounds(
                            [
                              [Math.min(...longitudes), Math.min(...latitudes)],
                              [Math.max(...longitudes), Math.max(...latitudes)],
                            ],
                            {
                              padding: {
                                top: 80,
                                bottom: 80,
                                left: 64,
                                right: Math.min(
                                  (map
                                    .getContainer()
                                    .querySelector('.mission-drawer-popup')
                                    ?.getBoundingClientRect().width ?? 384) +
                                    122,
                                  map.getContainer().clientWidth - 100,
                                ),
                              },
                              maxZoom: 17,
                              duration: 350,
                              animate: !window.matchMedia(
                                '(prefers-reduced-motion: reduce)',
                              ).matches,
                            },
                          );
                        }
                        return true;
                      }}
                      onCancel={() => {

                        closeGuard.current = null;
                        setSteps(current => ({
                          ...current,
                          [vessel.id]: 'type',
                        }));
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
