import { PRESSURE_LEVELS } from "./clouds.js";

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const SURFACE_VARIABLES = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "cloud_cover_low",
  "cloud_cover_mid",
  "cloud_cover_high",
  "visibility",
  "wind_speed_10m",
  "wind_gusts_10m",
];

function providerUrl(locations, days, variables) {
  const params = new URLSearchParams({
    latitude: locations.map((item) => item.latitude).join(","),
    longitude: locations.map((item) => item.longitude).join(","),
    hourly: variables.join(","),
    timezone: "Asia/Shanghai",
    forecast_days: String(Math.min(16, Math.max(1, days))),
    wind_speed_unit: "ms",
  });
  return `${FORECAST_URL}?${params}`;
}

async function requestJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`天气接口返回 ${response.status}`);
  return response.json();
}

function normalizeHourly(response) {
  const hourly = response.hourly;
  return hourly.time.map((time, index) => ({
    time,
    temperature: hourly.temperature_2m?.[index],
    humidity: hourly.relative_humidity_2m?.[index],
    dewPoint: hourly.dew_point_2m?.[index],
    precipitationProbability: hourly.precipitation_probability?.[index],
    precipitation: hourly.precipitation?.[index],
    weatherCode: hourly.weather_code?.[index],
    cloudCover: hourly.cloud_cover?.[index],
    cloudLow: hourly.cloud_cover_low?.[index],
    cloudMid: hourly.cloud_cover_mid?.[index],
    cloudHigh: hourly.cloud_cover_high?.[index],
    visibility: hourly.visibility?.[index],
    windSpeed: hourly.wind_speed_10m?.[index],
    windGust: hourly.wind_gusts_10m?.[index],
  }));
}

export async function fetchSurfaceForecasts(locations, days = 14, signal) {
  const data = await requestJson(providerUrl(locations, days, SURFACE_VARIABLES), signal);
  const responses = Array.isArray(data) ? data : [data];
  return locations.map((location, index) => ({
    locationId: location.id,
    modelLatitude: responses[index].latitude,
    modelLongitude: responses[index].longitude,
    modelElevation: responses[index].elevation,
    timezone: responses[index].timezone,
    fetchedAt: new Date().toISOString(),
    hourly: normalizeHourly(responses[index]),
  }));
}

export async function fetchPressureForecast(location, days = 7, signal) {
  const pressureVariables = PRESSURE_LEVELS.flatMap((level) => [
    `cloud_cover_${level}hPa`,
    `relative_humidity_${level}hPa`,
    `temperature_${level}hPa`,
    `geopotential_height_${level}hPa`,
  ]);
  const data = await requestJson(providerUrl([location], days, [...SURFACE_VARIABLES, ...pressureVariables]), signal);
  const forecast = {
    locationId: location.id,
    modelElevation: data.elevation,
    fetchedAt: new Date().toISOString(),
    hourly: normalizeHourly(data),
    profiles: {},
  };
  data.hourly.time.forEach((time, index) => {
    forecast.profiles[time] = PRESSURE_LEVELS.map((level) => ({
      pressure: level,
      cloudCover: data.hourly[`cloud_cover_${level}hPa`]?.[index],
      humidity: data.hourly[`relative_humidity_${level}hPa`]?.[index],
      temperature: data.hourly[`temperature_${level}hPa`]?.[index],
      heightMsl: data.hourly[`geopotential_height_${level}hPa`]?.[index],
    }));
  });
  return forecast;
}
