import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
} from '@/components/ui/map';
import { useCallback, useState } from 'react';
import { MapSettings } from '@/components/MapSettings';
import { SeamarkLayer } from '@/components/vessel/SeamarkLayer';
import { VesselLayer } from '@/components/vessel/VesselLayer';
import { useVesselSimulation } from '@/lib/vessel/use-vessel-simulation';
import {
  INITIAL_CENTER,
  INITIAL_HEADING,
  ROUTE_DISTANCE_NM,
  WAYPOINT,
} from '@/lib/vessel/navigation';

function App() {
  const { simulation, snapshot } = useVesselSimulation();
  const { heading, arrived, playing, speed, multiplier } = snapshot;
  const [showRangeRings, setShowRangeRings] = useState(true);
  const [showSeamarks, setShowSeamarks] = useState(true);
  const [follow, setFollow] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const stopFollowing = useCallback(() => setFollow(false), []);
  const [waypointLongitude, waypointLatitude] = WAYPOINT;
  return (
    <main className='relative h-dvh w-full' aria-label='Interactive map'>
      <Map center={INITIAL_CENTER} zoom={12.5} theme='dark'>
        {showSeamarks && <SeamarkLayer />}
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
        <div className='absolute top-2 right-2 z-10 flex flex-col items-end gap-1.5'>
          <MapControls className='static' showZoom showCompass showFullscreen />
          <MapSettings
            showSeamarks={showSeamarks}
            onSeamarksChange={setShowSeamarks}
            showRangeRings={showRangeRings}
            onRangeRingsChange={setShowRangeRings}
          />
        </div>
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
      </div>
    </main>
  );
}

export default App;
