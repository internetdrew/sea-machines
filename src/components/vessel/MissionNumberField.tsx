import { useId } from 'react';
import { NumberField } from '@base-ui/react/number-field';
import { Minus, Plus } from 'lucide-react';

export function MissionNumberField({ label, unit, value, onValueChange, min, max, step = 1, readOnly = false, errorId }: {
  label: string;
  unit: string;
  value: number | null;
  onValueChange: (value: number | null) => void;
  min: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  errorId?: string;
}) {
  const id = useId();
  const stepper = 'flex w-8 shrink-0 cursor-pointer items-center justify-center rounded-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default disabled:opacity-30';
  return (
    <div className='min-w-0'>
      <label htmlFor={id} className='mb-1.5 block text-[11px] text-muted-foreground'>{label}</label>
      {readOnly ? <div className='text-sm font-medium tabular-nums'>{value ?? '—'} {unit}</div> : (
        <NumberField.Root id={id} value={value} onValueChange={onValueChange} min={min} max={max} step={step}>
          <NumberField.Group className='flex min-h-10 rounded-md border bg-background p-0.5 focus-within:ring-1 focus-within:ring-ring' data-base-ui-swipe-ignore>
            <NumberField.Decrement aria-label={`Decrease ${label.toLowerCase()}`} className={stepper}><Minus className='size-3' /></NumberField.Decrement>
            <NumberField.Input aria-invalid={errorId ? true : undefined} aria-describedby={errorId} className='min-w-0 w-full bg-transparent text-center text-xs tabular-nums outline-none' />
            <span aria-hidden='true' className='self-center pr-1 text-[10px] text-muted-foreground'>{unit}</span>
            <NumberField.Increment aria-label={`Increase ${label.toLowerCase()}`} className={stepper}><Plus className='size-3' /></NumberField.Increment>
          </NumberField.Group>
        </NumberField.Root>
      )}
    </div>
  );
}
