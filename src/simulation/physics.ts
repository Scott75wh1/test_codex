import {
  APOLLO_MASS,
  DEFAULT_SIM_DT,
  EARTH_MASS,
  EARTH_MOON_DISTANCE,
  EARTH_PARKING_ORBIT_SPEED,
  EARTH_RADIUS,
  G,
  INITIAL_ENERGY,
  INITIAL_FUEL,
  MAX_TRAIL_POINTS,
  MOON_MASS,
  MOON_RADIUS,
  PARKING_ORBIT_ALTITUDE,
} from './constants';
import type { BurnDirection, MissionEvent, MissionEventId, SimulationState, Vector2 } from './types';

const MISSION_EVENTS: MissionEvent[] = [
  { id: 'launch', label: 'Launch', description: 'Saturn V launch from Kennedy Space Center.', triggerMissionTime: 0 },
  { id: 'parkingOrbit', label: 'Earth Parking Orbit', description: 'Low Earth parking orbit achieved.', triggerMissionTime: 720 },
  { id: 'tli', label: 'Translunar Injection', description: 'S-IVB burn to send Apollo 13 toward the Moon.', triggerMissionTime: 2_400 },
  {
    id: 'midCourseCorrection',
    label: 'Mid-course Correction',
    description: 'Small burn to refine transfer trajectory.',
    triggerMissionTime: 86_400,
  },
  {
    id: 'oxygenExplosion',
    label: 'Oxygen Tank Explosion',
    description: 'Service module oxygen tank failure; mission objectives change.',
    triggerMissionTime: 201_000,
  },
  {
    id: 'freeReturnBurn',
    label: 'Free-return Correction Burn',
    description: 'Lunar module used to shape free-return path.',
    triggerMissionTime: 220_000,
  },
  { id: 'lunarFlyby', label: 'Lunar Flyby', description: 'Closest approach around the Moon.', triggerMissionTime: 260_000 },
  { id: 'returnToEarth', label: 'Return to Earth', description: 'Inbound arc back to Earth.', triggerMissionTime: 300_000 },
  { id: 'splashdown', label: 'Splashdown', description: 'Pacific Ocean recovery zone approach.', triggerMissionTime: 480_000 },
];

const eventPhaseMap: Record<MissionEventId, SimulationState['mission']['phase']> = {
  launch: 'Launch',
  parkingOrbit: 'Earth Parking Orbit',
  tli: 'Translunar Injection',
  midCourseCorrection: 'Mid-course Correction',
  oxygenExplosion: 'Oxygen Tank Explosion',
  freeReturnBurn: 'Free-return Correction Burn',
  lunarFlyby: 'Lunar Flyby',
  returnToEarth: 'Return to Earth',
  splashdown: 'Splashdown',
};

export const getMissionEvents = (): MissionEvent[] => MISSION_EVENTS;

const magnitude = (vector: Vector2): number => Math.hypot(vector.x, vector.y);

const normalize = (vector: Vector2): Vector2 => {
  const mag = magnitude(vector);
  if (mag === 0) return { x: 0, y: 0 };
  return { x: vector.x / mag, y: vector.y / mag };
};

const subtract = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (v: Vector2, factor: number): Vector2 => ({ x: v.x * factor, y: v.y * factor });

const computeBodyAcceleration = (position: Vector2, bodyPosition: Vector2, bodyMass: number): Vector2 => {
  // Newtonian gravity: F = G * (m1 * m2) / r^2
  // Capsule acceleration from the body: a = F / m_capsule = G * bodyMass / r^2
  // Using vector form: a_vec = (G * bodyMass / r^2) * unit_vector_toward_body
  const direction = subtract(bodyPosition, position);
  const distance = Math.max(magnitude(direction), 1);
  const accelMagnitude = (G * bodyMass) / (distance * distance);
  return scale(normalize(direction), accelMagnitude);
};

const updatePhaseFromTime = (missionTime: number, currentPhase: SimulationState['mission']['phase']): SimulationState['mission']['phase'] => {
  let updatedPhase = currentPhase;
  for (const event of MISSION_EVENTS) {
    if (missionTime >= event.triggerMissionTime) {
      updatedPhase = eventPhaseMap[event.id];
    }
  }
  return updatedPhase;
};

export const createInitialState = (): SimulationState => {
  const initialPosition = { x: 0, y: EARTH_RADIUS + PARKING_ORBIT_ALTITUDE };

  return {
    earth: {
      position: { x: 0, y: 0 },
      mass: EARTH_MASS,
      radius: EARTH_RADIUS,
    },
    moon: {
      position: { x: EARTH_MOON_DISTANCE, y: 0 },
      mass: MOON_MASS,
      radius: MOON_RADIUS,
    },
    capsule: {
      position: initialPosition,
      velocity: { x: EARTH_PARKING_ORBIT_SPEED, y: 0 },
      acceleration: { x: 0, y: 0 },
      mass: APOLLO_MASS,
    },
    mission: {
      missionTime: 0,
      phase: 'Launch',
      fuel: INITIAL_FUEL,
      energy: INITIAL_ENERGY,
      crewStatus: 'Nominal',
      serviceModuleOnline: true,
      explosionTriggered: false,
    },
    plannedPath: [initialPosition],
    actualPath: [initialPosition],
    showVectors: false,
    showGravityFields: false,
  };
};

export const computePlannedPath = (state: SimulationState, points = 450): Vector2[] => {
  const ghost = {
    position: { ...state.capsule.position },
    velocity: { ...state.capsule.velocity },
  };
  const dt = DEFAULT_SIM_DT * 10;
  const predicted: Vector2[] = [];

  for (let i = 0; i < points; i += 1) {
    const aEarth = computeBodyAcceleration(ghost.position, state.earth.position, state.earth.mass);
    const aMoon = computeBodyAcceleration(ghost.position, state.moon.position, state.moon.mass);
    const accel = add(aEarth, aMoon);

    ghost.velocity = add(ghost.velocity, scale(accel, dt));
    ghost.position = add(ghost.position, scale(ghost.velocity, dt));
    predicted.push({ ...ghost.position });
  }

  return predicted;
};

export const applyBurn = (state: SimulationState, direction: BurnDirection, deltaV: number): SimulationState => {
  const velocityUnit = normalize(state.capsule.velocity);
  const towardEarthUnit = normalize(subtract(state.earth.position, state.capsule.position));
  const normal = { x: -towardEarthUnit.y, y: towardEarthUnit.x };

  let burnVector: Vector2;

  switch (direction) {
    case 'retrograde':
      burnVector = scale(velocityUnit, -deltaV);
      break;
    case 'normalToEarth':
      burnVector = scale(normal, deltaV);
      break;
    case 'toEarth':
      burnVector = scale(towardEarthUnit, deltaV);
      break;
    case 'prograde':
    default:
      burnVector = scale(velocityUnit, deltaV);
      break;
  }

  const fuelCost = Math.min(18, Math.max(1, deltaV / 20));

  return {
    ...state,
    capsule: {
      ...state.capsule,
      velocity: add(state.capsule.velocity, burnVector),
    },
    mission: {
      ...state.mission,
      fuel: Math.max(0, state.mission.fuel - fuelCost),
    },
  };
};

export const triggerOxygenExplosion = (state: SimulationState): SimulationState => {
  if (state.mission.explosionTriggered) return state;

  return {
    ...applyBurn(state, 'toEarth', 90),
    mission: {
      ...state.mission,
      phase: 'Abort lunar landing',
      energy: Math.max(15, state.mission.energy - 55),
      crewStatus: 'Stressed but operational',
      serviceModuleOnline: false,
      explosionTriggered: true,
    },
  };
};

export const stepSimulation = (state: SimulationState, dt = DEFAULT_SIM_DT): SimulationState => {
  const aEarth = computeBodyAcceleration(state.capsule.position, state.earth.position, state.earth.mass);
  const aMoon = computeBodyAcceleration(state.capsule.position, state.moon.position, state.moon.mass);
  const totalAcceleration = add(aEarth, aMoon);

  // Euler integration (educational):
  // v_new = v_old + a * dt
  // pos_new = pos_old + v_new * dt
  const newVelocity = add(state.capsule.velocity, scale(totalAcceleration, dt));
  const newPosition = add(state.capsule.position, scale(newVelocity, dt));

  const missionTime = state.mission.missionTime + dt;

  const dynamicEnergyDrain = state.mission.explosionTriggered ? 0.0022 * dt : 0.0002 * dt;

  const updatedMission = {
    ...state.mission,
    missionTime,
    phase: state.mission.explosionTriggered
      ? 'Abort lunar landing'
      : updatePhaseFromTime(missionTime, state.mission.phase),
    energy: Math.max(0, state.mission.energy - dynamicEnergyDrain),
    crewStatus: state.mission.energy < 20 ? 'Critical load' : state.mission.crewStatus,
  };

  const actualPath = [...state.actualPath, newPosition].slice(-MAX_TRAIL_POINTS);

  return {
    ...state,
    capsule: {
      ...state.capsule,
      position: newPosition,
      velocity: newVelocity,
      acceleration: totalAcceleration,
    },
    mission: updatedMission,
    actualPath,
  };
};

export const getDistance = (a: Vector2, b: Vector2): number => magnitude(subtract(a, b));

export const getSpeed = (velocity: Vector2): number => magnitude(velocity);

export const formatMissionTime = (seconds: number): string => {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);
  return `${d}d ${h.toString().padStart(2, '0')}h:${m.toString().padStart(2, '0')}m:${s
    .toString()
    .padStart(2, '0')}s`;
};
