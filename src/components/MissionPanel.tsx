import { getDistance, getSpeed, formatMissionTime } from '../simulation/physics';
import type { SimulationState } from '../simulation/types';

type Props = {
  state: SimulationState;
};

const toKm = (meters: number) => meters / 1000;

export function MissionPanel({ state }: Props) {
  const distanceEarth = toKm(getDistance(state.capsule.position, state.earth.position));
  const distanceMoon = toKm(getDistance(state.capsule.position, state.moon.position));
  const speed = getSpeed(state.capsule.velocity);

  return (
    <aside className="panel">
      <h2>Mission Data</h2>
      <ul className="data-list">
        <li>
          <span>Mission Time</span>
          <strong>{formatMissionTime(state.mission.missionTime)}</strong>
        </li>
        <li>
          <span>Distance from Earth</span>
          <strong>{distanceEarth.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</strong>
        </li>
        <li>
          <span>Distance from Moon</span>
          <strong>{distanceMoon.toLocaleString(undefined, { maximumFractionDigits: 0 })} km</strong>
        </li>
        <li>
          <span>Estimated Speed</span>
          <strong>{speed.toLocaleString(undefined, { maximumFractionDigits: 0 })} m/s</strong>
        </li>
        <li>
          <span>Mission Phase</span>
          <strong>{state.mission.phase}</strong>
        </li>
        <li>
          <span>Fuel</span>
          <strong>{state.mission.fuel.toFixed(1)}%</strong>
        </li>
        <li>
          <span>Energy</span>
          <strong>{state.mission.energy.toFixed(1)}%</strong>
        </li>
        <li>
          <span>Crew Status</span>
          <strong>{state.mission.crewStatus}</strong>
        </li>
      </ul>
      {!state.mission.serviceModuleOnline && <div className="alert">Service module offline. LM acting as lifeboat.</div>}
    </aside>
  );
}
