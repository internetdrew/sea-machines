import {
  Map,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerTooltip,
} from '@/components/ui/map';
import boat from '@/assets/boat.svg';

const boatPosition = { longitude: -73.25, latitude: 39.95 };
// Heading in degrees clockwise from north: 0=N, 90=E, 180=S, 270=W.
const boatHeading = 135;

function App() {
  return (
    <main className='relative h-dvh w-full' aria-label='Interactive map'>
      <Map center={[boatPosition.longitude, boatPosition.latitude]} zoom={14}>
        <MapMarker
          {...boatPosition}
          rotation={boatHeading}
          rotationAlignment='map'
          pitchAlignment='map'
        >
          <MarkerContent>
            <img
              src={boat}
              alt='Sea Machine boat'
              className='h-24 w-auto drop-shadow-lg'
              draggable={false}
            />
          </MarkerContent>
          <MarkerTooltip>Sea Machine</MarkerTooltip>
        </MapMarker>
        <MapControls position='top-right' showZoom showCompass showFullscreen />
      </Map>
      <div className='pointer-events-none absolute top-4 left-4 rounded-lg border bg-background/95 px-4 py-3 shadow-sm'>
        <h1 className='text-sm font-medium'>Sea Machine</h1>
        <p className='mt-0.5 text-xs text-muted-foreground'>Explore the map</p>
      </div>
    </main>
  );
}

export default App;
