import type { SatelliteFrame } from "./types";

export const GIBS_CAPABILITIES_URL = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";
export const GIBS_LAYERS = {
  cloud: "Himawari_AHI_Band13_Clean_Infrared",
  "night-lights": "VIIRS_NOAA20_DayNightBand_AtSensor_M15",
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
  const dimension = block.match(/<Dimension[^>]*name=["']time["'][^>]*>([\s\S]*?)<\/Dimension>/i)?.[1] ?? block;
  const values = (dimension.match(/\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?Z)?/g) ?? []).sort();
  const latestDefault = block.match(/<Default>(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?Z)<\/Default>/i)?.[1] ?? null;
  return { latest: latestDefault ?? values.at(-1) ?? null, values };
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
    kind,
    label: kind === "cloud" ? "卫星云观测" : "卫星夜光/辐亮度影像",
    satellite: kind === "cloud" ? "Himawari AHI Band 13" : "NOAA-20 VIIRS Day/Night Band",
    source: "NASA GIBS",
    tileTemplate,
    coverage: kind === "cloud" ? "东亚静止卫星红外观测" : "全球夜间辐亮度影像",
    observed: true,
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
