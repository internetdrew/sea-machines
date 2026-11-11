import type { ReactNode } from 'react';

/** Decorative, controlled icon swap. The owning control supplies state and its accessible label. */
export function IconSwap({
  iconA,
  iconB,
  swapped,
  className = '',
}: {
  iconA: ReactNode;
  iconB: ReactNode;
  swapped: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden='true'
      className={`icon-swap ${className}`}
      data-swapped={swapped}
    >
      <span className='icon-swap-glyph' data-icon='a'>
        {iconA}
      </span>
      <span className='icon-swap-glyph' data-icon='b'>
        {iconB}
      </span>
    </span>
  );
}
