import { useEffect, useMemo, useState } from 'react';
import { Controls } from './components/Controls';
import { MissionPanel } from './components/MissionPanel';
import { SimulationCanvas } from './components/SimulationCanvas';
import { Timeline } from './components/Timeline';
import { applyBurn, computePlannedPath, createInitialState, stepSimulation, triggerOxygenExplosion } from './simulation/physics';
import type { SimulationState } from './simulation/types';

const TICK_MS = 16;

export default function App() {
  const [state, setState] = useState<SimulationState>(() => createInitialState());
  const [running, setRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

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

  const plannedPath = useMemo(() => computePlannedPath(state), [state.capsule.position, state.capsule.velocity]);

  const composedState = useMemo(
    () => ({
      ...state,
      plannedPath,
    }),
    [state, plannedPath],
  );

  const handleExplosion = () => {
    setState((prev) => {
      const next = triggerOxygenExplosion(prev);
      if (!prev.mission.explosionTriggered && next.mission.explosionTriggered) {
        window.alert("Houston, we've had a problem");
      }
      return next;
    });
  };

  const handleManualBurn = () => {
    setState((prev) => applyBurn(prev, 'prograde', 65));
  };

  return (
    <div className="app-shell">
      <h1>Apollo 13 Launch &amp; Lunar Flyby Simulator</h1>
      <p className="subtitle">
        Educational and simplified orbital model inspired by the Apollo 13 mission (launched on April 11, 1970).
      </p>

      <Controls
        running={running}
        speed={speedMultiplier}
        showVectors={state.showVectors}
        showGravityFields={state.showGravityFields}
        onStart={() => setRunning(true)}
        onPause={() => setRunning(false)}
        onReset={() => {
          setRunning(false);
          setState(createInitialState());
          setSpeedMultiplier(1);
        }}
        onSpeedChange={setSpeedMultiplier}
        onToggleVectors={() =>
          setState((prev) => ({
            ...prev,
            showVectors: !prev.showVectors,
          }))
        }
        onToggleGravity={() =>
          setState((prev) => ({
            ...prev,
            showGravityFields: !prev.showGravityFields,
          }))
        }
        onTriggerExplosion={handleExplosion}
        onManualBurn={handleManualBurn}
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
