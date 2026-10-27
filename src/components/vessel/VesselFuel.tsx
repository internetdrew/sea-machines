import { useId } from 'react';
import { Progress } from '@base-ui/react/progress';

export type FuelTank = {
  name: string;
  remainingLiters: number;
  capacityLiters: number;
};

const LOW_THRESHOLD = 30;
const CRITICAL_THRESHOLD = 15;

function getFuelAppearance(percent: number) {
  if (percent <= CRITICAL_THRESHOLD) {
    return { indicator: 'bg-red-600', text: 'text-red-700', label: 'Critical' };
  }
  if (percent <= LOW_THRESHOLD) {
    return { indicator: 'bg-amber-500', text: 'text-amber-700', label: 'Low' };
  }
  return { indicator: 'bg-emerald-600', text: 'text-emerald-700', label: 'Normal' };
}

export function VesselFuel({ tanks }: { tanks: readonly FuelTank[] }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className='border-t pt-3 mt-3 text-xs tabular-nums'>
      <div className='mb-2.5 flex items-baseline justify-between gap-2'>
        <h3 id={titleId} className='font-medium'>Fuel</h3>
        <span className='text-[10px] text-muted-foreground'>Remaining / capacity</span>
      </div>
      <div className='grid grid-cols-2 items-start gap-4'>
        {tanks.map(tank => {
          const percent = Math.max(0, Math.min(100,
            tank.remainingLiters / tank.capacityLiters * 100,
          ));
          const fuel = getFuelAppearance(percent);
          return (
            <Progress.Root
              key={tank.name}
              value={percent}
              aria-valuetext={`${Math.round(percent)}%, ${tank.remainingLiters} of ${tank.capacityLiters} liters remaining, ${fuel.label.toLowerCase()}`}
              className='grid min-w-0 content-start grid-cols-[1fr_auto] items-baseline gap-x-1 gap-y-1.5'
            >
              <Progress.Label className='text-muted-foreground'>{tank.name}</Progress.Label>
              <Progress.Value className={`text-right font-medium ${fuel.text}`} />
              <Progress.Track className='col-span-2 h-1.5 overflow-hidden rounded-full bg-neutral-200'>
                <Progress.Indicator className={`h-full rounded-full ${fuel.indicator}`} />
              </Progress.Track>
              <div className='col-span-2 text-[11px]'>
                {tank.remainingLiters} <span className='text-muted-foreground'>/ {tank.capacityLiters} L</span>
              </div>
            </Progress.Root>
          );
        })}
      </div>
    </section>
  );
}
