import { getMissionEvents } from '../simulation/physics';
import type { SimulationState } from '../simulation/types';

type Props = {
  state: SimulationState;
};

export function Timeline({ state }: Props) {
  const events = getMissionEvents();

  return (
    <section className="timeline" aria-label="Mission timeline">
      {events.map((event) => {
        const reached = state.mission.missionTime >= event.triggerMissionTime;
        return (
          <article key={event.id} className={`timeline-item ${reached ? 'reached' : ''}`}>
            <h3>{event.label}</h3>
            <p>{event.description}</p>
          </article>
        );
      })}
    </section>
  );
}
