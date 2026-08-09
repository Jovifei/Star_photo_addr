import { NextRequest, NextResponse } from "next/server";
import {
  GIBS_CAPABILITIES_URL,
  GIBS_LAYERS,
  buildSatelliteFrame,
  extractLayerBlock,
  latLngToTile,
  parseTileTemplate,
  parseTimeDimension,
  tileUrl,
} from "@/lib/gibs";

export const dynamic = "force-dynamic";
const CACHE_TTL_MS = 15 * 60 * 1000;
let capabilitiesCache: { xml: string; expiresAt: number } | null = null;

async function capabilities(signal: AbortSignal): Promise<string> {
  if (capabilitiesCache && capabilitiesCache.expiresAt > Date.now()) return capabilitiesCache.xml;
  const response = await fetch(GIBS_CAPABILITIES_URL, { signal, headers: { Accept: "application/xml" } });
  if (!response.ok) throw new Error(`GIBS capabilities 返回 ${response.status}`);
  const xml = await response.text();
  if (!xml.includes("<Capabilities")) throw new Error("GIBS capabilities 格式无法识别");
  capabilitiesCache = { xml, expiresAt: Date.now() + CACHE_TTL_MS };
  return xml;
}

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") as keyof typeof GIBS_LAYERS;
  if (kind !== "cloud" && kind !== "night-lights") return NextResponse.json({ error: "kind 只允许 cloud 或 night-lights" }, { status: 400 });
  const latitude = Number(request.nextUrl.searchParams.get("lat"));
  const longitude = Number(request.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return NextResponse.json({ error: "必须提供合法地图中心 lat/lng" }, { status: 400 });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const xml = await capabilities(controller.signal);
    const identifier = GIBS_LAYERS[kind];
    const block = extractLayerBlock(xml, identifier);
    const template = block && parseTileTemplate(block);
    if (!template) throw new Error(`GIBS 白名单图层未提供瓦片模板：${identifier}`);
    const dimension = parseTimeDimension(xml, identifier);
    if (!dimension.latest) throw new Error(`GIBS 白名单图层未提供时次：${identifier}`);
    const matrixSet = kind === "cloud" ? "GoogleMapsCompatible_Level6" : "GoogleMapsCompatible_Level8";
    const concreteTemplate = template.replaceAll("{TileMatrixSet}", matrixSet);
    const frameTimes = kind === "cloud"
      ? buildTenMinuteFrames(dimension.latest)
      : await findNightLightTimes(concreteTemplate, dimension.latest, latitude, longitude, controller.signal);
    const frames = frameTimes.map((time) => buildSatelliteFrame(kind, time, concreteTemplate));
    return NextResponse.json({ kind, frames, updatedAt: new Date().toISOString(), coverage: frames[0]?.coverage ?? "不可用" }, { headers: { "Cache-Control": "public, max-age=900" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "卫星时次请求失败", stale: false }, { status: controller.signal.aborted ? 504 : 502 });
  } finally {
    clearTimeout(timeout);
  }
}

function buildTenMinuteFrames(latest: string): string[] {
  const start = new Date(latest);
  return Array.from({ length: 145 }, (_, index) => {
    const time = new Date(start);
    time.setUTCMinutes(time.getUTCMinutes() - index * 10);
    return time.toISOString().replace(/\.\d{3}Z$/, "Z");
  });
}

async function findNightLightTimes(template: string, latest: string, latitude: number, longitude: number, signal: AbortSignal): Promise<string[]> {
  const start = new Date(`${latest.slice(0, 10)}T00:00:00Z`);
  const tile = latLngToTile(latitude, longitude, 8);
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() - offset);
    const time = date.toISOString().slice(0, 10);
    const url = tileUrl(template, time, 8, tile.x, tile.y);
    const response = await fetch(url, { signal, headers: { Range: "bytes=0-0" } });
    if (response.ok) return [time];
  }
  return [];
}
