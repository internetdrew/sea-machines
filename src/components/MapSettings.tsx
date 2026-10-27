import { useId } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Switch } from '@base-ui/react/switch';
import { Settings, X } from 'lucide-react';
import { useMap } from '@/components/ui/map';

type Props = {
  showSeamarks: boolean;
  onSeamarksChange: (checked: boolean) => void;
  showRangeRings: boolean;
  onRangeRingsChange: (checked: boolean) => void;
};

function SettingSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className='relative flex min-h-11 w-full cursor-pointer items-center justify-between gap-6 text-[13px]'
    >
      {label}
      <Switch.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className='ml-auto inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-input p-0.5 outline-none data-checked:bg-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      >
        <Switch.Thumb className='size-4 rounded-full bg-background shadow-sm transition-transform duration-150 ease-out data-checked:translate-x-4 motion-reduce:transition-none' />
      </Switch.Root>
    </label>
  );
}

export function MapSettings({
  showSeamarks,
  onSeamarksChange,
  showRangeRings,
  onRangeRingsChange,
}: Props) {
  const { map } = useMap();

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label='Map settings'
        className='flex size-8 cursor-pointer items-center justify-center rounded-md border bg-background text-foreground shadow-sm hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring'
      >
        <Settings className='size-4' />
      </Popover.Trigger>
      <Popover.Portal container={map?.getContainer()}>
        <Popover.Positioner
          side='bottom'
          align='end'
          sideOffset={8}
          collisionPadding={12}
          className='z-50'
        >
          <Popover.Popup className='relative w-72 max-w-[calc(100vw-24px)] origin-(--transform-origin) rounded-lg border bg-popover p-4 text-popover-foreground shadow-md outline-none transition-[scale,opacity] duration-100 ease-out data-starting-style:scale-[0.98] data-starting-style:opacity-0 data-ending-style:scale-[0.98] data-ending-style:opacity-0 motion-reduce:transition-none'>
            <Popover.Title className='pr-6 text-sm font-medium'>
              Map settings
            </Popover.Title>
            <Popover.Close
              aria-label='Close map settings'
              className='absolute top-3 right-3 inline-flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring transition-colors duration-150 motion-reduce:transition-none'
            >
              <X className='size-3.5' />
            </Popover.Close>
            <div className='mt-2'>
              <SettingSwitch
                label='Seamarks'
                checked={showSeamarks}
                onCheckedChange={onSeamarksChange}
              />
              <SettingSwitch
                label='Range rings'
                checked={showRangeRings}
                onCheckedChange={onRangeRingsChange}
              />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
