import { computeTelemetry, formatMissionTime, getScenarios } from '../simulation/physics';
import type { SimulationState } from '../simulation/types';

type Props = { state: SimulationState };

export function MissionPanel({ state }: Props) {
  const telemetry = computeTelemetry(state);
  const scenario = getScenarios().find((item) => item.id === state.mission.scenarioId);

  return (
    <aside className="panel">
      <h2>Mission Data</h2>
      {scenario && <p className="scenario-label">Scenario: {scenario.name}</p>}
      <ul className="data-list">
        <li><span>Mission Time</span><strong>{formatMissionTime(state.mission.missionTime)}</strong></li>
        <li><span>Distance from Earth</span><strong>{(telemetry.distanceEarth / 1000).toLocaleString()} km</strong></li>
        <li><span>Distance from Moon</span><strong>{(telemetry.distanceMoon / 1000).toLocaleString()} km</strong></li>
        <li><span>Estimated Speed</span><strong>{telemetry.speed.toLocaleString(undefined, { maximumFractionDigits: 0 })} m/s</strong></li>
        <li><span>Mission Phase</span><strong>{state.mission.phase}</strong></li>
        <li><span>Fuel</span><strong>{state.mission.fuel.toFixed(1)}%</strong></li>
        <li><span>Energy</span><strong>{state.mission.energy.toFixed(1)}%</strong></li>
        <li><span>Crew Status</span><strong>{state.mission.crewStatus}</strong></li>
      </ul>

      {!state.mission.serviceModuleOnline && (
        <div className="alert">Abort mode: service module disabled, LM operating as lifeboat.</div>
      )}
    </aside>
  );
}
