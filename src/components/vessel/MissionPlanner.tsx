import { MissionSpeedControl } from './MissionSpeedControl';
import { NumberPopIn } from '@/components/NumberPopIn';
import { CLOSE_BUTTON_CLASS } from '@/components/CloseButton';
import { getVesselIdentity } from '@/lib/vessel/vessel';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '@base-ui/react/button';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Drawer } from '@base-ui/react/drawer';
import { ArrowUpLeft, ChevronRight, Grid2X2, Map as MapIcon, Route, X } from 'lucide-react';
import type { MapMouseEvent } from 'maplibre-gl';
import {
  MapGeoJSON,
  MapMarker,
  MarkerContent,
  useMap,
} from '@/components/ui/map';
import {
  addMissionWaypoint,
  buildGridPlan,
  canReviewMission,
  missionCoordinates,
  missionDistance,
  missionSpeedError,
} from '@/lib/vessel/mission';
import type { MissionDraft } from '@/lib/vessel/mission';
import type { Coordinate } from '@/lib/vessel/navigation';
import { fitMissionRoute } from '@/lib/mission-camera';
import type { Vessel } from '@/lib/vessel/vessel';
import { MissionNumberField } from './MissionNumberField';
import { GridMissionRoute } from './GridMissionRoute';
import { MissionPlacementCursor } from './MissionPlacementCursor';
import { WaypointMissionRoute } from './WaypointMissionRoute';

export type MissionPlanningStep = 'type' | 'route' | 'speeds';
const ROUTE_PLANNING_ZOOM = 11;

const secondaryButton =
  'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-xs hover:bg-white/[0.08] focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40';
const missionTypes = [
  {
    value: 'waypoint',
    label: 'Waypoint route',
    Icon: Route,
  },
  {
    value: 'grid',
    label: 'Grid coverage',
    Icon: Grid2X2,
  },
] as const;

function coordinateText(point: Coordinate) {
  return `${Math.abs(point[1]).toFixed(4)}° ${point[1] >= 0 ? 'N' : 'S'}, ${Math.abs(point[0]).toFixed(4)}° ${point[0] >= 0 ? 'E' : 'W'}`;
}

export function MissionPlanner({
  vessel,
  draft,
  onDraftChange,
  isOpen,
  onDeploy,
  onCancel,
  step,
  onStepChange: setStep,
  registerCloseGuard,
}: {
  vessel: Vessel;
  draft: MissionDraft;
  onDraftChange: (draft: MissionDraft) => void;
  isOpen: boolean;
  onDeploy: (draft: MissionDraft) => boolean;
  onCancel: () => void;
  step: MissionPlanningStep;
  onStepChange: (step: MissionPlanningStep) => void;
  registerCloseGuard: (guard: () => boolean) => () => void;
}) {
  const { map } = useMap();
  const reduceMotion = useReducedMotion();
  const [newWaypoint, setNewWaypoint] = useState<Coordinate | null>(null);
  const attachScrollArea = useCallback((element: HTMLDivElement | null) => {
    if (!element) return;
    const alignPadding = () => {
      const gutter = (element.offsetWidth - element.clientWidth) / 2;
      element.style.setProperty('--drawer-scrollbar-inset', `${gutter}px`);
    };
    alignPadding();
    const observer = new ResizeObserver(alignPadding);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const speedErrorId = useId();
  const [editing, setEditing] = useState(
    step === 'route' && (draft.type === 'waypoint' || !draft.grid.center),
  );
  const [discardOpen, setDiscardOpen] = useState(false);
  const [waypointRevision, setWaypointRevision] = useState(0);
  const discardConfirmed = useRef(false);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const keepPlanningButton = useRef<HTMLButtonElement | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const placingWaypoints = step === 'route' && draft.type === 'waypoint';
  const placingGrid = step === 'route' && draft.type === 'grid' && editing;
  const placingOnMap = placingWaypoints || placingGrid;
  const gridPlan = useMemo(() => buildGridPlan(draft.grid), [draft.grid]);
  const coordinates = useMemo(() => missionCoordinates(draft), [draft]);
  const distance = useMemo(() => missionDistance(draft), [draft]);
  const speedError = missionSpeedError(draft, vessel.simulation.maxSpeed);
  const hasRoute = coordinates.length > 1;
  const hasPlannedPoints =
    draft.waypoints.length > 0 || draft.grid.center !== null;
  const hasMissionDetails = step !== 'type' || hasPlannedPoints;
  useEffect(() => {
    if (!isOpen) return;
    return registerCloseGuard(() => {
      if (!hasMissionDetails) return true;
      setDiscardOpen(true);
      return false;
    });
  }, [isOpen, registerCloseGuard, hasMissionDetails]);
  const hasTurns = draft.type === 'grid' || draft.waypoints.length > 1;
  const placementView = useRef<{
    center: Coordinate;
    zoom: number;
    bearing: number;
    pitch: number;
  } | null>(null);
  const minutes =
    draft.speed && draft.speed > 0
      ? Math.ceil((distance / draft.speed) * 60)
      : null;
  const duration =
    minutes === null
      ? '—'
      : minutes < 1
        ? '<1 min'
        : minutes < 60
          ? `${minutes} min`
          : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
  const update = (changes: Partial<MissionDraft>) =>
    onDraftChange({ ...draft, ...changes, saved: false });
  const updateGrid = (changes: Partial<MissionDraft['grid']>) =>
    update({ grid: { ...draft.grid, ...changes } });

  const addPoint = useEffectEvent((event: MapMouseEvent) => {
    if (!(event.originalEvent.target instanceof HTMLCanvasElement)) return;
    const point: Coordinate = [event.lngLat.lng, event.lngLat.lat];
    const position = vessel.simulation.getFrame().position;
    if (draft.type === 'waypoint') {
      const next = addMissionWaypoint(draft, position, point);
      if (next !== draft) {
        setNewWaypoint(next.waypoints[next.waypoints.length - 1]);
        setWaypointRevision(current => current + 1);
        onDraftChange(next);
      }
    } else {
      const grid = {
        ...draft.grid,
        center: [...point],
        origin: draft.grid.origin ?? [...position],
      } satisfies MissionDraft['grid'];
      updateGrid(grid);
      setEditing(false);
      const plan = buildGridPlan(grid);
      if (map && plan.boundary.length) {
        const framingPoints = [position, ...plan.boundary];
        const longitudes = framingPoints.map(
          ([longitude]) =>
            point[0] + ((longitude - point[0] + 540) % 360) - 180,
        );
        const latitudes = framingPoints.map(([, latitude]) => latitude);
        const container = map.getContainer();
        const drawerWidth =
          container
            .querySelector('.mission-drawer-popup')
            ?.getBoundingClientRect().width ?? 384;
        map.fitBounds(
          [
            [Math.min(...longitudes), Math.min(...latitudes)],
            [Math.max(...longitudes), Math.max(...latitudes)],
          ],
          {
            padding: {
              top: 96,
              bottom: 96,
              left: 64,
              right: Math.min(drawerWidth + 96, container.clientWidth - 100),
            },
            maxZoom: 18,
            duration: 350,
            animate: !window.matchMedia('(prefers-reduced-motion: reduce)')
              .matches,
          },
        );
      }
    }
  });

  useEffect(() => {
    if (!map || !isOpen || !placingOnMap) return;
    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';
    const listener = (event: MapMouseEvent) => addPoint(event);
    map.on('click', listener);
    return () => {
      map.off('click', listener);
      canvas.style.cursor = previousCursor;
    };
  }, [map, isOpen, placingOnMap]);

  const boundary = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [gridPlan.boundary] },
    }),
    [gridPlan.boundary],
  );
  const frameVessel = (zoom: number) => {
    if (!map) return;
    const container = map.getContainer();
    const drawerWidth =
      container.querySelector('.mission-drawer-popup')?.getBoundingClientRect()
        .width ?? 384;
    const occupied = Math.min(drawerWidth + 32, container.clientWidth - 80);
    map.easeTo({
      center: vessel.simulation.getFrame().position,
      zoom,
      offset: [-occupied / 2, 0],
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 0
        : 300,
    });
  };

  const frameRoute = () => {
    if (!map) return;
    const points = [vessel.simulation.getFrame().position, ...coordinates];
    if (draft.type === 'grid') points.push(...gridPlan.boundary);
    fitMissionRoute(map, points);
  };

  const editRoute = () => {
    setStep('route');
    setEditing(draft.type === 'waypoint' || !draft.grid.center);
    if (map && placementView.current) {
      map.easeTo({
        ...placementView.current,
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 0
          : 300,
      });
    } else if (map && hasRoute) {
      frameRoute();
    } else {
      frameVessel(
        Math.min(map?.getZoom() ?? ROUTE_PLANNING_ZOOM, ROUTE_PLANNING_ZOOM),
      );
    }
  };
  const discardDraft = () => {
    discardConfirmed.current = true;
    setDiscardOpen(false);
  };
  const routeReady =
    hasRoute && (draft.type !== 'grid' || (!gridPlan.error && !editing));

  return (
    <>
      {isOpen &&
        placingGrid &&
        map &&
        createPortal(
          <div className='pointer-events-none absolute top-4 right-120 left-4 z-50 flex justify-center'>
            <div className='max-w-full rounded-xl border border-white/15 bg-neutral-900 px-4 py-3 text-neutral-100 shadow-md'>
              <p role='status' className='text-sm font-medium'>
                Click the map to place the center of your grid.
              </p>
            </div>
          </div>,
          map.getContainer(),
        )}
      {isOpen && placingOnMap && (
        <MissionPlacementCursor
          label={placingGrid ? 'Place grid center' : 'Place waypoint'}
        />
      )}
      {isOpen && draft.type === 'grid' && gridPlan.boundary.length > 0 && (
        <MapGeoJSON
          id={`mission-area-${vessel.id}`}
          data={boundary}
          fillPaint={{ 'fill-color': '#14b8a6', 'fill-opacity': 0.04 }}
          linePaint={{
            'line-color': '#5ea8a3',
            'line-width': 1,
            'line-opacity': 0.5,
            'line-dasharray': [4, 4],
          }}
        />
      )}
      {isOpen && draft.type === 'grid' && hasRoute && (
        <GridMissionRoute
          id={`mission-grid-${vessel.id}`}
          origin={draft.grid.origin}
          route={gridPlan.route}
        />
      )}
      {draft.type === 'waypoint' && (
        <WaypointMissionRoute
          id={`mission-draft-${vessel.id}`}
          coordinates={coordinates}
          revision={waypointRevision}
          visible={isOpen}
        />
      )}
      {isOpen &&
        draft.type === 'waypoint' &&
        draft.waypoints.map((point, index) => (
          <MapMarker
            key={`${index}-${point.join(',')}`}
            longitude={point[0]}
            latitude={point[1]}
            draggable={step === 'route'}
            onDragEnd={({ lng, lat }) =>
              update({
                waypoints: draft.waypoints.map((current, i) =>
                  i === index ? [lng, lat] : current,
                ),
              })
            }
          >
            <MarkerContent>
              <motion.span
                aria-label={`Mission waypoint ${index + 1}`}
                initial={
                  !reduceMotion && point === newWaypoint
                    ? { scale: 0.9 }
                    : false
                }
                animate={{ scale: 1 }}
                transition={{ type: 'spring', visualDuration: 0.2, bounce: 0 }}
                onAnimationComplete={() =>
                  setNewWaypoint(current =>
                    current === point ? null : current,
                  )
                }
                className='flex size-6 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-[10px] font-medium text-white shadow-sm'
              >
                {index + 1}
              </motion.span>
            </MarkerContent>
          </MapMarker>
        ))}
      {isOpen &&
        step === 'route' &&
        editing &&
        draft.type === 'grid' &&
        draft.grid.center && (
          <MapMarker
            longitude={draft.grid.center[0]}
            latitude={draft.grid.center[1]}
          >
            <MarkerContent>
              <span
                aria-label='Grid center'
                className='block size-3 rounded-sm border-2 border-white bg-teal-600'
              />
            </MarkerContent>
          </MapMarker>
        )}

      <header className='shrink-0 px-5 pt-5 pb-3'>
        <Drawer.Description className='mb-2 pr-8 text-xs tracking-wide text-muted-foreground'>
          {getVesselIdentity(vessel)}
        </Drawer.Description>
        <Drawer.Title className='pr-8 text-lg font-medium'>
          {step === 'speeds'
              ? 'Prepare mission'
              : placingWaypoints
                ? 'Plan a waypoint route'
                : 'Plan a mission'}
        </Drawer.Title>

        <Drawer.Close
          ref={closeButton}
          aria-label='Close mission planner'
          className={`absolute top-5 right-5 ${CLOSE_BUTTON_CLASS}`}
        >
          <X className='size-4' />
        </Drawer.Close>
      </header>

      <div
        ref={attachScrollArea}
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-[calc(1.25rem-var(--drawer-scrollbar-inset,0px))] scrollbar-thin scrollbar-gutter-both'
      >
        <motion.div
          key={step}
          className='mission-drawer-body flow-root pb-5'
          initial={
            reduceMotion ? false : { opacity: 0, transform: 'translateY(4px)' }
          }
          animate={{ opacity: 1, transform: 'translateY(0px)' }}
          transition={{
            duration: reduceMotion ? 0 : 0.15,
            ease: [0.215, 0.61, 0.355, 1],
          }}
        >
          {!placingWaypoints && (
            <section className={step === 'type' ? '' : 'border-t pt-4'}>
              {step === 'type' ? (
                <div aria-label='Mission type' className='grid gap-1.5'>
                  {missionTypes.map(({ value, label, Icon }) => (
                    <Button
                      key={value}
                      onClick={() => {
                        // Keep focus in the persistent header before this button unmounts.
                        closeButton.current?.focus({ preventScroll: true });
                        update({ type: value });
                        placementView.current = null;
                        setStep('route');
                        setEditing(value === 'waypoint' || !draft.grid.center);
                        frameVessel(
                          Math.min(
                            map?.getZoom() ?? ROUTE_PLANNING_ZOOM,
                            ROUTE_PLANNING_ZOOM,
                          ),
                        );
                      }}
                      className='group/mission-type -mx-1.5 flex min-h-12 min-w-0 cursor-pointer items-center gap-3 rounded-[10px] py-2 pr-3.5 pl-1.5 text-left outline-none hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-ring'
                    >
                      <span className='grid size-8 shrink-0 place-items-center rounded-lg border border-white/5 bg-white/5 text-neutral-200'>
                        <Icon className='size-4' />
                      </span>
                      <span className='text-xs font-medium'>{label}</span>
                      <ChevronRight
                        aria-hidden='true'
                        className='ml-auto size-4 shrink-0 text-neutral-500 group-hover/mission-type:text-neutral-200'
                      />
                    </Button>
                  ))}
                </div>
              ) : (
                <div className='flex items-start justify-between gap-3'>
                  <div className={step === 'speeds' ? '' : 'flex w-full items-center justify-between gap-3'}>
                  <h3 className='text-sm font-medium'>
                    {draft.type === 'grid'
                      ? 'Grid mission'
                      : 'Waypoint mission'}
                  </h3>
                  {(draft.type === 'waypoint'
                    ? draft.waypoints.length > 0
                    : gridPlan.passCount > 0) && (
                    <span className={`text-xs text-muted-foreground ${step === 'speeds' ? 'mt-1 block' : ''}`}>
                      {draft.type === 'grid'
                        ? `${gridPlan.passCount} passes`
                        : `${draft.waypoints.length} waypoint${draft.waypoints.length === 1 ? '' : 's'}`}
                    </span>
                  )}
                  </div>
                  {step === 'speeds' && (
                    <Button onClick={frameRoute} className='-mt-2 inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded px-1 text-xs text-[#bfcecf] hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'>
                      <MapIcon aria-hidden='true' className='size-3.5' />
                      Show route
                    </Button>
                  )}
                </div>
              )}
            </section>
          )}

          {step === 'route' && (
            <section
              className={placingWaypoints ? '' : 'mt-5'}
              aria-label='Build mission route'
            >
              {placingWaypoints && draft.waypoints.length === 0 && (
                <div className='mb-3 flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/5 p-3'>
                  <ArrowUpLeft
                    aria-hidden='true'
                    className='mt-0.5 size-4 shrink-0 text-neutral-400'
                  />
                  <p
                    role='status'
                    className='text-xs leading-relaxed text-neutral-400'
                  >
                    Choose the first waypoint on the map.
                  </p>
                </div>
              )}
              {!placingWaypoints && (
                <p className='mb-3 text-xs leading-relaxed text-muted-foreground'>
                  Place the grid on the map, then adjust its dimensions and
                  spacing.
                </p>
              )}
              {placingWaypoints && hasPlannedPoints && (
                <p className='mb-2 text-[10px] leading-relaxed text-muted-foreground'>
                  Drag a numbered point to move it, or remove it below.
                </p>
              )}
              {draft.type === 'waypoint' ? (
                <>
                  {draft.waypoints.length > 0 && (
                    <ol className='space-y-0.5'>
                      {draft.waypoints.map((point, index) => (
                        <li
                          key={`${index}-${point.join(',')}`}
                          className='group/waypoint flex min-h-9 items-center gap-2 rounded-md px-1.5 py-1 text-[11px] tabular-nums hover:bg-white/8 focus-within:bg-white/5'
                        >
                          <span className='w-7 shrink-0 text-center text-neutral-400'>
                            {index + 1}
                          </span>
                          <span
                            className='min-w-0 flex-1 truncate'
                            title={coordinateText(point)}
                          >
                            {coordinateText(point)}
                          </span>
                          <button
                            type='button'
                            aria-label={`Remove waypoint ${index + 1}`}
                            className='flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-400 group-hover/waypoint:text-neutral-200 hover:bg-white/8 focus-visible:outline-2 focus-visible:outline-ring'
                            onClick={() =>
                              update({
                                waypoints: draft.waypoints.filter(
                                  (_, i) => i !== index,
                                ),
                              })
                            }
                          >
                            <X className='size-3.5' />
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </>
              ) : (
                <>
                  {draft.grid.center && !editing && (
                    <div className='rounded-xl bg-muted p-4'>
                      <h3 className='text-base font-medium'>
                        Define grid area
                      </h3>
                      <p className='mt-1 mb-4 text-xs leading-relaxed text-muted-foreground'>
                        Adjust the dimensions and passes using the map preview.
                      </p>
                      <div className='grid grid-cols-2 gap-3'>
                        <MissionNumberField
                          label='Width'
                          unit='m'
                          value={draft.grid.width}
                          min={10}
                          max={20000}
                          step={10}
                          onValueChange={width => updateGrid({ width })}
                        />
                        <MissionNumberField
                          label='Height'
                          unit='m'
                          value={draft.grid.height}
                          min={10}
                          max={20000}
                          step={10}
                          onValueChange={height => updateGrid({ height })}
                        />
                        <MissionNumberField
                          label='Grid rotation'
                          unit='°'
                          value={draft.grid.heading}
                          min={0}
                          max={359}
                          step={5}
                          onValueChange={heading => updateGrid({ heading })}
                        />
                        <MissionNumberField
                          label='Pass spacing'
                          unit='m'
                          value={draft.grid.spacing}
                          min={1}
                          step={1}
                          onValueChange={spacing => updateGrid({ spacing })}
                        />
                      </div>
                      <p className='mt-3 text-[10px] leading-relaxed text-muted-foreground'>
                        0° runs passes north–south. Rotation turns the whole
                        grid clockwise.
                      </p>
                      <Button
                        className={`${secondaryButton} mt-3 bg-background`}
                        onClick={() => setEditing(true)}
                      >
                        Reposition grid
                      </Button>
                      {gridPlan.error && (
                        <p role='alert' className='mt-2 text-xs text-red-300'>
                          {gridPlan.error}
                        </p>
                      )}
                    </div>
                  )}
                  {draft.grid.center && editing && (
                    <Button
                      className={secondaryButton}
                      onClick={() => setEditing(false)}
                    >
                      Keep current position
                    </Button>
                  )}
                </>
              )}
            </section>
          )}

          {step !== 'type' && hasRoute && (
            <>
              <section
                aria-label='Route summary'
                className='mt-3 text-xs tabular-nums'
              >
                <dl className='mt-1 grid grid-cols-2 gap-3'>
                  <div>
                    <dt className='text-muted-foreground'>Distance</dt>
                    <dd className='mt-1 text-sm font-medium'>
                      <NumberPopIn value={distance.toFixed(2)} /> nm
                    </dd>
                  </div>
                  <div aria-live='polite' aria-atomic='true'>
                    <dt className='text-muted-foreground'>Est. travel time</dt>
                    <dd className='mt-1 text-sm font-medium'>
                      {step === 'speeds' ? (
                        duration
                      ) : (
                        <NumberPopIn value={duration} />
                      )}
                    </dd>
                  </div>

                </dl>
                <p className={`mt-3 text-[10px] leading-relaxed text-muted-foreground ${step === 'speeds' ? 'border-b border-white/10 pb-4' : ''}`}>
                  Time estimate uses straight-line speed; acceleration and turns
                  add time.
                </p>
                {draft.type === 'grid' && step !== 'route' && (
                  <dl
                    aria-label='Grid configuration'
                    className='mt-4 grid grid-cols-2 gap-3 border-t pt-4'
                  >
                    <div>
                      <dt className='text-muted-foreground'>Width</dt>
                      <dd className='mt-1'>
                        {draft.grid.width?.toLocaleString('en-US') ?? '—'} m
                      </dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>Height</dt>
                      <dd className='mt-1'>
                        {draft.grid.height?.toLocaleString('en-US') ?? '—'} m
                      </dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>Rotation</dt>
                      <dd className='mt-1'>{draft.grid.heading ?? '—'}°</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>Pass spacing</dt>
                      <dd className='mt-1'>
                        {draft.grid.spacing?.toLocaleString('en-US') ?? '—'} m
                      </dd>
                    </div>
                  </dl>
                )}
              </section>
              {step === 'speeds' && (
                <section className='mt-1' aria-label='Mission speeds'>
                  <div className='mission-speed-pair'>
                    <MissionSpeedControl
                      label='Straight-line speed'
                      value={draft.speed}
                      max={vessel.simulation.maxSpeed}
                      onValueChange={speed =>
                        update({
                          speed,
                          ...(!hasTurns && speed !== null
                            ? {
                                turnSpeed: Math.min(
                                  draft.turnSpeed ?? 4,
                                  speed,
                                ),
                              }
                            : {}),
                        })
                      }
                      errorId={speedError ? speedErrorId : undefined}
                    />
                    {hasTurns && (
                      <MissionSpeedControl
                        label='Turn speed'
                        value={draft.turnSpeed}
                        max={vessel.simulation.maxSpeed}
                        onValueChange={turnSpeed => update({ turnSpeed })}
                        errorId={speedError ? speedErrorId : undefined}
                      />
                    )}
                  </div>
                  {speedError && (
                    <p
                      id={speedErrorId}
                      role='alert'
                      className='mt-2 text-xs text-red-300'
                    >
                      {speedError}
                    </p>
                  )}
                </section>
              )}

            </>
          )}
        </motion.div>
      </div>

      {step !== 'type' && (
        <footer className='shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
          {step === 'speeds' && (
            <p className='mb-3 px-1 text-[11px] leading-relaxed text-[#bbc5ca]'>
              {vessel.id} will begin moving as soon as you deploy the mission.
            </p>
          )}
          {deploymentError && (
            <p role='alert' className='mb-2 text-xs text-destructive'>
              {deploymentError}
            </p>
          )}
          <Button
            type='button'
            className='mb-2 flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md border border-transparent bg-[#2b3033] px-3 py-2 text-xs font-medium text-[#bcbcb7] transition-[background-color,color] duration-150 ease-[ease] motion-reduce:transition-none hover:bg-white/10 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-100'
            onClick={() => {
              if (step === 'speeds') editRoute();
              else {
                setEditing(false);
                setStep('type');
              }
            }}
          >
            {step === 'speeds'
                ? 'Back to route'
                : 'Back to mission type'}
          </Button>
          <Button
            type='button'
            hidden={placingWaypoints && !hasRoute}
            disabled={
              step === 'route'
                ? !routeReady
                : !canReviewMission(draft, vessel.simulation.maxSpeed)
            }
            className='flex min-h-9 w-full cursor-pointer items-center justify-center rounded-md bg-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-default disabled:opacity-40'
            onClick={() => {
              setEditing(false);
              if (step === 'route') {
                setStep('speeds');
                if (!hasTurns && draft.speed !== null && draft.speed > 0)
                  update({
                    turnSpeed: Math.min(
                      draft.turnSpeed && draft.turnSpeed > 0
                        ? draft.turnSpeed
                        : 4,
                      draft.speed,
                    ),
                  });
                if (map) {
                  const center = map.getCenter();
                  placementView.current = {
                    center: [center.lng, center.lat],
                    zoom: map.getZoom(),
                    bearing: map.getBearing(),
                    pitch: map.getPitch(),
                  };
                  frameRoute();
                }
              } else {
                if (!onDeploy(draft))
                  setDeploymentError(
                    'Unable to deploy. Check the route and speeds, and make sure this vessel has no mission in progress.',
                  );
              }
            }}
          >
            {step === 'route' ? 'Prepare mission' : 'Deploy mission'}
          </Button>
        </footer>
      )}
      <AlertDialog.Root
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onOpenChangeComplete={open => {
          if (!open && discardConfirmed.current) {
            discardConfirmed.current = false;
            setEditing(false);
            onCancel();
          }
        }}
      >
        <AlertDialog.Portal container={map?.getContainer()}>
          <AlertDialog.Backdrop className='mission-discard-backdrop fixed inset-0 z-80 bg-black/30' />
          <AlertDialog.Viewport className='fixed inset-0 z-90 flex items-center justify-center p-4'>
            <AlertDialog.Popup
              initialFocus={keepPlanningButton}
              finalFocus={() =>
                discardConfirmed.current
                  ? false
                  : (closeButton.current ?? false)
              }
              className='mission-discard-dialog w-full max-w-sm rounded-lg border border-white/15 bg-neutral-900 p-6 text-neutral-100 shadow-md outline-none'
            >
              <AlertDialog.Title className='text-base font-medium'>
                Discard mission plan?
              </AlertDialog.Title>
              <AlertDialog.Description className='mt-2 text-sm leading-relaxed text-neutral-400'>
                The mission type, route, and speed settings for{' '}
                <span className='whitespace-nowrap font-medium text-neutral-100'>
                  {vessel.id}
                </span>{' '}
                will be removed.
              </AlertDialog.Description>
              <div className='mt-6 flex justify-end gap-2'>
                <AlertDialog.Close
                  ref={keepPlanningButton}
                  render={<Button />}
                  className='min-h-9 cursor-pointer rounded-md border border-transparent bg-transparent px-3 text-xs font-medium text-[#bcbcb7] transition-[background-color,color] duration-150 ease-[ease] motion-reduce:transition-none hover:bg-white/5 hover:text-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-100'
                >
                  Keep planning
                </AlertDialog.Close>
                <Button
                  onClick={discardDraft}
                  className='min-h-9 cursor-pointer rounded-md border border-transparent bg-[#a4443e] px-3 text-xs font-medium text-[#fff1ec] transition-[background-color,color] duration-150 ease-[ease] motion-reduce:transition-none hover:bg-[#be4f48] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300'
                >
                  Discard plan
                </Button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}
