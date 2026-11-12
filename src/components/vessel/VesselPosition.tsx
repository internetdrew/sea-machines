import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { SmoothResize } from '@/components/SmoothResize';
import { TextSwap } from '@/components/TextSwap';
import type { VesselFrame } from '@/lib/vessel/simulation';

type CopyState = 'idle' | 'copied' | 'error';
const COPY_BUTTON_CLASS = 'min-h-8 min-w-11 cursor-pointer rounded-md border border-neutral-800 px-2 text-xs text-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

export function VesselPosition({ snapshot }: { snapshot: VesselFrame; }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle',
  );
  const resetCopy = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(resetCopy.current);
    };
  }, []);
  const copyPosition = async () => {
    clearTimeout(resetCopy.current);
    const [longitude, latitude] = snapshot.position;
    try {
      await navigator.clipboard.writeText(
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      );
      if (!mounted.current) return;
      setCopyState('copied');
      resetCopy.current = setTimeout(() => setCopyState('idle'), 2200);
    } catch {
      if (mounted.current) setCopyState('error');
    }
  };
  return <VesselPositionContent snapshot={snapshot} copyState={copyState} copyControl={
    <button type='button' onClick={copyPosition} aria-label='Copy vessel position, latitude and longitude' className={COPY_BUTTON_CLASS}>
      <SmoothResize>
        <TextSwap text={copyState === 'copied' ? 'Copied' : 'Copy'} duration={0.09} offset={2} blur={1} />
      </SmoothResize>
    </button>
  } />;
}

/** Shared markup also gives the sizing probe the exact live layout, without hooks. */
export function VesselPositionContent({ snapshot, copyState = 'idle', copyControl }: { snapshot: VesselFrame; copyState?: CopyState; copyControl?: ReactNode; }) {
  copyControl ??= <span className={`${COPY_BUTTON_CLASS} inline-flex items-center justify-center`}>Copy</span>;
  return (
    <section className='vessel-position-section relative mt-5'>
      <div className='flex items-center justify-between gap-3'>
        <h3 className='text-xs font-medium text-neutral-400'>Position</h3>
        {copyControl}

      </div>
      <span role='status' className='sr-only'>{copyState === 'copied' ? 'Vessel position copied' : copyState === 'error' ? 'Unable to copy vessel position. Select the coordinates to copy manually.' : ''}</span>
      <div className='select-text'>
        <span className='mt-2 grid grid-cols-2 gap-x-3 text-xs tabular-nums'>
          <span className='min-w-0'>
            <span className='block text-neutral-400'>Latitude</span>
            <span className='mt-1 block whitespace-nowrap font-medium text-neutral-100'>
              {Math.abs(snapshot.position[1]).toFixed(4)}°{' '}
              {snapshot.position[1] >= 0 ? 'N' : 'S'}
            </span>
          </span>
          <span className='min-w-0 text-right'>
            <span className='block text-neutral-400'>Longitude</span>
            <span className='mt-1 block whitespace-nowrap font-medium text-neutral-100'>
              {Math.abs(snapshot.position[0]).toFixed(4)}°{' '}
              {snapshot.position[0] >= 0 ? 'E' : 'W'}
            </span>
          </span>
        </span>
      </div>
      {copyState === 'error' && <p className='mt-2 text-[11px] text-amber-400'>Copy unavailable. Select the coordinates to copy manually.</p>}
    </section>
  );
}
