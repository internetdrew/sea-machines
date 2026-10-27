import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@base-ui/react/button';
import { Drawer } from '@base-ui/react/drawer';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
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
} from '@/lib/vessel/mission';
import type { MissionDraft, MissionType } from '@/lib/vessel/mission';
import type { Coordinate } from '@/lib/vessel/navigation';
import type { Vessel } from '@/lib/vessel/vessel';
import { getVesselActivity } from '@/lib/vessel/vessel';
import { VesselFuel } from './VesselFuel';
import { VesselTelemetry } from './VesselTelemetry';
import { MissionNumberField } from './MissionNumberField';

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
  onSave,
}: {
  vessel: Vessel;
  draft: MissionDraft;
  onDraftChange: (draft: MissionDraft) => void;
  isOpen: boolean;
  onSave: () => void;
}) {
  const { map } = useMap();
  const snapshot = useSyncExternalStore(
    vessel.simulation.subscribe,
    vessel.simulation.getSnapshot,
  );
  const status = getVesselActivity(snapshot);
  const speedErrorId = useId();
  const typeLabelId = useId();
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState<'type' | 'route' | 'speeds' | 'review'>(
    'type',
  );
  const reviewing = step === 'review';
  const placingWaypoints = step === 'route' && draft.type === 'waypoint';
  const [gridStart, setGridStart] = useState<{
    point: Coordinate;
    origin: Coordinate;
  } | null>(null);
  const gridPlan = useMemo(() => buildGridPlan(draft.grid), [draft.grid]);
  const coordinates = useMemo(() => missionCoordinates(draft), [draft]);
  const distance = useMemo(() => missionDistance(draft), [draft]);
  const speedError = missionSpeedError(draft);
  const hasRoute = coordinates.length > 1;
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
  const resetRoute = () => {
    if (draft.type === 'waypoint') update({ origin: null, waypoints: [] });
    else update({ grid: { ...draft.grid, origin: null, corners: [] } });
    setGridStart(null);
    setEditing(draft.type === 'waypoint');
  };

  const addPoint = useEffectEvent((event: MapMouseEvent) => {
    if (!(event.originalEvent.target instanceof HTMLCanvasElement)) return;
    const point: Coordinate = [event.lngLat.lng, event.lngLat.lat];
    const position = vessel.simulation.getFrame().position;
    if (draft.type === 'waypoint') {
      const next = addMissionWaypoint(draft, position, point);
      if (next !== draft) onDraftChange(next);
    } else if (!gridStart) {
      setGridStart({ point, origin: [...position] });
    } else {
      updateGrid({
        corners: [gridStart.point, point],
        origin: gridStart.origin,
      });
      setGridStart(null);
      setEditing(false);
    }
  });

  useEffect(() => {
    if (!map || !editing || !isOpen || step !== 'route') return;
    const canvas = map.getCanvas();
    const previousCursor = canvas.style.cursor;
    canvas.style.cursor = 'crosshair';
    const listener = (event: MapMouseEvent) => addPoint(event);
    map.on('click', listener);
    return () => {
      map.off('click', listener);
      canvas.style.cursor = previousCursor;
    };
  }, [map, editing, isOpen, step]);

  const boundary = useMemo(
    () => ({
      type: 'Feature' as const,
      properties: {},
      geometry: { type: 'Polygon' as const, coordinates: [gridPlan.boundary] },
    }),
    [gridPlan.boundary],
  );
  const switchType = (type: MissionType) => {
    setEditing(false);
    setGridStart(null);
    update({ type });
  };

  const editRoute = () => {
    setGridStart(null);
    setStep('route');
    setEditing(draft.type === 'waypoint' || draft.grid.corners.length === 0);
  };
  const routeReady = hasRoute && (draft.type !== 'grid' || !gridPlan.error);

  return (
    <>
      {isOpen &&
        placingWaypoints &&
        map &&
        createPortal(
          <div className='pointer-events-none absolute top-4 right-120 left-4 z-50 flex justify-center'>
            <div className='max-w-full rounded-xl border bg-background px-4 py-3 text-foreground shadow-sm'>
              <p role='status' className='text-sm font-medium'>
                {draft.waypoints.length === 0
                  ? 'Click the map to place your first waypoint.'
                  : 'Click the map to add the next waypoint.'}
              </p>
            </div>
          </div>,
          map.getContainer(),
        )}
      {isOpen && draft.type === 'grid' && gridPlan.boundary.length > 0 && (
        <MapGeoJSON
          id={`mission-area-${vessel.id}`}
          data={boundary}
          fillPaint={{ 'fill-color': '#14b8a6', 'fill-opacity': 0.1 }}
          linePaint={{ 'line-color': '#14b8a6', 'line-width': 1.5 }}
        />
      )}
      {isOpen && hasRoute && (
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
      {isOpen && editing && gridStart && (
        <MapMarker longitude={gridStart.point[0]} latitude={gridStart.point[1]}>
          <MarkerContent>
            <span
              aria-label='First grid corner'
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
          {vessel.id} · {vessel.name}
        </Drawer.Description>
        <Drawer.Close
          aria-label='Close mission planner'
          className='absolute top-5 right-5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring'
        >
          <X className='size-4' />
        </Drawer.Close>
        <div className='mt-3 flex items-center gap-2 text-[11px]'>
          <span
            className={`rounded-full px-2.5 py-0.5 font-medium ${status.colors}`}
          >
            {status.label}
          </span>
          {draft.saved && (
            <span className='text-muted-foreground'>Draft saved</span>
          )}
        </div>
      </header>

      <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6'>
        <section aria-label='Vessel telemetry' className='border-t'>
          <VesselTelemetry
            snapshot={snapshot}
            speedLabel='Speed'
            waypointLabel='Next waypoint'
          />
          <VesselFuel tanks={vessel.fuelTanks} />
        </section>

        <section className='mt-6 border-t pt-4'>
          {step === 'type' ? (
            <>
              <h3 id={typeLabelId} className='mb-3 text-sm font-medium'>
                Mission type
              </h3>
              <RadioGroup
                value={draft.type}
                onValueChange={switchType}
                aria-labelledby={typeLabelId}
                className='grid grid-cols-2 gap-2'
              >
                {missionTypes.map(({ value, label, description, Icon }) => (
                  <Radio.Root
                    key={value}
                    value={value}
                    className='flex min-w-0 cursor-pointer flex-col items-start rounded-lg border p-3 text-left outline-none data-checked:border-foreground data-checked:bg-muted/60 data-disabled:cursor-default focus-visible:ring-2 focus-visible:ring-ring'
                  >
                    <span className='flex w-full items-center gap-2 text-xs font-medium'>
                      <Icon className='size-4' />
                      {label}
                    </span>
                    <span className='mt-1.5 text-[10px] leading-relaxed text-muted-foreground'>
                      {description}
                    </span>
                  </Radio.Root>
                ))}
              </RadioGroup>
            </>
          ) : (
            <div className='flex items-center justify-between gap-3'>
              <h3 className='text-sm font-medium'>
                {draft.type === 'grid' ? 'Grid mission' : 'Waypoint mission'}
              </h3>
              {(draft.type === 'waypoint'
                ? draft.waypoints.length > 0
                : step === 'speeds' || reviewing) && (
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
                <div className='flex items-center justify-between gap-3'>
                  <h3 className='text-sm font-medium'>Grid area</h3>
                  {routeReady && (
                    <span className='text-xs text-muted-foreground'>
                      {gridPlan.passCount} passes
                    </span>
                  )}
                </div>
                <p
                  role='status'
                  className='mt-2 text-xs leading-relaxed text-muted-foreground'
                >
                  {editing && isOpen
                    ? gridStart
                      ? 'Click the opposite corner to finish the area.'
                      : 'Click the first corner of your grid area.'
                    : 'Adjust spacing and heading using the map preview.'}
                </p>
                <button
                  type='button'
                  aria-pressed={editing}
                  className={`${secondaryButton} mt-3`}
                  onClick={() => {
                    setGridStart(null);
                    setEditing(value => !value);
                  }}
                >
                  {editing
                    ? 'Cancel drawing'
                    : draft.grid.corners.length
                      ? 'Redraw grid area'
                      : 'Draw grid area'}
                </button>
                {draft.grid.corners.length > 0 && (
                  <button
                    type='button'
                    className='ml-2 min-h-9 cursor-pointer rounded-md px-2 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
                    onClick={resetRoute}
                  >
                    Reset route
                  </button>
                )}
                {draft.grid.corners.length === 2 && (
                  <div className='mt-4 grid grid-cols-2 gap-3'>
                    <MissionNumberField
                      label='Pass spacing'
                      unit='m'
                      value={draft.grid.spacing}
                      min={1}
                      step={10}
                      onValueChange={spacing => updateGrid({ spacing })}
                    />
                    <MissionNumberField
                      label='Grid heading'
                      unit='°'
                      value={draft.grid.heading}
                      min={0}
                      max={359}
                      step={5}
                      onValueChange={heading => updateGrid({ heading })}
                    />
                  </div>
                )}
                {gridPlan.error && (
                  <p role='alert' className='mt-2 text-xs text-red-700'>
                    {gridPlan.error}
                  </p>
                )}
              </>
            )}
          </section>
        )}

        {(step === 'speeds' || reviewing) && (
          <>
            <section
              aria-label='Route summary'
              className='mt-3 text-xs tabular-nums'
            >
              {draft.type === 'grid' && (
                <p className='mt-2 text-muted-foreground'>
                  {draft.grid.spacing} m spacing · {draft.grid.heading}° heading
                </p>
              )}
              <dl className='mt-1 grid grid-cols-2 gap-3'>
                <div>
                  <dt className='text-muted-foreground'>Distance</dt>
                  <dd className='mt-1 font-medium'>{distance.toFixed(2)} nm</dd>
                </div>
                <div>
                  <dt className='text-muted-foreground'>Est. travel time</dt>
                  <dd className='mt-1 font-medium'>{duration}</dd>
                </div>
                {reviewing && (
                  <>
                    <div>
                      <dt className='text-muted-foreground'>
                        Straight-line speed
                      </dt>
                      <dd className='mt-1 font-medium'>{draft.speed} kn</dd>
                    </div>
                    <div>
                      <dt className='text-muted-foreground'>Turn speed</dt>
                      <dd className='mt-1 font-medium'>{draft.turnSpeed} kn</dd>
                    </div>
                  </>
                )}
              </dl>
            </section>
            {!reviewing && (
              <section
                className='mt-5 rounded-xl bg-muted p-4'
                aria-label='Mission speeds'
              >
                <h3 className='text-base font-medium'>Set mission speeds</h3>
                <p className='mt-1 mb-4 text-xs leading-relaxed text-muted-foreground'>
                  Choose the speed for straight sections and turns.
                </p>
                <div className='grid grid-cols-2 gap-3'>
                  <MissionNumberField
                    label='Straight-line speed'
                    unit='kn'
                    value={draft.speed}
                    min={0.5}
                    step={0.5}
                    onValueChange={speed => update({ speed })}
                    errorId={speedError ? speedErrorId : undefined}
                  />
                  <MissionNumberField
                    label='Turn speed'
                    unit='kn'
                    value={draft.turnSpeed}
                    min={0.5}
                    step={0.5}
                    onValueChange={turnSpeed => update({ turnSpeed })}
                    errorId={speedError ? speedErrorId : undefined}
                  />
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
            {/* {reviewing && (
              <p className='mt-3 text-xs leading-relaxed text-muted-foreground'>
                This draft has not been sent to the vessel.
              </p>
            )} */}
          </>
        )}
      </div>

      <footer className='shrink-0 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]'>
        {step !== 'type' && (
          <Button
            type='button'
            className='mb-2 py-2.5 w-full cursor-pointer rounded-md text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
            onClick={() => {
              if (step === 'speeds') editRoute();
              else {
                setEditing(false);
                setGridStart(null);
                setStep(reviewing ? 'speeds' : 'type');
              }
            }}
          >
            {reviewing
              ? 'Back to speeds'
              : step === 'speeds'
                ? 'Back to route'
                : 'Back to mission type'}
          </Button>
        )}
        <Button
          type='button'
          disabled={
            step === 'route'
              ? !routeReady
              : step !== 'type' && !canReviewMission(draft)
          }
          className='flex py-2.5 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-40'
          onClick={() => {
            if (step === 'type') {
              editRoute();
              return;
            }
            setEditing(false);
            setGridStart(null);
            if (step === 'route') setStep('speeds');
            else if (reviewing) {
              onDraftChange({ ...draft, saved: true });
              onSave();
            } else setStep('review');
          }}
        >
          {step === 'type'
            ? draft.type === 'waypoint'
              ? 'Choose waypoints'
              : 'Define grid area'
            : step === 'route'
              ? draft.type === 'waypoint'
                ? 'Set mission speeds'
                : 'Use grid area'
              : reviewing
                ? 'Save draft'
                : 'Review mission'}
        </Button>
        {step !== 'type' && !placingWaypoints && (
          <p className='mt-2 text-center text-[10px] text-muted-foreground'>
            Drafts stay available while this session is open.
          </p>
        )}
      </footer>
    </>
  );
}
