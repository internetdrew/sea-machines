import { memo } from 'react';
import { MapGeoJSON, MapMarker, MarkerContent } from '@/components/ui/map';
import type { VesselFrame } from '@/lib/vessel/simulation';
import { isMissionInProgress } from '@/lib/vessel/vessel';
import { GridMissionRoute } from './GridMissionRoute';

export const ActiveMissionLayer = memo(function ActiveMissionLayer({ vesselId, frame }: { vesselId: string; frame: VesselFrame }) {
  const mission = frame.mission;
  if (!mission || !isMissionInProgress(frame)) return null;
  const id = `deployed-mission-${vesselId}`;
  if (mission.type === 'grid') return <>
    <MapGeoJSON id={`${id}-area`} data={{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [mission.boundary] } }}
      fillPaint={{ 'fill-color': '#14b8a6', 'fill-opacity': 0.04 }}
      linePaint={{ 'line-color': '#5ea8a3', 'line-width': 1, 'line-opacity': 0.5, 'line-dasharray': [4, 4] }} />
    <GridMissionRoute id={id} origin={mission.origin} route={mission.targets} showLines={false} progress={{ targetIndex: frame.targetIndex, remaining: frame.remaining }} />
  </>;
  return <>
    {mission.targets.map((point, index) => <MapMarker key={index} longitude={point[0]} latitude={point[1]}>
      <MarkerContent><span aria-label={`${index < frame.targetIndex ? 'Completed' : 'Deployed'} waypoint ${index + 1}`} className={`flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-medium shadow-sm ${index < frame.targetIndex ? 'border-slate-400 bg-slate-700 text-slate-300' : 'border-white bg-teal-600 text-white'}`}>{index + 1}</span></MarkerContent>
    </MapMarker>)}
  </>;
});
