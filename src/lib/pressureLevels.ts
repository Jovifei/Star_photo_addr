export const PRESSURE_LEVELS = [
  1000,
  975,
  950,
  925,
  900,
  850,
  800,
  700,
  600,
  500,
] as const;

export type PressureLevelHpa = (typeof PRESSURE_LEVELS)[number];
