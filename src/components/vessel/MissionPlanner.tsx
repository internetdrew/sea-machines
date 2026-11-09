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
import { Button } from '@base-ui/react/button';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Drawer } from '@base-ui/react/drawer';
import { Grid2X2, Route, X } from 'lucide-react';
import type { MapMouseEvent } from 'maplibre-gl';
import {
  MapGeoJSON,
  MapMarker,
  MapRoute,
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
  missionHasTurns,
} from '@/lib/vessel/mission';
import type { MissionDraft } from '@/lib/vessel/mission';
import type { Coordinate } from '@/lib/vessel/navigation';
import { fitMissionRoute } from '@/lib/mission-camera';
import type { Vessel } from '@/lib/vessel/vessel';
import { MissionNumberField } from './MissionNumberField';
import { GridMissionRoute } from './GridMissionRoute';

export type MissionPlanningStep = 'type' | 'route' | 'speeds' | 'review';
const ROUTE_PLANNING_ZOOM = 11;

const secondaryButton =
  'inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-xs hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40';
const missionTypes = [
  {
    value: 'waypoint',
    label: 'Waypoint',
    description: 'Follow selected points',
    Icon: Route,
  },
  {
    value: 'grid',
    label: 'Grid',
    description: 'Cover an area in passes',
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
  const typeLabelId = useId();
  const [editing, setEditing] = useState(step === 'route' && (draft.type === 'waypoint' || !draft.grid.center));
  const [discardOpen, setDiscardOpen] = useState(false);
  const [hoverCoordinate, setHoverCoordinate] = useState<{ longitude: number; latitude: number; x: number; y: number } | null>(null);
  const discardConfirmed = useRef(false);
  const closeButton = useRef<HTMLButtonElement | null>(null);
  const keepPlanningButton = useRef<HTMLButtonElement | null>(null);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const reviewing = step === 'review';
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
  const hasTurns = missionHasTurns(draft);
  const placementView = useRef<{ center: Coordinate; zoom: number; bearing: number; pitch: number } | null>(null);
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
      if (next !== draft) onDraftChange(next);
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
    if (!map || !placingOnMap || !isOpen) {
      setHoverCoordinate(null);
      return;
    }
    const updateHover = (event: MapMouseEvent) => {
      const original = event.originalEvent;
      if (!(original instanceof MouseEvent)) return;
      const bounds = map.getContainer().getBoundingClientRect();
      setHoverCoordinate({ longitude: event.lngLat.lng, latitude: event.lngLat.lat, x: original.clientX - bounds.left, y: original.clientY - bounds.top });
    };
    const clearHover = () => setHoverCoordinate(null);
    map.on('mousemove', updateHover);
    map.on('mouseout', clearHover);
    return () => {
      map.off('mousemove', updateHover);
      map.off('mouseout', clearHover);
    };
  }, [map, placingOnMap, isOpen]);

  useEffect(() => {
    if (!map || (!editing && !placingWaypoints) || !isOpen || step !== 'route') return;
    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';
    const listener = (event: MapMouseEvent) => addPoint(event);
    map.on('click', listener);
    return () => {
      map.off('click', listener);
      canvas.style.cursor = previousCursor;
    };
  }, [map, editing, placingWaypoints, isOpen, step]);

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
    const drawerWidth = container.querySelector('.mission-drawer-popup')?.getBoundingClientRect().width ?? 384;
    const occupied = Math.min(drawerWidth + 32, container.clientWidth - 80);
    map.easeTo({
      center: vessel.simulation.getFrame().position,
      zoom,
      offset: [-occupied / 2, 0],
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
    });
  };

  const editRoute = () => {
    setStep('route');
    setEditing(draft.type === 'waypoint' || !draft.grid.center);
    if (map && placementView.current) {
      map.easeTo({ ...placementView.current, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300 });
    } else if (map && hasRoute) {
      fitMissionRoute(map, [vessel.simulation.getFrame().position, ...coordinates, ...(draft.type === 'grid' ? gridPlan.boundary : [])]);
    } else {
      frameVessel(Math.min(map?.getZoom() ?? ROUTE_PLANNING_ZOOM, ROUTE_PLANNING_ZOOM));
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
        (placingWaypoints ||
          (step === 'route' && draft.type === 'grid' && editing)) &&
        map &&
        createPortal(
          <div className='pointer-events-none absolute top-4 right-120 left-4 z-50 flex justify-center'>
            <div className='max-w-full rounded-xl border border-white/15 bg-neutral-900 px-4 py-3 text-neutral-100 shadow-md'>
              <p role='status' className='text-sm font-medium'>
                {draft.type === 'grid'
                  ? 'Click the map to place the center of your grid.'
                  : draft.waypoints.length === 0
                    ? 'Click the map to place your first waypoint.'
                    : 'Click the map to add the next waypoint.'}
              </p>
            </div>
          </div>,
          map.getContainer(),
        )}
      {map && placingOnMap && hoverCoordinate && createPortal(
        <div
          aria-hidden='true'
          className='pointer-events-none absolute z-70 rounded-md border border-teal-400/30 bg-neutral-900 px-2.5 py-2 text-neutral-100 shadow-md'
          style={{
            left: hoverCoordinate.x,
            top: hoverCoordinate.y,
            transform: `translate(${hoverCoordinate.x > map.getContainer().clientWidth - 240 ? 'calc(-100% - 10px)' : '10px'}, ${hoverCoordinate.y > map.getContainer().clientHeight - 72 ? 'calc(-100% - 10px)' : '10px'})`,
          }}
        >
          <span className='mb-1 block text-[9px] font-medium uppercase tracking-[0.09em] text-teal-300'>{placingGrid ? 'Place grid center' : 'Place waypoint'}</span>
          <span className='block font-mono text-xs tabular-nums'>
            {coordinateText([hoverCoordinate.longitude, hoverCoordinate.latitude])}
          </span>
        </div>,
        map.getContainer(),
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
      {isOpen && draft.type === 'waypoint' && hasRoute && (
        <MapRoute
          id={`mission-draft-${vessel.id}`}
          coordinates={coordinates}
          color='#14b8a6'
          width={3}
          opacity={1}
          interactive={false}
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
            onDragEnd={({ lng, lat }) => update({ waypoints: draft.waypoints.map((current, i) => i === index ? [lng, lat] : current) })}
          >
            <MarkerContent>
              <span
                aria-label={`Mission waypoint ${index + 1}`}
                className='flex size-6 items-center justify-center rounded-full border-2 border-white bg-teal-600 text-[10px] font-medium text-white shadow-sm'
              >
                {index + 1}
              </span>
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

      <header className='shrink-0 px-6 pt-6 pb-4'>
        <Drawer.Title className='pr-8 text-lg font-medium'>
          {reviewing
            ? 'Review mission'
            : step === 'speeds'
              ? 'Set mission speeds'
              : 'Plan a mission'}
        </Drawer.Title>
        <Drawer.Description className='mt-1 text-xs text-muted-foreground'>
          {getVesselIdentity(vessel)}
        </Drawer.Description>
        <Drawer.Close
          ref={closeButton}
          aria-label='Close mission planner and keep draft'
          title='Close and keep draft'
          className={`absolute top-5 right-5 ${CLOSE_BUTTON_CLASS}`}
        >
          <X className='size-4' />
        </Drawer.Close>
      </header>

      <div
        ref={attachScrollArea}
        className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-[calc(1.5rem-var(--drawer-scrollbar-inset,0px))] pb-6 scrollbar-thin scrollbar-gutter-both'
      >
        <section className='border-t pt-4'>
          {step === 'type' ? (
            <>
              <p className='mb-4 text-xs leading-relaxed text-muted-foreground'>Choose a mission type to start placing it on the map.</p>
              <h3 id={typeLabelId} className='mb-3 text-sm font-medium'>
                Mission type
              </h3>
              <div aria-labelledby={typeLabelId} className='grid grid-cols-2 gap-2'>
                {missionTypes.map(({ value, label, description, Icon }) => (
                  <Button
                    key={value}
                    onClick={() => {
                      update({ type: value });
                      placementView.current = null;
                      setStep('route');
                      setEditing(value === 'waypoint' || !draft.grid.center);
                      frameVessel(Math.min(map?.getZoom() ?? ROUTE_PLANNING_ZOOM, ROUTE_PLANNING_ZOOM));
                    }}
                    className='flex min-w-0 cursor-pointer flex-col items-start rounded-lg border p-3 text-left outline-none hover:border-foreground hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring'
                  >
                    <span className='flex w-full items-center gap-2 text-xs font-medium'>
                      <Icon className='size-4' />
                      {label}
                    </span>
                    <span className='mt-1.5 text-[10px] leading-relaxed text-muted-foreground'>
                      {description}
                    </span>
                  </Button>
                ))}
              </div>
            </>
          ) : (
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-sm font-medium'>
                {draft.type === 'grid' ? 'Grid mission' : 'Waypoint mission'}
              </h3>
              {(draft.type === 'waypoint'
                ? draft.waypoints.length > 0
                : gridPlan.passCount > 0) && (
                <span className='text-xs text-muted-foreground'>
                  {draft.type === 'grid'
                    ? `${gridPlan.passCount} passes`
                    : `${draft.waypoints.length} waypoint${draft.waypoints.length === 1 ? '' : 's'}`}
                </span>
              )}
            </div>
          )}
        </section>

        {step === 'route' && (
          <section className='mt-5' aria-label='Build mission route'>
            <p className='mb-3 text-xs leading-relaxed text-muted-foreground'>
              {draft.type === 'waypoint' ? 'Click to add points. Drag a numbered point to move it, or remove it below.' : 'Place the grid on the map, then adjust its dimensions and spacing.'}
            </p>
            {draft.type === 'waypoint' ? (
              <>
                {draft.waypoints.length > 0 && (
                  <ol className='divide-y'>
                    {draft.waypoints.map((point, index) => (
                      <li
                        key={`${index}-${point.join(',')}`}
                        className='flex items-center gap-2 py-2 text-[11px] tabular-nums'
                      >
                        <span className='w-4 shrink-0 text-muted-foreground'>
                          {index + 1}
                        </span>
                        <span className='min-w-0 flex-1'>
                          {coordinateText(point)}
                        </span>
                        <button
                          type='button'
                          aria-label={`Remove waypoint ${index + 1}`}
                          className='flex size-7 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'
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
                    <h3 className='text-base font-medium'>Define grid area</h3>
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
                      0° runs passes north–south. Rotation turns the whole grid
                      clockwise.
                    </p>
                    <Button
                      className={`${secondaryButton} mt-3 bg-background`}
                      onClick={() => setEditing(true)}
                    >
                      Reposition grid
                    </Button>
                    {gridPlan.error && (
                      <p role='alert' className='mt-2 text-xs text-red-700'>
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

        {hasRoute && (
          <>
            <section
              aria-label='Route summary'
              className='mt-3 text-xs tabular-nums'
            >
              <dl className='mt-1 grid grid-cols-2 gap-3'>
                <div>
                  <dt className='text-muted-foreground'>Distance</dt>
                  <dd className='mt-1 text-sm font-medium'>
                    {distance.toFixed(2)} nm
                  </dd>
                </div>
                <div aria-live='polite' aria-atomic='true'>
                  <dt className='text-muted-foreground'>Est. travel time</dt>
                  <dd className='mt-1 text-sm font-medium'>{duration}</dd>
                </div>
                {reviewing && (
                  <>
                    <div>
                      <dt className='text-muted-foreground'>
                        Straight-line speed
                      </dt>
                      <dd className='mt-1 font-medium'>{draft.speed} kn</dd>
                    </div>
                    {hasTurns && <div>
                      <dt className='text-muted-foreground'>Turn speed</dt>
                      <dd className='mt-1 font-medium'>{draft.turnSpeed} kn</dd>
                    </div>}
                  </>
                )}
              </dl>
              <p className='mt-3 text-[10px] leading-relaxed text-muted-foreground'>Time estimate uses straight-line speed; acceleration and turns add time.</p>
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
              <section
                className='mt-5 rounded-xl bg-muted p-4'
                aria-label='Mission speeds'
              >
                <p className='mt-1 mb-4 text-xs leading-relaxed text-muted-foreground'>
                  {hasTurns ? 'Choose the speed for straight sections and turns.' : 'Choose the travel speed for this leg.'}
                  {' '}Vessel maximum: {vessel.simulation.maxSpeed} kn.
                </p>
                <div className={hasTurns ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
                  <MissionNumberField
                    label='Straight-line speed'
                    unit='kn'
                    value={draft.speed}
                    min={0.5}
                    max={vessel.simulation.maxSpeed}
                    step={0.5}
                    onValueChange={speed => update({ speed, ...(!hasTurns && speed !== null ? { turnSpeed: Math.min(draft.turnSpeed ?? 4, speed) } : {}) })}
                    errorId={speedError ? speedErrorId : undefined}
                  />
                  {hasTurns && <MissionNumberField
                    label='Turn speed'
                    unit='kn'
                    value={draft.turnSpeed}
                    min={0.5}
                    max={vessel.simulation.maxSpeed}
                    step={0.5}
                    onValueChange={turnSpeed => update({ turnSpeed })}
                    errorId={speedError ? speedErrorId : undefined}
                  />}
                </div>
                {speedError && (
                  <p
                    id={speedErrorId}
                    role='alert'
                    className='mt-2 text-xs text-red-700'
                  >
                    {speedError}
                  </p>
                )}
              </section>
            )}
            {reviewing && (
              <div className='mt-5 space-y-3'>
                <div className='flex flex-wrap gap-2'>
                  <Button className={secondaryButton} onClick={() => { setReturnToReview(true); editRoute(); }}>Edit route</Button>
                  <Button className={secondaryButton} onClick={() => { setReturnToReview(true); setStep('speeds'); }}>Edit speeds</Button>
                  <Button className={secondaryButton} onClick={() => map && fitMissionRoute(map, [vessel.simulation.getFrame().position, ...coordinates, ...(draft.type === 'grid' ? gridPlan.boundary : [])])}>Show route</Button>
                </div>
                <p className='text-xs leading-relaxed text-muted-foreground'>Check the full route on the map. Deploying starts this vessel moving immediately.</p>
              </div>
            )}
          </>
        )}
      </div>

      {(step !== 'type' || hasPlannedPoints) && <footer className='shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
        {deploymentError && <p role='alert' className='mb-2 text-xs text-destructive'>{deploymentError}</p>}
        {step !== 'type' && (
          <Button
            type='button'
            className='mb-2 flex min-h-10 w-full cursor-pointer items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'
            onClick={() => {
              setReturnToReview(false);
              if (step === 'speeds') editRoute();
              else {
                setEditing(false);
                setStep(reviewing ? 'speeds' : 'type');
              }
            }}
          >
            {reviewing ? 'Back to speeds' : step === 'speeds' ? 'Back to route' : 'Back to mission type'}
          </Button>
        )}
        {step !== 'type' && <Button
          type='button'
          disabled={
            step === 'route'
              ? !routeReady
              : !canReviewMission(draft, vessel.simulation.maxSpeed)
          }
          className='flex py-2.5 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40'
          onClick={() => {
            setEditing(false);
            if (step === 'route') {
              setStep(returnToReview ? 'review' : 'speeds');
              setReturnToReview(false);
              if (!hasTurns && draft.speed !== null && draft.speed > 0) update({ turnSpeed: Math.min(draft.turnSpeed && draft.turnSpeed > 0 ? draft.turnSpeed : 4, draft.speed) });
              if (map) {
                const center = map.getCenter();
                placementView.current = { center: [center.lng, center.lat], zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() };
                fitMissionRoute(map, [vessel.simulation.getFrame().position, ...coordinates, ...(draft.type === 'grid' ? gridPlan.boundary : [])]);
              }
            }
            else if (reviewing) {
              if (!onDeploy(draft)) setDeploymentError('Unable to deploy. Check the route and speeds, and make sure this vessel has no mission in progress.');
            } else {
              setStep('review');
              setReturnToReview(false);
              if (map) fitMissionRoute(map, [vessel.simulation.getFrame().position, ...coordinates, ...(draft.type === 'grid' ? gridPlan.boundary : [])]);
            }
          }}
        >
          {step === 'route' ? returnToReview ? 'Return to review' : 'Set mission speeds' : reviewing ? 'Deploy mission' : returnToReview ? 'Return to review' : 'Review mission'}
        </Button>}

      </footer>}
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
              finalFocus={() => discardConfirmed.current ? false : (closeButton.current ?? false)}
              className='mission-discard-dialog w-full max-w-sm rounded-lg border border-white/15 bg-neutral-900 p-6 text-neutral-100 shadow-md outline-none'
            >
              <AlertDialog.Title className='text-base font-medium'>
                Discard mission plan?
              </AlertDialog.Title>
              <AlertDialog.Description className='mt-2 text-sm leading-relaxed text-neutral-400'>
                The mission type, route, and speed settings for <span className='whitespace-nowrap font-medium text-neutral-100'>{vessel.id}</span> will be removed.
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
