// Probability region fill for the fire-glow map.
//
// 242 curated sites become a continuous colour field via inverse-distance
// weighting (power 3, ~340 km radius of influence), banded into the same
// five 20% probability levels as the markers. The grid renders to a canvas
// data URL for a Leaflet ImageOverlay, giving the light-pollution-style
// "colour region" reading instead of isolated dots. Cells beyond the
// influence radius stay transparent so empty regions are not painted.

export interface OverlayPoint {
  latitude: number;
  longitude: number;
  score: number | null;
}

export interface ProbabilityOverlay {
  url: string;
  bounds: [[number, number], [number, number]];
}

const DEFAULT_BOUNDS: [[number, number], [number, number]] = [
  [16.5, 72],
  [54.5, 136],
];
const DEFAULT_GRID_WIDTH = 176;
const INFLUENCE_KM = 340;
const IDW_POWER = 3;

export const LEVEL_THRESHOLDS = [15, 34, 52, 72, 80, 88] as const;
/**
 * 与页面 LEVEL_COLORS 一致：低→高 灰/绿/黄/橙 + 红三级递深
 * （80–88% 正红、88–95% 深红、95–100% 绛红），概率越高越深越实。
 */
export const LEVEL_RGB: Array<[number, number, number]> = [
  [95, 112, 120],
  [93, 164, 107],
  [212, 178, 60],
  [224, 138, 63],
  [224, 79, 58],
  [186, 44, 32],
  [128, 12, 12],
];
const LEVEL_ALPHA = [50, 96, 118, 128, 140, 158, 178] as const;

function levelIndexFor(score: number): number {
  let index = 0;
  for (const threshold of LEVEL_THRESHOLDS) {
    if (score >= threshold) index += 1;
  }
  return index;
}

function distanceKmFlat(lat1: number, lng1: number, lat2: number, lng2: number, cosLat: number): number {
  const dLat = (lat2 - lat1) * 111.32;
  const dLng = (lng2 - lng1) * 111.32 * cosLat;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Pure IDW grid over the bounds. Returns a Float32Array of `width × height`
 * with NaN for out-of-influence cells — kept free of DOM so it is testable.
 */
export function interpolateScoreGrid(
  points: OverlayPoint[],
  width = DEFAULT_GRID_WIDTH,
  height = Math.round((DEFAULT_GRID_WIDTH * (DEFAULT_BOUNDS[1][0] - DEFAULT_BOUNDS[0][0])) / (DEFAULT_BOUNDS[1][1] - DEFAULT_BOUNDS[0][1])),
  bounds: [[number, number], [number, number]] = DEFAULT_BOUNDS,
): Float32Array {
  const grid = new Float32Array(width * height).fill(NaN);
  const valid = points.filter((point) => point.score != null && Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  if (!valid.length) return grid;
  const [south, west] = bounds[0];
  const [north, east] = bounds[1];
  const latStep = (north - south) / (height - 1);
  const lngStep = (east - west) / (width - 1);
  for (let row = 0; row < height; row += 1) {
    const lat = south + row * latStep;
    const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    for (let column = 0; column < width; column += 1) {
      const lng = west + column * lngStep;
      let weightSum = 0;
      let scoreSum = 0;
      for (const point of valid) {
        const distance = distanceKmFlat(lat, lng, point.latitude, point.longitude, cosLat);
        if (distance < 0.5) {
          // 网格恰落在站点上：直接取站点值，避免权重除法退化。
          weightSum = 1;
          scoreSum = point.score as number;
          break;
        }
        if (distance > INFLUENCE_KM) continue;
        const weight = 1 / Math.pow(distance, IDW_POWER);
        weightSum += weight;
        scoreSum += weight * (point.score as number);
      }
      if (weightSum > 0) {
        grid[row * width + column] = scoreSum / weightSum;
      }
    }
  }
  return grid;
}

/** Render the grid to a canvas data URL for a Leaflet ImageOverlay. */
export function buildProbabilityOverlay(points: OverlayPoint[]): ProbabilityOverlay | null {
  if (typeof document === "undefined") return null;
  const height = Math.round((DEFAULT_GRID_WIDTH * (DEFAULT_BOUNDS[1][0] - DEFAULT_BOUNDS[0][0])) / (DEFAULT_BOUNDS[1][1] - DEFAULT_BOUNDS[0][1]));
  const grid = interpolateScoreGrid(points, DEFAULT_GRID_WIDTH, height);
  const canvas = document.createElement("canvas");
  canvas.width = DEFAULT_GRID_WIDTH;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(DEFAULT_GRID_WIDTH, height);
  for (let index = 0; index < grid.length; index += 1) {
    const value = grid[index];
    const pixel = index * 4;
    if (!Number.isFinite(value)) {
      image.data[pixel + 3] = 0;
      continue;
    }
    const level = levelIndexFor(value);
    const [r, g, b] = LEVEL_RGB[level];
    image.data[pixel] = r;
    image.data[pixel + 1] = g;
    image.data[pixel + 2] = b;
    image.data[pixel + 3] = LEVEL_ALPHA[level];
  }
  context.putImageData(image, 0, 0);
  return { url: canvas.toDataURL(), bounds: DEFAULT_BOUNDS };
}
