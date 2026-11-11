import { WaypointCoordinateTooltip } from './WaypointCoordinateTooltip';
import { memo } from 'react';
import { MapGeoJSON, MapMarker, MarkerContent } from '@/components/ui/map';
import type { VesselFrame } from '@/lib/vessel/simulation';
import { isMissionInProgress } from '@/lib/vessel/vessel';
import { GridMissionRoute } from './GridMissionRoute';

export const ActiveMissionLayer = memo(function ActiveMissionLayer({ vesselId, frame }: { vesselId: string; frame: VesselFrame }) {
  const mission = frame.mission;
  if (!mission || !isMissionInProgress(frame)) return null;
  const id = `deployed-mission-${vesselId}`;
  const departureMarker = <MapMarker longitude={mission.origin[0]} latitude={mission.origin[1]} subpixelPositioning>
    <MarkerContent className='pointer-events-none size-2.5'>
      <span aria-label='Mission origin' className='block size-2.5 rounded-full border border-slate-400 bg-transparent' />
      <span className='absolute left-full top-1/2 ml-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-normal leading-none text-slate-400 [text-shadow:0_1px_2px_#11191f]'>
        Mission origin
      </span>
    </MarkerContent>
  </MapMarker>;
  if (mission.type === 'grid') return <>
    {departureMarker}
    <MapGeoJSON id={`${id}-area`} data={{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [mission.boundary] } }}
      fillPaint={{ 'fill-color': '#14b8a6', 'fill-opacity': 0.04 }}
      linePaint={{ 'line-color': '#5ea8a3', 'line-width': 1, 'line-opacity': 0.5, 'line-dasharray': [4, 4] }} />
    <GridMissionRoute id={id} origin={mission.origin} route={mission.targets} showLines={false} progress={{ targetIndex: frame.targetIndex, remaining: frame.remaining }} />
  </>;
  return <>
    {departureMarker}
    {mission.targets.map((point, index) => <MapMarker key={index} longitude={point[0]} latitude={point[1]}>
      <MarkerContent><WaypointCoordinateTooltip coordinate={point}><span tabIndex={0} aria-label={`${index < frame.targetIndex ? 'Completed' : 'Deployed'} waypoint ${index + 1}`} className={`flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-medium shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-100 ${index < frame.targetIndex ? 'border-neutral-400 bg-neutral-700 text-neutral-300' : 'border-white bg-teal-600 text-white'}`}>{index + 1}</span></WaypointCoordinateTooltip></MarkerContent>
    </MapMarker>)}
  </>;
});
