import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
} from '@/components/ui/map';
import { useCallback, useState } from 'react';
import { VesselLayer } from '@/components/vessel/vessel-layer';
import { useVesselSimulation } from '@/lib/vessel/use-vessel-simulation';
import {
  INITIAL_CENTER,
  INITIAL_HEADING,
  ROUTE_DISTANCE_NM,
  WAYPOINT,
} from '@/lib/vessel/navigation';

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

function App() {
  const { simulation, snapshot } = useVesselSimulation();
  const { remaining, heading, arrived, playing, speed, multiplier, position } =
    snapshot;
  const [showRangeRings, setShowRangeRings] = useState(true);
  const [follow, setFollow] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const stopFollowing = useCallback(() => setFollow(false), []);
  const [waypointLongitude, waypointLatitude] = WAYPOINT;
  return (
    <main className='relative h-dvh w-full' aria-label='Interactive map'>
      <Map center={INITIAL_CENTER} zoom={12.5}>
        <VesselLayer
          simulation={simulation}
          follow={follow}
          showRangeRings={showRangeRings}
          onPan={stopFollowing}
        />
        <MapMarker
          longitude={waypointLongitude}
          latitude={waypointLatitude}
          subpixelPositioning
        >
          <MarkerContent>
            <div className='relative flex size-5 items-center justify-center'>
              <span className='size-3 rotate-45 border-2 border-[#579b9c] bg-background' />
              <span className='absolute top-7 whitespace-nowrap rounded border bg-background/90 px-2 py-1 font-mono text-[10px] text-foreground'>
                WP 01 · DEMO
              </span>
            </div>
          </MarkerContent>
          <MarkerTooltip>
            Demo waypoint · {ROUTE_DISTANCE_NM} nm · bearing {INITIAL_HEADING}°
          </MarkerTooltip>
        </MapMarker>
        <MapControls position='top-right' showZoom showCompass showFullscreen />
      </Map>
      <div className='absolute top-4 left-4 rounded-lg border bg-background/95 px-4 py-3 shadow-sm'>
        <div className='flex items-center justify-between gap-8'>
          <h1 className='text-sm font-medium'>Sea Machine</h1>
          <span className='font-mono text-xs tabular-nums text-muted-foreground'>
            HDG {String(Math.round(heading)).padStart(3, '0')}°
          </span>
        </div>
        <p className='mt-2 text-xs text-muted-foreground' role='status'>
          Simulation ·{' '}
          {arrived ? 'Waypoint reached' : playing ? 'Underway' : 'Paused'}
        </p>
        <div className='mt-3 flex gap-2'>
          <button
            type='button'
            disabled={arrived}
            onClick={() => simulation.setPlaying(!playing)}
            className='min-h-11 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground disabled:opacity-40'
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type='button'
            onClick={simulation.reset}
            className='min-h-11 rounded-md border px-3 text-xs hover:bg-muted'
          >
            Reset
          </button>
          <button
            type='button'
            aria-pressed={follow}
            onClick={() => setFollow(value => !value)}
            className='min-h-11 rounded-md border px-3 text-xs hover:bg-muted'
          >
            Follow {follow ? 'on' : 'off'}
          </button>
        </div>
        <label className='mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-xs'>
          <input
            type='checkbox'
            checked={showRangeRings}
            onChange={event => setShowRangeRings(event.target.checked)}
            className='size-4 accent-primary'
          />
          Range rings
        </label>
        <div className='mt-3 grid grid-cols-2 gap-3 text-xs'>
          <label className='grid gap-1 text-muted-foreground'>
            Vessel speed
            <select
              value={speed}
              onChange={event =>
                simulation.setSpeed(Number(event.target.value))
              }
              className='min-h-11 rounded-md border bg-background px-2 text-foreground'
            >
              {[6, 12, 18, 24].map(value => (
                <option key={value} value={value}>
                  {value} kn
                </option>
              ))}
            </select>
          </label>
          <label className='grid gap-1 text-muted-foreground'>
            Simulation rate
            <select
              value={multiplier}
              onChange={event =>
                simulation.setMultiplier(Number(event.target.value))
              }
              className='min-h-11 rounded-md border bg-background px-2 text-foreground'
            >
              {[1, 10, 30, 60].map(value => (
                <option key={value} value={value}>
                  {value}× time
                </option>
              ))}
            </select>
          </label>
        </div>
        <dl className='mt-3 grid grid-cols-[auto_auto] gap-x-6 gap-y-1 font-mono text-xs tabular-nums'>
          <dt className='text-muted-foreground'>LAT</dt>
          <dd className='text-right'>
            {formatCoordinate(position[1], 'N', 'S')}
          </dd>
          <dt className='text-muted-foreground'>LON</dt>
          <dd className='text-right'>
            {formatCoordinate(position[0], 'E', 'W')}
          </dd>
        </dl>
        <div className='mt-3 flex items-center gap-2 border-t pt-2 text-[11px] text-muted-foreground'>
          <span
            aria-hidden='true'
            className='w-5 border-t border-dashed border-[#579b9c]'
          />
          Waypoint · {remaining.toFixed(2)} nm remaining
        </div>
        <div className='mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground'>
          <span
            aria-hidden='true'
            className='w-5 border-t-2 border-[#78999e]'
          />
          Simulated voyage track
        </div>
      </div>
    </main>
  );
}

export default App;
