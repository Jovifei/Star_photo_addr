// Probability region fill for the Cloud Sea (云海预测) map.
//
// Interpolates cloud sea probability scores across China's mountain belts into
// a continuous colour field via inverse-distance weighting (IDW).
// Color palette: Blue-cyan scale representing the ethereal sea of clouds.

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
const INFLUENCE_KM = 380;
const IDW_POWER = 3;

export const CLOUD_SEA_LEVEL_THRESHOLDS = [20, 40, 60, 80, 90] as const;

/**
 * 云海蓝青色阶：低→高 灰→浅青→天蓝→海蓝→湛蓝→靛紫蓝
 */
export const CLOUD_SEA_LEVEL_RGB: Array<[number, number, number]> = [
  [95, 112, 120],  // p20: 灰色
  [72, 181, 181],  // p40: 浅青色
  [52, 152, 219],  // p60: 天蓝色
  [31, 120, 209],  // p80: 亮海蓝
  [25, 86, 179],   // p90: 湛蓝
  [75, 44, 165],   // p100: 靛紫蓝
];

const LEVEL_ALPHA = [45, 90, 115, 135, 155, 175] as const;

export function levelIndexFor(score: number): number {
  let index = 0;
  for (const threshold of CLOUD_SEA_LEVEL_THRESHOLDS) {
    if (score >= threshold) index += 1;
  }
  return index;
}

function distanceKmFlat(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  cosLat: number,
): number {
  const dLat = (lat2 - lat1) * 111.32;
  const dLng = (lng2 - lng1) * 111.32 * cosLat;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

/**
 * Pure IDW grid calculation. Kept free of DOM so it can be tested in Vitest/Node.
 */
export function interpolateScoreGrid(
  points: OverlayPoint[],
  width = DEFAULT_GRID_WIDTH,
  height = Math.round(
    (DEFAULT_GRID_WIDTH * (DEFAULT_BOUNDS[1][0] - DEFAULT_BOUNDS[0][0])) /
      (DEFAULT_BOUNDS[1][1] - DEFAULT_BOUNDS[0][1]),
  ),
  bounds: [[number, number], [number, number]] = DEFAULT_BOUNDS,
): Float32Array {
  const grid = new Float32Array(width * height).fill(NaN);
  const valid = points.filter(
    (point) =>
      point.score != null &&
      Number.isFinite(point.latitude) &&
      Number.isFinite(point.longitude),
  );
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
        const distance = distanceKmFlat(
          lat,
          lng,
          point.latitude,
          point.longitude,
          cosLat,
        );
        if (distance < 0.5) {
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

/**
 * Render probability grid to a PNG data URL for Leaflet ImageOverlay.
 */
export function buildProbabilityOverlay(
  points: OverlayPoint[],
  bounds: [[number, number], [number, number]] = DEFAULT_BOUNDS,
): ProbabilityOverlay | null {
  if (typeof document === "undefined") return null;

  const width = DEFAULT_GRID_WIDTH;
  const height = Math.round(
    (DEFAULT_GRID_WIDTH * (bounds[1][0] - bounds[0][0])) /
      (bounds[1][1] - bounds[0][1]),
  );

  const grid = interpolateScoreGrid(points, width, height, bounds);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const image = context.createImageData(width, height);
  const data = image.data;

  for (let row = 0; row < height; row += 1) {
    // Leaflet image overlay maps y=0 to north (top of the canvas)
    const targetRow = height - 1 - row;
    for (let column = 0; column < width; column += 1) {
      const value = grid[row * width + column];
      const targetIndex = (targetRow * width + column) * 4;

      if (Number.isNaN(value) || value < 10) {
        data[targetIndex + 3] = 0;
        continue;
      }

      const level = levelIndexFor(value);
      const [r, g, b] = CLOUD_SEA_LEVEL_RGB[level];
      const alpha = LEVEL_ALPHA[level];

      data[targetIndex] = r;
      data[targetIndex + 1] = g;
      data[targetIndex + 2] = b;
      data[targetIndex + 3] = alpha;
    }
  }

  context.putImageData(image, 0, 0);
  return {
    url: canvas.toDataURL("image/png"),
    bounds,
  };
}
