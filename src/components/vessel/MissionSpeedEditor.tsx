import { useId, useCallback } from 'react';
import { MissionSpeedControl } from './MissionSpeedControl';
import type { Vessel } from '@/lib/vessel/vessel';

export function MissionSpeedEditor({ vessel, straight, turn, setStraight, setTurn, error, onCancel, showTurnSpeed }: {
  showTurnSpeed: boolean;
  vessel: Vessel;
  straight: number | null;
  turn: number | null;
  setStraight: (value: number | null) => void;
  setTurn: (value: number | null) => void;
  error: string;
  onCancel: () => void;
}) {
  const errorId = useId();
  const focusFirst = useCallback((element: HTMLDivElement | null) => {
    element?.querySelector<HTMLInputElement>('input[type="range"]')?.focus({ preventScroll: true });
  }, []);
  return <div onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); } }}>
    <p className='mt-2 text-[10px] leading-relaxed text-muted-foreground'>Changes take effect when you apply them.</p>
    <div ref={focusFirst} className='mission-speed-pair'>
      <MissionSpeedControl label='Straight-line speed' value={straight} max={vessel.simulation.maxSpeed} onValueChange={setStraight} errorId={error ? errorId : undefined} />
      {showTurnSpeed && <MissionSpeedControl label='Turn speed' value={turn} max={vessel.simulation.maxSpeed} onValueChange={setTurn} errorId={error ? errorId : undefined} />}
    </div>
    <p id={errorId} role='alert' className='mt-2 text-[10px] text-amber-400'>{error}</p>

  </div>;
}
