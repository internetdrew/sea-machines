import { useId } from 'react';
import type { CSSProperties } from 'react';

/** One primary adjustment target, with direct entry for precise whole-knot settings. */
export function MissionSpeedControl({ label, value, max, onValueChange, errorId }: {
  label: string;
  value: number | null;
  max: number;
  onValueChange: (value: number | null) => void;
  errorId?: string;
}) {
  const id = useId();
  const min = 1;
  const limit = Math.floor(max);
  const position = Math.max(min, Math.min(limit, Math.round(value ?? min)));
  const fill = limit > min ? (position - min) / (limit - min) * 100 : 0;
  return (
    <div className='mission-speed-control' data-base-ui-swipe-ignore>
      <div className='flex items-baseline justify-between gap-4'>
        <label id={`${id}-label`} htmlFor={id} className='text-xs font-medium text-[#e1e7ea]'>{label}</label>
        <div className='flex items-baseline gap-1'>
          <input
            type='number'
            aria-label={`Exact ${label.toLowerCase()} in knots`}
            aria-invalid={errorId ? true : undefined}
            aria-describedby={errorId}
            min={min} max={limit} step={1}
            value={value ?? ''}
            onChange={event => {
              const next = event.currentTarget.valueAsNumber;
              onValueChange(Number.isFinite(next) ? Math.max(min, Math.min(limit, Math.round(next))) : null);
            }}
            className='text-neutral-100 mission-speed-value w-14 rounded-sm border-b border-transparent bg-transparent px-0.5 text-right text-[22px] font-medium tabular-nums focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
          />
          <span className='text-xs text-[#a8b5bd]'>kn</span>
        </div>
      </div>
      <div className='mt-[3px] px-[7px]'>
        <input
          id={id}
          type='range'
          min={min} max={limit} step={1}
          value={position}
          aria-valuetext={`${position} knots`}
          aria-describedby={errorId}
          aria-invalid={errorId ? true : undefined}
          onChange={event => onValueChange(event.currentTarget.valueAsNumber)}
          style={{ '--speed-fill': `${fill}%` } as CSSProperties}
          className='mission-speed-slider'
        />
        <div aria-hidden='true' className='flex justify-between text-[10px] text-[#a4b3bc] tabular-nums'>
          <span>{min}</span><span>{limit}</span>
        </div>
      </div>
    </div>
  );
}
