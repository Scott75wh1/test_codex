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
  PHYSICS_SUBSTEPS,
} from './constants';
import type { BurnDirection, MissionEvent, MissionEventId, SimulationState, Telemetry, Vector2 } from './types';

const MISSION_EVENTS: MissionEvent[] = [
  { id: 'launch', label: 'Launch', description: 'Saturn V lifts off from Kennedy Space Center.', triggerMissionTime: 0, phase: 'Launch' },
  {
    id: 'parkingOrbit',
    label: 'Earth Parking Orbit',
    description: 'Stable parking orbit around Earth before TLI.',
    triggerMissionTime: 720,
    phase: 'Earth Parking Orbit',
  },
  {
    id: 'tli',
    label: 'Translunar Injection',
    description: 'Powerful burn sends Apollo 13 toward the Moon.',
    triggerMissionTime: 2_400,
    phase: 'Translunar Injection',
  },
  {
    id: 'midCourseCorrection',
    label: 'Mid-course Correction',
    description: 'Minor correction to improve lunar encounter geometry.',
    triggerMissionTime: 86_400,
    phase: 'Mid-course Correction',
  },
  {
    id: 'oxygenExplosion',
    label: 'Oxygen Tank Explosion',
    description: 'Service module oxygen tank explodes.',
    triggerMissionTime: 201_000,
    phase: 'Oxygen Tank Explosion',
  },
  {
    id: 'freeReturnBurn',
    label: 'Free-return Correction Burn',
    description: 'Lunar module burn aligns safe Earth-return trajectory.',
    triggerMissionTime: 220_000,
    phase: 'Free-return Correction Burn',
  },
  {
    id: 'lunarFlyby',
    label: 'Lunar Flyby',
    description: 'Closest pass behind the Moon.',
    triggerMissionTime: 260_000,
    phase: 'Lunar Flyby',
  },
  {
    id: 'returnToEarth',
    label: 'Return to Earth',
    description: 'Inbound coast arc toward Earth.',
    triggerMissionTime: 300_000,
    phase: 'Return to Earth',
  },
  {
    id: 'splashdown',
    label: 'Splashdown',
    description: 'Pacific Ocean splashdown and recovery.',
    triggerMissionTime: 480_000,
    phase: 'Splashdown',
  },
];

export const getMissionEvents = () => MISSION_EVENTS;

const magnitude = (v: Vector2) => Math.hypot(v.x, v.y);
const add = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (v: Vector2, s: number): Vector2 => ({ x: v.x * s, y: v.y * s });

const normalize = (v: Vector2): Vector2 => {
  const m = magnitude(v);
  return m > 0 ? scale(v, 1 / m) : { x: 0, y: 0 };
};

const gravityAccel = (position: Vector2, bodyPosition: Vector2, bodyMass: number): Vector2 => {
  // F = G * (m1*m2)/r^2 and a = F/m_capsule => a = G * bodyMass / r^2
  // Vector form uses the unit vector toward the attracting body.
  const dir = sub(bodyPosition, position);
  const r = Math.max(1, magnitude(dir));
  const a = (G * bodyMass) / (r * r);
  return scale(normalize(dir), a);
};

const combinedAcceleration = (state: SimulationState, position: Vector2): Vector2 => {
  const aEarth = gravityAccel(position, state.earth.position, state.earth.mass);
  const aMoon = gravityAccel(position, state.moon.position, state.moon.mass);
  return add(aEarth, aMoon);
};

const isEventReached = (eventId: MissionEventId, missionTime: number) => {
  const e = MISSION_EVENTS.find((event) => event.id === eventId);
  return e ? missionTime >= e.triggerMissionTime : false;
};

const updateMissionFromTime = (mission: SimulationState['mission'], missionTime: number): SimulationState['mission'] => {
  let phase = mission.phase;
  const active = new Set(mission.activeEventIds);

  for (const event of MISSION_EVENTS) {
    if (missionTime >= event.triggerMissionTime) {
      active.add(event.id);
      phase = event.phase;
    }
  }

  return {
    ...mission,
    missionTime,
    phase,
    activeEventIds: [...active],
  };
};

export const createInitialState = (): SimulationState => {
  const initialPosition = { x: 0, y: EARTH_RADIUS + PARKING_ORBIT_ALTITUDE };
  return {
    earth: { position: { x: 0, y: 0 }, mass: EARTH_MASS, radius: EARTH_RADIUS },
    moon: { position: { x: EARTH_MOON_DISTANCE, y: 0 }, mass: MOON_MASS, radius: MOON_RADIUS },
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
      activeEventIds: ['launch'],
    },
    plannedPath: [initialPosition],
    actualPath: [initialPosition],
    showVectors: false,
    showGravityFields: false,
  };
};

export const computePlannedPath = (state: SimulationState, points = 500): Vector2[] => {
  let pos = { ...state.capsule.position };
  let vel = { ...state.capsule.velocity };
  const dt = DEFAULT_SIM_DT * 20;
  const out: Vector2[] = [];

  for (let i = 0; i < points; i += 1) {
    const accel = combinedAcceleration(state, pos);
    vel = add(vel, scale(accel, dt));
    pos = add(pos, scale(vel, dt));
    out.push({ ...pos });
  }

  return out;
};

export const applyBurn = (state: SimulationState, direction: BurnDirection, deltaV: number): SimulationState => {
  const velocityDir = normalize(state.capsule.velocity);
  const toEarth = normalize(sub(state.earth.position, state.capsule.position));
  const normal = { x: -toEarth.y, y: toEarth.x };

  const burnDirectionMap: Record<BurnDirection, Vector2> = {
    prograde: velocityDir,
    retrograde: scale(velocityDir, -1),
    normalToEarth: normal,
    toEarth,
  };

  const burn = scale(burnDirectionMap[direction], deltaV);
  const fuelCost = Math.min(20, Math.max(0.7, deltaV / 18));

  return {
    ...state,
    capsule: {
      ...state.capsule,
      velocity: add(state.capsule.velocity, burn),
    },
    mission: {
      ...state.mission,
      fuel: Math.max(0, state.mission.fuel - fuelCost),
    },
  };
};

export const triggerOxygenExplosion = (state: SimulationState): SimulationState => {
  if (state.mission.explosionTriggered) return state;

  const withAbortBurn = applyBurn(state, 'toEarth', 120);
  const active = new Set(withAbortBurn.mission.activeEventIds);
  active.add('oxygenExplosion');

  return {
    ...withAbortBurn,
    mission: {
      ...withAbortBurn.mission,
      phase: 'Abort lunar landing',
      energy: Math.max(20, withAbortBurn.mission.energy - 58),
      crewStatus: 'Emergency procedures active',
      serviceModuleOnline: false,
      explosionTriggered: true,
      activeEventIds: [...active],
    },
  };
};

export const triggerFreeReturnCorrection = (state: SimulationState): SimulationState => {
  const corrected = applyBurn(state, 'toEarth', 85);
  const active = new Set(corrected.mission.activeEventIds);
  active.add('freeReturnBurn');

  return {
    ...corrected,
    mission: {
      ...corrected.mission,
      phase: 'Free-return Correction Burn',
      crewStatus: 'LM-guided free-return active',
      activeEventIds: [...active],
    },
  };
};

export const stepSimulation = (state: SimulationState, dt = DEFAULT_SIM_DT): SimulationState => {
  const subDt = dt / PHYSICS_SUBSTEPS;
  let position = { ...state.capsule.position };
  let velocity = { ...state.capsule.velocity };
  let acceleration = { ...state.capsule.acceleration };

  // Semi-implicit Euler with substeps for better stability:
  // v(t+dt) = v(t) + a(t)*dt
  // x(t+dt) = x(t) + v(t+dt)*dt
  for (let i = 0; i < PHYSICS_SUBSTEPS; i += 1) {
    acceleration = combinedAcceleration(state, position);
    velocity = add(velocity, scale(acceleration, subDt));
    position = add(position, scale(velocity, subDt));
  }

  const missionTime = state.mission.missionTime + dt;
  let mission = updateMissionFromTime(state.mission, missionTime);

  if (isEventReached('oxygenExplosion', missionTime) && !mission.explosionTriggered) {
    const exploded = triggerOxygenExplosion({
      ...state,
      capsule: { ...state.capsule, position, velocity, acceleration },
      mission,
    });
    return {
      ...exploded,
      actualPath: [...state.actualPath, position].slice(-MAX_TRAIL_POINTS),
    };
  }

  if (isEventReached('freeReturnBurn', missionTime) && mission.explosionTriggered && mission.phase !== 'Free-return Correction Burn') {
    const corrected = triggerFreeReturnCorrection({
      ...state,
      capsule: { ...state.capsule, position, velocity, acceleration },
      mission,
    });
    mission = corrected.mission;
    velocity = corrected.capsule.velocity;
  }

  const energyDrain = mission.explosionTriggered ? 0.004 : 0.0003;
  mission = {
    ...mission,
    energy: Math.max(0, mission.energy - energyDrain * dt),
    crewStatus: mission.energy < 22 ? 'Critical load' : mission.crewStatus,
  };

  return {
    ...state,
    capsule: {
      ...state.capsule,
      position,
      velocity,
      acceleration,
    },
    mission,
    actualPath: [...state.actualPath, position].slice(-MAX_TRAIL_POINTS),
  };
};

export const getDistance = (a: Vector2, b: Vector2) => magnitude(sub(a, b));
export const getSpeed = (v: Vector2) => magnitude(v);

export const computeTelemetry = (state: SimulationState): Telemetry => ({
  distanceEarth: getDistance(state.capsule.position, state.earth.position),
  distanceMoon: getDistance(state.capsule.position, state.moon.position),
  speed: getSpeed(state.capsule.velocity),
});

export const formatMissionTime = (seconds: number): string => {
  const s = Math.floor(seconds % 60);
  const m = Math.floor((seconds / 60) % 60);
  const h = Math.floor((seconds / 3600) % 24);
  const d = Math.floor(seconds / 86400);
  return `${d}d ${String(h).padStart(2, '0')}h:${String(m).padStart(2, '0')}m:${String(s).padStart(2, '0')}s`;
};
