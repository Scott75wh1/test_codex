import { useEffect, useMemo, useRef, useState } from 'react';
import { Controls } from './components/Controls';
import { MissionPanel } from './components/MissionPanel';
import { SimulationCanvas } from './components/SimulationCanvas';
import { Timeline } from './components/Timeline';
import { applyBurn, computePlannedPath, createInitialState, getScenarios, stepSimulation, triggerFreeReturnCorrection, triggerOxygenExplosion } from './simulation/physics';
import type { BurnDirection, ScenarioId, SimulationState } from './simulation/types';

const TICK_MS = 16;

export default function App() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('nominal');
  const [state, setState] = useState<SimulationState>(() => createInitialState('nominal'));
  const [running, setRunning] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [burnDirection, setBurnDirection] = useState<BurnDirection>('prograde');
  const [burnDeltaV, setBurnDeltaV] = useState(65);
  const explosionAlertShown = useRef(false);
  const scenarios = useMemo(() => getScenarios(), []);

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

  const selectedScenario = scenarios.find((scenario) => scenario.id === scenarioId);

  const resetScenario = (nextScenario: ScenarioId = scenarioId) => {
    explosionAlertShown.current = false;
    setRunning(false);
    setState(createInitialState(nextScenario));
    setSpeedMultiplier(1);
    setBurnDirection('prograde');
    setBurnDeltaV(65);
  };

  return (
    <div className="app-shell">
      <h1>Apollo 13 Launch &amp; Lunar Flyby Simulator — v3</h1>
      <p className="subtitle">
        Simulazione educativa in unità SI con scenari guidati: launch, emergenza, free-return e rientro.
      </p>

      <Controls
        running={running}
        speed={speedMultiplier}
        showVectors={state.showVectors}
        showGravityFields={state.showGravityFields}
        burnDirection={burnDirection}
        burnDeltaV={burnDeltaV}
        scenarios={scenarios}
        selectedScenario={scenarioId}
        onStart={() => setRunning(true)}
        onPause={() => setRunning(false)}
        onReset={() => resetScenario()}
        onSpeedChange={setSpeedMultiplier}
        onToggleVectors={() => setState((prev) => ({ ...prev, showVectors: !prev.showVectors }))}
        onToggleGravity={() => setState((prev) => ({ ...prev, showGravityFields: !prev.showGravityFields }))}
        onTriggerExplosion={() => setState((prev) => triggerOxygenExplosion(prev))}
        onFreeReturnBurn={() => setState((prev) => triggerFreeReturnCorrection(prev))}
        onManualBurn={() => setState((prev) => applyBurn(prev, burnDirection, burnDeltaV))}
        onBurnDirectionChange={setBurnDirection}
        onBurnDeltaVChange={setBurnDeltaV}
        onScenarioChange={(nextScenario) => {
          setScenarioId(nextScenario);
          resetScenario(nextScenario);
        }}
      />

      {selectedScenario && (
        <div className="scenario-card">
          <strong>{selectedScenario.name}</strong>
          <p>{selectedScenario.description}</p>
        </div>
      )}

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
