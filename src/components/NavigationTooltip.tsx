import type { ReactElement } from 'react';
import { Tooltip } from '@base-ui/react/tooltip';

export const NavigationTooltipProvider = Tooltip.Provider;

export function NavigationTooltip({
  label,
  children,
  container,
}: {
  label: string;
  children: ReactElement;
  container?: HTMLElement;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal container={container}>
        <Tooltip.Positioner
          side='left'
          sideOffset={10}
          collisionPadding={8}
          className='z-60'
        >
          <Tooltip.Popup className='rounded-md border border-white/15 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-100 shadow-md'>
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
