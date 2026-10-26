export const PRESSURE_LEVELS = [
  1000,
  975,
  950,
  925,
  900,
  875,
  850,
  825,
  800,
  775,
  750,
  725,
  700,
  650,
  600,
  550,
  500,
] as const;

export type PressureLevelHpa = (typeof PRESSURE_LEVELS)[number];
