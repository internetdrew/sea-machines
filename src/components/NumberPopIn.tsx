import { useState } from 'react';
import './NumberPopIn.css';

/** Transitions.dev Number pop-in, driven by a formatted value rather than a demo button. */
export function NumberPopIn({ value }: { value: string }) {
  const [change, setChange] = useState({ current: value, previous: value });
  if (change.current !== value) {
    setChange({ current: value, previous: change.current });
  }
  const from = change.current === value ? change.previous : change.current;
  let same = 0;
  while (same < from.length && same < value.length && from[same] === value[same]) same++;

  return <span>
    <span className='sr-only'>{value}</span>
    <span key={value} aria-hidden='true' className={`t-digit-group${from !== value ? ' is-animating' : ''}`}>
      {value.split('').map((ch, i) => {
        if (i < same || !/\d/.test(ch)) {
          return <span key={i} className='t-digit' data-same=''>{ch}</span>;
        }
        const fromEnd = value.length - 1 - i;
        const old = from[from.length - 1 - fromEnd];
        return <span key={i} className='t-digit-slot' data-stagger={fromEnd === 1 ? '1' : fromEnd === 0 ? '2' : undefined}>
          {old && /\d/.test(old) && <span className='t-digit-old'>{old}</span>}
          <span className='t-digit'>{ch}</span>
        </span>;
      })}
    </span>
  </span>;
}
