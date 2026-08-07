// VIIRS / Bortle reference constants, extracted from vnp46a4-2024.json.
// Single source of truth for thresholds, class colours, tile configuration and
// the public calibration formula rendered on the /viirs reference page.

import type { BortleClass } from "@/lib/types";

/** Classification lower bounds (descending), B1..B8. B9 has no lower bound. */
export const BORTLE_LOWER_BOUNDS_MPSAS: number[] = [
  21.989999771118164, 21.889999389648438, 21.690000534057617, 20.489999771118164,
  19.5, 18.940000534057617, 18.3799991607666, 17.799999237060547,
];

export const BORTLE_CLASSES: BortleClass[] = [
  { level: 1, name: "极佳暗空", color: "#000000", lowerBoundMpsas: 21.99 },
  { level: 2, name: "典型暗空", color: "#222222", lowerBoundMpsas: 21.89 },
  { level: 3, name: "乡村天空", color: "#143072", lowerBoundMpsas: 21.69 },
  { level: 4, name: "乡村—郊区过渡", color: "#105715", lowerBoundMpsas: 20.49 },
  { level: 5, name: "郊区天空", color: "#FD9650", lowerBoundMpsas: 19.5 },
  { level: 6, name: "明亮郊区天空", color: "#FC5A49", lowerBoundMpsas: 18.94 },
  { level: 7, name: "郊区—城市过渡", color: "#FC998A", lowerBoundMpsas: 18.38 },
  { level: 8, name: "城市天空", color: "#A0A0A0", lowerBoundMpsas: 17.8 },
  { level: 9, name: "城市中心天空", color: "#F2F2F2", lowerBoundMpsas: 0 },
];

export const DISPLAY_COLORS: string[] = [
  "#000000", "#222222", "#143072", "#105715", "#FD9650",
  "#FC5A49", "#FC998A", "#A0A0A0", "#F2F2F2",
];

export const DISPLAY_NAMES: string[] = [
  "极佳暗空", "典型暗空", "乡村天空", "乡村—郊区过渡", "郊区天空",
  "明亮郊区天空", "郊区—城市过渡", "城市天空", "城市中心天空",
];

/** XYZ webp tile layer configuration (value tiles only at z=8). */
export const VIIRS_WEB_LAYER = {
  type: "xyz-webp-bortle-equivalent-soft-bands",
  opacity: 0.8,
  minzoom: 3,
  maxzoom: 8,
  tileSize: 256,
  tiles: "/images/perseids/data/vnp46a4/2024/{z}/{x}/{y}.webp",
  valueTiles: "/images/perseids/data/vnp46a4/2024-values/8/{x}/{y}.webp",
  valueEncoding: "0=nodata; 1..255 => 14+(value-1)/254*8 magV/arcsec²",
  valueSemantics: "zero-anchored external-display-equivalent index; not SQM",
};

/** Physical PSF model parameters (for the /viirs reference page). */
export const VIIRS_MODEL = {
  version: "garstang-cinzano-zsb-2024-v2.0",
  physicalModelVersion: "garstang-cinzano-zsb-2024-v1.0",
  formula:
    "log10(PSF_ZSB)=a0+a1*h_obs^0.34+a2*2^log10(D)+a3*h_obs^-1.5+a4*h_obs^0.49+a5*log10(D)^4*(1/2)^h_src+a6*h_obs^-1.15*h_src^1.5+a7*log10(D)^11+a8*log10(D)^4+a9*(1/6)^log10(D)+a10*ln(h_obs)^8*h_src^0.76+a11*log10(D)^2-7.86; L_art(x)=A_cell*sum_i(R_i*PSF_ZSB(D_i)); m_raw=-2.5*log10((L_art+143.1685*10^(-0.4*22))/143.1685); L_cal=1e-6*3.7968519361994737*(L_art/1e-6)^0.7702832766980802 for L_art>0, else L_cal=0; m_display=-2.5*log10((L_cal+143.1685*10^(-0.4*22))/143.1685)",
  coefficients: [
    1.57971, 0.266809, -1.88908, -0.150676, -0.793737, -0.0282754, 0.440433,
    -1.89817e-05, 0.0657736, 0.0430336, -4.1948e-05, 0.111841,
  ],
  calibrationLog10: -7.86,
  naturalSkyMpsas: 22.0,
  vBandZeroPointWm2Sr: 143.1685,
  fitRmseLog10: 0.04907,
  fitR2: 0.99948,
};

/** Display-calibration stage (zero-anchored external-display alignment). */
export const VIIRS_DISPLAY_CALIBRATION = {
  version: "external-display-2025-zero-anchored-radiance-power-v2",
  formula:
    "L_cal=L_ref*S*(L_art/L_ref)^gamma when L_art>0; L_cal=0 when L_art=0; m_display=-2.5*log10((L_cal+L_natural)/143.1685)",
  radianceReferenceWm2Sr: 1e-6,
  dimensionlessScale: 3.7968519361994737,
  exponentGamma: 0.7702832766980802,
  zeroArtificialRadianceMpsas: 22.0,
};

/** Scientific boundary statement for the /viirs page. */
export const VIIRS_SCIENTIFIC_BOUNDARY =
  "This transfer aligns a 2024-source model with a third-party 2025 display. Its <1% in-sample/mean grouped MAPE is benchmark agreement, not 2024 temporal agreement and not independently measured SQM truth. The zero anchor is a physical boundary condition, not a fitted sea sample.";

export const VIIRS_VALIDATION = {
  screeningUncertainty:
    "Use ±1 class until an independent spatially held-out China validation set is published",
  metrics: ["bias_mpsas", "MAE_mpsas", "RMSE_mpsas", "class_accuracy", "within_one_class"],
};
