import { Map, MapControls } from '@/components/ui/map';

function App() {
  return (
    <main className='relative h-dvh w-full' aria-label='Interactive map'>
      <Map center={[-74.006, 40.7128]} zoom={15}>
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
