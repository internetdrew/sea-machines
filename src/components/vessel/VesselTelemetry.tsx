import type { VesselFrame } from '@/lib/vessel/simulation';

function formatCoordinate(value: number, positive: string, negative: string) {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positive : negative}`;
}

export function VesselTelemetry({ snapshot, waypointLabel = 'Next waypoint', speedLabel = 'Speed' }: { snapshot: VesselFrame; waypointLabel?: string; speedLabel?: string }) {
  return (
    <dl className='mt-4 grid grid-cols-[auto_auto] justify-between gap-x-4 gap-y-2 text-xs tabular-nums [&>dd]:text-right'>
      <dt className='text-muted-foreground'>Heading</dt>
      <dd>
        {String(Math.round(snapshot.heading)).padStart(3, '0')}°
      </dd>
      <dt className='text-muted-foreground'>{speedLabel}</dt>
      <dd>{snapshot.speed} kn</dd>
      <dt className='text-muted-foreground'>{waypointLabel}</dt>
      <dd>{snapshot.remaining.toFixed(2)} nm</dd>
      <dt className='text-muted-foreground'>Latitude</dt>
      <dd>{formatCoordinate(snapshot.position[1], 'N', 'S')}</dd>
      <dt className='text-muted-foreground'>Longitude</dt>
      <dd>{formatCoordinate(snapshot.position[0], 'E', 'W')}</dd>
    </dl>
  );
}
