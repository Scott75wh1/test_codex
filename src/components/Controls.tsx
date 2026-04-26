import { SPEED_MULTIPLIERS } from '../simulation/constants';
import type { BurnDirection } from '../simulation/types';

type Props = {
  running: boolean;
  speed: number;
  showVectors: boolean;
  showGravityFields: boolean;
  burnDirection: BurnDirection;
  burnDeltaV: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onSpeedChange: (value: number) => void;
  onToggleVectors: () => void;
  onToggleGravity: () => void;
  onTriggerExplosion: () => void;
  onManualBurn: () => void;
  onFreeReturnBurn: () => void;
  onBurnDirectionChange: (value: BurnDirection) => void;
  onBurnDeltaVChange: (value: number) => void;
};

export function Controls(props: Props) {
  const {
    running,
    speed,
    showVectors,
    showGravityFields,
    burnDirection,
    burnDeltaV,
    onStart,
    onPause,
    onReset,
    onSpeedChange,
    onToggleVectors,
    onToggleGravity,
    onTriggerExplosion,
    onManualBurn,
    onFreeReturnBurn,
    onBurnDirectionChange,
    onBurnDeltaVChange,
  } = props;

  return (
    <header className="controls">
      <div className="controls-primary">
        <button onClick={onStart} disabled={running}>Start simulation</button>
        <button onClick={onPause} disabled={!running}>Pause</button>
        <button onClick={onReset}>Reset</button>
        <button onClick={onTriggerExplosion}>Trigger oxygen tank explosion</button>
        <button onClick={onFreeReturnBurn}>Apply free-return correction burn</button>
      </div>

      <div className="controls-secondary">
        <div className="segmented">
          {SPEED_MULTIPLIERS.map((multiplier) => (
            <button
              key={multiplier}
              className={speed === multiplier ? 'active' : ''}
              onClick={() => onSpeedChange(multiplier)}
            >
              x{multiplier}
            </button>
          ))}
        </div>

        <label><input type="checkbox" checked={showVectors} onChange={onToggleVectors} /> Show vectors</label>
        <label><input type="checkbox" checked={showGravityFields} onChange={onToggleGravity} /> Show gravity fields</label>
      </div>

      <div className="burn-controls">
        <label>
          Burn direction
          <select value={burnDirection} onChange={(e) => onBurnDirectionChange(e.target.value as BurnDirection)}>
            <option value="prograde">Prograde</option>
            <option value="retrograde">Retrograde</option>
            <option value="toEarth">Toward Earth</option>
            <option value="normalToEarth">Normal to Earth</option>
          </select>
        </label>

        <label>
          DeltaV: {burnDeltaV.toFixed(0)} m/s
          <input
            type="range"
            min={10}
            max={300}
            step={5}
            value={burnDeltaV}
            onChange={(e) => onBurnDeltaVChange(Number(e.target.value))}
          />
        </label>

        <button onClick={onManualBurn}>Trigger manual correction burn</button>
      </div>
    </header>
  );
}
