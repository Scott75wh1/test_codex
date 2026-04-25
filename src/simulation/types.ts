export type Vector2 = {
  x: number;
  y: number;
};

export type MissionPhase =
  | 'Launch'
  | 'Earth Parking Orbit'
  | 'Translunar Injection'
  | 'Mid-course Correction'
  | 'Oxygen Tank Explosion'
  | 'Abort lunar landing'
  | 'Free-return Correction Burn'
  | 'Lunar Flyby'
  | 'Return to Earth'
  | 'Splashdown';

export type MissionEventId =
  | 'launch'
  | 'parkingOrbit'
  | 'tli'
  | 'midCourseCorrection'
  | 'oxygenExplosion'
  | 'freeReturnBurn'
  | 'lunarFlyby'
  | 'returnToEarth'
  | 'splashdown';

export type MissionEvent = {
  id: MissionEventId;
  label: string;
  description: string;
  triggerMissionTime: number;
};

export type SpaceBody = {
  position: Vector2;
  mass: number;
  radius: number;
};

export type CapsuleState = {
  position: Vector2;
  velocity: Vector2;
  acceleration: Vector2;
  mass: number;
};

export type MissionStatus = {
  missionTime: number;
  phase: MissionPhase;
  fuel: number;
  energy: number;
  crewStatus: string;
  serviceModuleOnline: boolean;
  explosionTriggered: boolean;
};

export type SimulationState = {
  capsule: CapsuleState;
  earth: SpaceBody;
  moon: SpaceBody;
  mission: MissionStatus;
  plannedPath: Vector2[];
  actualPath: Vector2[];
  showVectors: boolean;
  showGravityFields: boolean;
};

export type BurnDirection = 'prograde' | 'retrograde' | 'normalToEarth' | 'toEarth';
