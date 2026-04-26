export const G = 6.6743e-11;

export const EARTH_MASS = 5.972e24;
export const MOON_MASS = 7.342e22;
export const EARTH_MOON_DISTANCE = 384_400_000;

export const EARTH_RADIUS = 6_371_000;
export const MOON_RADIUS = 1_737_000;

export const APOLLO_MASS = 44_069;

export const PARKING_ORBIT_ALTITUDE = 185_000;
export const EARTH_PARKING_ORBIT_SPEED = 7_780;

export const DEFAULT_SIM_DT = 2;
export const PHYSICS_SUBSTEPS = 3;

// Graphic scale normalized for education while keeping SI physics
export const METERS_PER_PIXEL = 1_800_000;
export const MAX_TRAIL_POINTS = 1200;

export const INITIAL_FUEL = 100;
export const INITIAL_ENERGY = 100;

export const SPEED_MULTIPLIERS = [1, 10, 100, 1000] as const;
