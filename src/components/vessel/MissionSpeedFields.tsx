import { MissionSpeedControl } from './MissionSpeedControl';

export function MissionSpeedFields({ straight, turn, max, onStraightChange, onTurnChange, errorId, mobile = false }: {
  straight: number | null;
  turn: number | null;
  max: number;
  onStraightChange: (value: number | null) => void;
  onTurnChange: (value: number | null) => void;
  errorId?: string;
  mobile?: boolean;
}) {
  return (
    <div className='mission-speed-fields'>
      <div className='mission-speed-pair'>
        <MissionSpeedControl label='Straight-line speed' displayLabel={mobile ? 'Cruise' : undefined} value={straight} max={max} onValueChange={onStraightChange} errorId={errorId} />
        <MissionSpeedControl label='Turn speed' displayLabel={mobile ? 'Turn' : undefined} value={turn} max={max} onValueChange={onTurnChange} errorId={errorId} />
      </div>
    </div>
  );
}
