import { useEffect, useMemo, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { MissionPanel } from './components/MissionPanel';
import { SimulationCanvas } from './components/SimulationCanvas';
import { Timeline } from './components/Timeline';
import { applyBurn, computePlannedPath, createInitialState, stepSimulation, triggerFreeReturnCorrection, triggerOxygenExplosion } from './simulation/physics';
import type { BurnDirection, SimulationState } from './simulation/types';

const TICK_MS = 16;

export default function App() {
  const [state, setState] = useState<SimulationState>(() => createInitialState());
  const [running, setRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [burnDirection, setBurnDirection] = useState<BurnDirection>('prograde');
  const [burnDeltaV, setBurnDeltaV] = useState(65);
  const explosionAlertShown = useRef(false);

  useEffect(() => {
    if (!running) return undefined;

    const id = window.setInterval(() => {
      setState((prev) => {
        let next = prev;
        for (let i = 0; i < speedMultiplier; i += 1) {
          next = stepSimulation(next);
        }
        return next;
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, [running, speedMultiplier]);

  useEffect(() => {
    if (state.mission.explosionTriggered && !explosionAlertShown.current) {
      explosionAlertShown.current = true;
      window.alert("Houston, we've had a problem");
    }
  }, [state.mission.explosionTriggered]);

  const plannedPath = useMemo(() => computePlannedPath(state), [state.capsule.position, state.capsule.velocity]);
  const composedState = useMemo(() => ({ ...state, plannedPath }), [state, plannedPath]);

  return (
    <div className="app-shell">
      <h1>Apollo 13 Launch &amp; Lunar Flyby Simulator — v2</h1>
      <p className="subtitle">
        Educational model in SI units with normalized rendering. Apollo 13 launched on April 11, 1970.
      </p>

      <Controls
        running={running}
        speed={speedMultiplier}
        showVectors={state.showVectors}
        showGravityFields={state.showGravityFields}
        burnDirection={burnDirection}
        burnDeltaV={burnDeltaV}
        onStart={() => setRunning(true)}
        onPause={() => setRunning(false)}
        onReset={() => {
          explosionAlertShown.current = false;
          setRunning(false);
          setState(createInitialState());
          setSpeedMultiplier(1);
          setBurnDirection('prograde');
          setBurnDeltaV(65);
        }}
        onSpeedChange={setSpeedMultiplier}
        onToggleVectors={() => setState((prev) => ({ ...prev, showVectors: !prev.showVectors }))}
        onToggleGravity={() => setState((prev) => ({ ...prev, showGravityFields: !prev.showGravityFields }))}
        onTriggerExplosion={() => setState((prev) => triggerOxygenExplosion(prev))}
        onFreeReturnBurn={() => setState((prev) => triggerFreeReturnCorrection(prev))}
        onManualBurn={() => setState((prev) => applyBurn(prev, burnDirection, burnDeltaV))}
        onBurnDirectionChange={setBurnDirection}
        onBurnDeltaVChange={setBurnDeltaV}
      />

      <main className="dashboard-grid">
        <section className="canvas-wrap">
          <SimulationCanvas state={composedState} />
        </section>
        <MissionPanel state={composedState} />
      </main>

      <Timeline state={composedState} />
    </div>
  );
}
