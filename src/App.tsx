import { NavigationTooltipProvider } from '@/components/ui/navigation-tooltip';
import type { Map as MapInstance } from 'maplibre-gl';
import { Map, MapControls } from '@/components/ui/map';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { MissionDrawer } from '@/components/vessel/MissionDrawer';
import type { MissionDrawerPayload } from '@/components/vessel/MissionDrawer';
import { FLEET_DEFINITIONS } from '@/lib/vessel/fleet-definitions';
import { MapSettings } from '@/components/MapSettings';
import { SeamarkLayer } from '@/components/vessel/SeamarkLayer';
import { FleetLabels } from '@/components/vessel/FleetLabels';
import { VesselLayer } from '@/components/vessel/VesselLayer';
import { useFleet } from '@/lib/vessel/use-fleet';
import { getFleetBounds } from '@/lib/vessel/fleet-bounds';
import { INITIAL_CENTER } from '@/lib/vessel/navigation';

function App() {
  const mapRef = useRef<MapInstance | null>(null);
  const vessels = useFleet(FLEET_DEFINITIONS);
  const initialFleetBounds = useMemo(
    () => getFleetBounds(vessels.map(vessel => vessel.simulation.getFrame().position)),
    [vessels],
  );
  const [missionDrawer] = useState(() =>
    Drawer.createHandle<MissionDrawerPayload>(),
  );
  const [showRangeRings, setShowRangeRings] = useState(true);
  const [showSeamarks, setShowSeamarks] = useState(true);
  const [follow, setFollow] = useState(false);
  const stopFollowing = useCallback(() => setFollow(false), []);
  const fitFleet = useCallback(() => {
    const bounds = getFleetBounds(vessels.map(vessel => vessel.simulation.getFrame().position));
    if (!bounds || !mapRef.current) return;
    stopFollowing();
    mapRef.current.fitBounds(bounds, {
      padding: 80,
      maxZoom: 12.5,
      bearing: 0,
      pitch: 0,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 300,
    });
  }, [vessels, stopFollowing]);
  return (
    <main className='relative h-dvh w-full [--map-edge-inset:1rem]' aria-label='Interactive map'>
      <Map
        ref={mapRef}
        center={INITIAL_CENTER}
        zoom={12.5}
        bounds={initialFleetBounds}
        fitBoundsOptions={{ padding: 80, maxZoom: 12.5 }}
        theme='dark'
      >
        {showSeamarks && <SeamarkLayer />}
        {vessels.map((vessel, index) => <VesselLayer
          key={vessel.id}
          vessel={vessel}
          missionDrawer={missionDrawer}
          follow={index === 0 && follow}
          showRangeRings={showRangeRings}
          onPan={stopFollowing}
        />)}
        <FleetLabels vessels={vessels} />
        <NavigationTooltipProvider delay={350}>
        <div className='map-toolbar text-neutral-100 [--background:#262626] [--foreground:#f5f5f5] [--accent:#333333] [--border:#ffffff1f] [--ring:#d4d4d4] absolute top-(--map-edge-inset) right-4 z-10 flex flex-col items-end gap-1.5'>
          <MapControls className='static' showZoom showCompass showFullscreen onFitFleet={fitFleet} />
          <MapSettings
            showSeamarks={showSeamarks}
            onSeamarksChange={setShowSeamarks}
            showRangeRings={showRangeRings}
            onRangeRingsChange={setShowRangeRings}
          />
        </div>
        </NavigationTooltipProvider>
        <MissionDrawer handle={missionDrawer} vessels={vessels} onDeploy={stopFollowing} />
      </Map>
    </main>
  );
}

export default App;
