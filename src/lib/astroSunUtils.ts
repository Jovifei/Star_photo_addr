import * as Astronomy from "astronomy-engine";

export interface SunEventSummary {
  timeStr: string; // HH:mm
  azimuthDeg: number; // 0..360
  compass: string; // e.g. "西北偏西"
  azimuthLabel: string; // e.g. "284° · 西北偏西"
}

export interface SiteSunDayEvents {
  sunrise: SunEventSummary | null;
  sunset: SunEventSummary | null;
  goldenHourMorning: string | null;
  blueHourMorning: string | null;
  goldenHourEvening: string | null;
  blueHourEvening: string | null;
}

const COMPASS_16 = [
  "正北",
  "北东北",
  "东北",
  "东东北",
  "正东",
  "东东南",
  "东南",
  "南东南",
  "正南",
  "南西南",
  "西南",
  "西西南",
  "正西",
  "西西北",
  "西北",
  "北西北",
];

export function azimuthToCompass(azimuth: number): string {
  const normalized = ((azimuth % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return COMPASS_16[index] ?? "正北";
}

export function formatAzimuth(azimuth: number): string {
  const rounded = Math.round(((azimuth % 360) + 360) % 360);
  return `${rounded}° · ${azimuthToCompass(rounded)}`;
}

function parseShanghaiDate(dateKey: string, hour = 12): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  // UTC = Beijing - 8h
  return new Date(Date.UTC(year, month - 1, day, hour - 8, 0, 0));
}

function formatTimeToShanghaiHHmm(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/**
 * 计算指定地点与日期的日出日落时刻与精准方位角
 */
export function calculateSiteSunEvents(
  dateKey: string,
  latitude: number,
  longitude: number,
  elevation = 0,
): SiteSunDayEvents {
  const observer = new Astronomy.Observer(latitude, longitude, Math.max(0, elevation));
  const noonDate = parseShanghaiDate(dateKey, 12);
  const midnightDate = parseShanghaiDate(dateKey, 0);

  let sunrise: SunEventSummary | null = null;
  let sunset: SunEventSummary | null = null;

  try {
    const riseTime = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun,
      observer,
      +1,
      midnightDate,
      1.2,
    );
    if (riseTime) {
      const riseDate = riseTime.date;
      const equator = Astronomy.Equator(Astronomy.Body.Sun, riseDate, observer, true, true);
      const horizon = Astronomy.Horizon(riseDate, observer, equator.ra, equator.dec, "normal");
      const az = horizon.azimuth;
      sunrise = {
        timeStr: formatTimeToShanghaiHHmm(riseDate),
        azimuthDeg: Math.round(az),
        compass: azimuthToCompass(az),
        azimuthLabel: formatAzimuth(az),
      };
    }
  } catch {
    // Edge case
  }

  try {
    const setTime = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun,
      observer,
      -1,
      noonDate,
      1.2,
    );
    if (setTime) {
      const setDate = setTime.date;
      const equator = Astronomy.Equator(Astronomy.Body.Sun, setDate, observer, true, true);
      const horizon = Astronomy.Horizon(setDate, observer, equator.ra, equator.dec, "normal");
      const az = horizon.azimuth;
      sunset = {
        timeStr: formatTimeToShanghaiHHmm(setDate),
        azimuthDeg: Math.round(az),
        compass: azimuthToCompass(az),
        azimuthLabel: formatAzimuth(az),
      };
    }
  } catch {
    // Edge case
  }

  let goldenHourEvening: string | null = null;
  let blueHourEvening: string | null = null;
  let goldenHourMorning: string | null = null;
  let blueHourMorning: string | null = null;

  try {
    const goldenSet = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, noonDate, 1.0, -4.0);
    if (goldenSet) {
      goldenHourEvening = formatTimeToShanghaiHHmm(goldenSet.date);
    }
    const blueSet = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, -1, noonDate, 1.0, -6.0);
    if (blueSet) {
      blueHourEvening = formatTimeToShanghaiHHmm(blueSet.date);
    }
  } catch {
    // Fallback
  }

  try {
    const goldenRise = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, +1, midnightDate, 1.0, +6.0);
    if (goldenRise) {
      goldenHourMorning = formatTimeToShanghaiHHmm(goldenRise.date);
    }
    const blueRise = Astronomy.SearchAltitude(Astronomy.Body.Sun, observer, +1, midnightDate, 1.0, -4.0);
    if (blueRise) {
      blueHourMorning = formatTimeToShanghaiHHmm(blueRise.date);
    }
  } catch {
    // Fallback
  }

  return {
    sunrise,
    sunset,
    goldenHourMorning,
    blueHourMorning,
    goldenHourEvening,
    blueHourEvening,
  };
}
