import { Map, MapControls } from '@/components/ui/map';
import { useCallback, useMemo, useState } from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { MissionDrawer } from '@/components/vessel/MissionDrawer';
import type { MissionDrawerPayload } from '@/components/vessel/MissionDrawer';
import { DEMO_VESSEL } from '@/lib/vessel/vessel';
import { MapSettings } from '@/components/MapSettings';
import { SeamarkLayer } from '@/components/vessel/SeamarkLayer';
import { VesselLayer } from '@/components/vessel/VesselLayer';
import { useVesselSimulation } from '@/lib/vessel/use-vessel-simulation';
import { INITIAL_CENTER } from '@/lib/vessel/navigation';

function App() {
  const { simulation } = useVesselSimulation(DEMO_VESSEL.propulsion);
  const vessels = useMemo(() => [{ ...DEMO_VESSEL, simulation }], [simulation]);
  const [missionDrawer] = useState(() =>
    Drawer.createHandle<MissionDrawerPayload>(),
  );
  const [showRangeRings, setShowRangeRings] = useState(true);
  const [showSeamarks, setShowSeamarks] = useState(true);
  const [follow, setFollow] = useState(
    () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const stopFollowing = useCallback(() => setFollow(false), []);
  return (
    <main className='relative h-dvh w-full [--map-edge-inset:1rem]' aria-label='Interactive map'>
      <Map center={INITIAL_CENTER} zoom={12.5} theme='dark'>
        {showSeamarks && <SeamarkLayer />}
        {vessels.map((vessel, index) => <VesselLayer
          key={vessel.id}
          vessel={vessel}
          missionDrawer={missionDrawer}
          follow={index === 0 && follow}
          showRangeRings={showRangeRings}
          onPan={stopFollowing}
        />)}
        <div className='map-toolbar absolute top-(--map-edge-inset) right-4 z-10 flex flex-col items-end gap-1.5'>
          <MapControls className='static' showZoom showCompass showFullscreen />
          <MapSettings
            showSeamarks={showSeamarks}
            onSeamarksChange={setShowSeamarks}
            showRangeRings={showRangeRings}
            onRangeRingsChange={setShowRangeRings}
          />
        </div>
        <MissionDrawer handle={missionDrawer} vessels={vessels} onDeploy={stopFollowing} />
      </Map>
    </main>
  );
}

export default App;
