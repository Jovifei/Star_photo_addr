/** Explicit provider units for synthetic raw HTTP responses, independent of production validation. */
export function providerUnits(time: "iso8601" | "unixtime" = "iso8601"): Record<string, string> {
  const units: Record<string, string> = {
    time,
    temperature_2m: "°C", dew_point_2m: "°C", relative_humidity_2m: "%",
    precipitation_probability: "%", precipitation: "mm", weather_code: "wmo code",
    cloud_cover: "%", cloud_cover_low: "%", cloud_cover_mid: "%", cloud_cover_high: "%",
    visibility: "m", wind_speed_10m: "m/s", wind_gusts_10m: "m/s", wind_direction_10m: "°",
  };
  for (const level of [1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 725, 700, 650, 600, 550, 500]) {
    units[`cloud_cover_${level}hPa`] = "%";
    units[`relative_humidity_${level}hPa`] = "%";
    units[`temperature_${level}hPa`] = "°C";
    units[`geopotential_height_${level}hPa`] = "m";
  }
  return units;
}
