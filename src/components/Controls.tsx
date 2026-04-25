import { SPEED_MULTIPLIERS } from '../simulation/constants';

type Props = {
  running: boolean;
  speed: number;
  showVectors: boolean;
  showGravityFields: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (value: number) => void;
  onToggleVectors: () => void;
  onToggleGravity: () => void;
  onTriggerExplosion: () => void;
  onManualBurn: () => void;
};

export function Controls({
  running,
  speed,
  showVectors,
  showGravityFields,
  onStart,
  onPause,
  onReset,
  onSpeedChange,
  onToggleVectors,
  onToggleGravity,
  onTriggerExplosion,
  onManualBurn,
}: Props) {
  return (
    <header className="controls">
      <div className="controls-primary">
        <button onClick={onStart} disabled={running}>
          Start simulation
        </button>
        <button onClick={onPause} disabled={!running}>
          Pause
        </button>
        <button onClick={onReset}>Reset</button>
        <button onClick={onTriggerExplosion}>Trigger oxygen tank explosion</button>
        <button onClick={onManualBurn}>Trigger manual correction burn</button>
      </div>

      <div className="controls-secondary">
        <div className="segmented">
          {SPEED_MULTIPLIERS.map((multiplier) => (
            <button
              key={multiplier}
              className={speed === multiplier ? 'active' : ''}
              onClick={() => onSpeedChange(multiplier)}
            >
              Speed x{multiplier}
            </button>
          ))}
        </div>

        <label>
          <input type="checkbox" checked={showVectors} onChange={onToggleVectors} /> Show vectors
        </label>
        <label>
          <input type="checkbox" checked={showGravityFields} onChange={onToggleGravity} /> Show gravity fields
        </label>
      </div>
    </header>
  );
}
