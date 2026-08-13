import type { SatelliteFrame } from "./types";

export const GIBS_CAPABILITIES_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";
export const GIBS_LAYERS = {
  cloud: "Himawari_AHI_Band13_Clean_Infrared",
  "night-lights": "VIIRS_Black_Marble",
} as const;

export function extractLayerBlock(xml: string, identifier: string): string | null {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const markerMatch = xml.match(new RegExp(`<(?:(?:ows:)?)Identifier>${escaped}<\\/(?:(?:ows:)?)Identifier>`, "i"));
  const markerIndex = markerMatch?.index ?? -1;
  if (markerIndex < 0) return null;
  const start = xml.lastIndexOf("<Layer", markerIndex);
  const end = xml.indexOf("</Layer>", markerIndex);
  return start >= 0 && end >= 0 ? xml.slice(start, end + "</Layer>".length) : null;
}

export function parseTimeDimension(xml: string, identifier: string): { latest: string | null; values: string[] } {
  const block = extractLayerBlock(xml, identifier) ?? "";
  const dimension = extractTimeDimension(block) ?? block;
  const values = (dimension.match(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?Z)?/g) ?? []).sort();
  const latestDefault = block.match(/<Default>(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)<\/Default>/i)?.[1] ?? null;
  return { latest: latestDefault ?? values.at(-1) ?? null, values };
}

export function parseRecentTimeDimension(
  xml: string,
  identifier: string,
  windowHours = 24,
  nowMs = Date.now(),
): string[] {
  const block = extractLayerBlock(xml, identifier) ?? "";
  const dimension = extractTimeDimension(block) ?? "";
  const rawValues = [...dimension.matchAll(/<Value>([\s\S]*?)<\/Value>/gi)].map((match) => match[1].trim());
  const fallbackValues = rawValues.length ? rawValues : [dimension];
  const latest = parseTimeDimension(xml, identifier).latest;
  const latestMs = latest ? Math.min(Date.parse(latest), nowMs) : nowMs;
  const oldestMs = latestMs - windowHours * 60 * 60 * 1000;
  const times = new Set<string>();

  for (const value of fallbackValues) {
    for (const item of value.split(",").map((part) => part.trim()).filter(Boolean)) {
      const range = item.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)\/PT(\d+)M$/i);
      if (range) {
        const startMs = Date.parse(range[1]);
        const endMs = Math.min(Date.parse(range[2]), latestMs);
        const stepMs = Number(range[3]) * 60 * 1000;
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || !stepMs || endMs < oldestMs) continue;
        const firstMs = Math.max(startMs, oldestMs);
        const alignedMs = startMs + Math.ceil((firstMs - startMs) / stepMs) * stepMs;
        for (let timeMs = alignedMs; timeMs <= endMs; timeMs += stepMs) times.add(toGibsTime(timeMs));
        continue;
      }
      const timeMs = Date.parse(item);
      if (Number.isFinite(timeMs) && timeMs >= oldestMs && timeMs <= latestMs) times.add(toGibsTime(timeMs));
    }
  }

  return [...times].sort((left, right) => Date.parse(right) - Date.parse(left));
}

function extractTimeDimension(block: string): string | null {
  for (const match of block.matchAll(/<Dimension([^>]*)>([\s\S]*?)<\/Dimension>/gi)) {
    const attributes = match[1];
    const body = match[2];
    if (/name=["']time["']/i.test(attributes) || /<(?:(?:ows:)?)Identifier>Time<\/(?:(?:ows:)?)Identifier>/i.test(body)) {
      return body;
    }
  }
  return null;
}

function toGibsTime(timeMs: number): string {
  return new Date(timeMs).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function parseTileTemplate(block: string): string | null {
  const match = block.match(/<ResourceURL[^>]+template=["']([^"']+)["'][^>]*>/i);
  return match?.[1] ?? null;
}

export function buildSatelliteFrame(
  kind: "cloud" | "night-lights",
  time: string,
  tileTemplate: string,
): SatelliteFrame {
  return {
    time,
    observedAt: time,
    kind,
    layer: GIBS_LAYERS[kind],
    label: kind === "cloud" ? "卫星云观测" : "卫星夜光/辐亮度影像（2016 基准）",
    satellite: kind === "cloud" ? "Himawari AHI Band 13" : "VIIRS Black Marble",
    source: "NASA GIBS",
    tileTemplate,
    coverage: kind === "cloud" ? "东亚静止卫星红外观测" : "全球夜光基准（2016）",
    observed: true,
    isForecast: false,
    reference: kind === "night-lights",
  };
}

export function tileUrl(template: string, time: string, z: number, x: number, y: number): string {
  return template.replaceAll("{Time}", time).replace("{TileMatrix}", String(z)).replace("{TileCol}", String(x)).replace("{TileRow}", String(y));
}

export function latLngToTile(latitude: number, longitude: number, zoom: number): { x: number; y: number } {
  const size = 2 ** zoom;
  const safeLatitude = Math.max(-85.0511, Math.min(85.0511, latitude));
  const x = Math.floor(((longitude + 180) / 360) * size);
  const radians = (safeLatitude * Math.PI) / 180;
  const y = Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * size);
  return { x: Math.max(0, Math.min(size - 1, x)), y: Math.max(0, Math.min(size - 1, y)) };
}
