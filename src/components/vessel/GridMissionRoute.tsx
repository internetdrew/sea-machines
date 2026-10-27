import { useMemo } from 'react';
import { ChevronUp } from 'lucide-react';
import { MapMarker, MapRoute, MarkerContent, MarkerLabel } from '@/components/ui/map';
import { distanceNm, routeDirection } from '@/lib/vessel/mission';
import type { Coordinate } from '@/lib/vessel/navigation';

export function GridMissionRoute({ id, origin, route }: {
  id: string;
  origin: Coordinate | null;
  route: Coordinate[];
}) {
  const start = route[0];
  const end = route.at(-1);
  const transit = useMemo(() => origin && start && distanceNm(origin, start) > 0.001 ? [origin, start] : [], [origin, start]);
  const directions = useMemo(() => {
    const passCount = route.length / 2;
    if (!passCount) return [];
    // Sample at most three passes; dense grids should not become a field of arrows.
    const passes = [...new Set([0, Math.floor(passCount / 2), passCount - 1])];
    return [
      ...(transit.length ? [{ key: 'transit', ...routeDirection(transit[0], transit[1]) }] : []),
      ...passes.map(pass => ({ key: `pass-${pass}`, ...routeDirection(route[pass * 2], route[pass * 2 + 1]) })),
    ];
  }, [route, transit]);
  if (!start || !end) return null;

  return <>
    {transit.length > 0 && <MapRoute id={`${id}-transit`} coordinates={transit} color='#5ea8a3' width={1.5} opacity={0.65} dashArray={[3, 3]} interactive={false} />}
    <MapRoute id={`${id}-survey`} coordinates={route} color='#14b8a6' width={2} opacity={1} interactive={false} />
    {directions.map(({ key, coordinate, heading }) => (
      <MapMarker key={key} longitude={coordinate[0]} latitude={coordinate[1]} rotation={heading} rotationAlignment='map' pitchAlignment='map'>
        <MarkerContent className='pointer-events-none'>
          <ChevronUp aria-hidden='true' className='size-3.5 text-white/90 drop-shadow-sm' strokeWidth={2.5} />
        </MarkerContent>
      </MapMarker>
    ))}
    <MapMarker longitude={start[0]} latitude={start[1]}>
      <MarkerContent className='pointer-events-none'>
        <span aria-label='Survey start' className='block size-3 rounded-full border-2 border-white bg-teal-600' />
        <MarkerLabel className='rounded-md border border-teal-500/60 bg-teal-700 px-1.5 py-0.5 text-white shadow-sm'>Start</MarkerLabel>
      </MarkerContent>
    </MapMarker>
    <MapMarker longitude={end[0]} latitude={end[1]}>
      <MarkerContent className='pointer-events-none'>
        <span aria-label='Survey end' className='block size-2.5 rounded-full border-2 border-white bg-slate-500' />
        <MarkerLabel position='bottom' className='rounded-md border border-white/20 bg-slate-800/90 px-1.5 py-0.5 text-slate-200 shadow-sm'>End</MarkerLabel>
      </MarkerContent>
    </MapMarker>
  </>;
}
