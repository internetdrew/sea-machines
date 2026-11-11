import { cloneElement, useId } from 'react';
import type { ReactElement } from 'react';
import { MarkerTooltip } from '@/components/ui/map';
import type { Coordinate } from '@/lib/vessel/navigation';

/** Shared by draft and deployed markers; mapcn owns hover/focus and map anchoring. */
export function WaypointCoordinateTooltip({ coordinate, children, disabled = false }: {
  coordinate: Coordinate;
  children: ReactElement<{ 'aria-describedby'?: string }>;
  disabled?: boolean;
}) {
  const tooltipId = useId();
  const [longitude, latitude] = coordinate;
  return <>
    {cloneElement(children, { 'aria-describedby': disabled ? undefined : tooltipId })}
    {!disabled && <MarkerTooltip anchor='bottom' offset={20} className='border border-neutral-800 [--foreground:var(--color-neutral-900)] [--background:var(--color-neutral-100)] whitespace-nowrap tabular-nums'>
      <span id={tooltipId} role='tooltip'>
        {Math.abs(latitude).toFixed(4)}° {latitude >= 0 ? 'N' : 'S'}, {Math.abs(longitude).toFixed(4)}° {longitude >= 0 ? 'E' : 'W'}
      </span>
    </MarkerTooltip>}
  </>;
}
