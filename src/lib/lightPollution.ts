export const DEFAULT_LIGHT_POLLUTION_TILE_URL =
  "https://lpm.darkmap.cn/gwc/service/wmts?layer=PostGIS:VIIR_2023&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:{z}&TileCol={x}&TileRow={y}";

/**
 * Visual VIIRS 2023 reference raster. This is a third-party tile service and
 * must not be presented as a live Bortle/SQM measurement. Aliyun deployments
 * can replace it at build time with a licensed/self-hosted WMTS template.
 */
export const LIGHT_POLLUTION_TILE_URL =
  process.env.NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL?.trim() ||
  DEFAULT_LIGHT_POLLUTION_TILE_URL;

export const LIGHT_POLLUTION_ATTRIBUTION =
  "光污染参考 © darkmap.cn · VIIRS 2023";

const REQUIRED_TILE_PLACEHOLDERS = ["{z}", "{x}", "{y}"] as const;

/**
 * Validate the public Leaflet/WMTS template before either the browser or the
 * server-side health probe tries to use it. A malformed build-time value used
 * to produce a page that looked healthy while every tile request was invalid.
 */
export function lightPollutionTemplateError(template: string): string | null {
  const value = template.trim();
  if (!value) return "瓦片模板为空";
  if (/\p{C}/u.test(value)) return "瓦片模板包含控制字符";

  const missing = REQUIRED_TILE_PLACEHOLDERS.filter(
    (placeholder) => !value.includes(placeholder),
  );
  if (missing.length) {
    return `瓦片模板缺少 ${missing.join("、")} 占位符`;
  }

  const concrete = materializeLightPollutionTile(value, 4, 12, 6)
    .replaceAll("{s}", "a")
    .replaceAll("{r}", "")
    .replaceAll("{-y}", "6");
  if (/\{[^}]+\}/.test(concrete)) {
    return "瓦片模板包含不支持的占位符";
  }

  try {
    const url = new URL(concrete);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "瓦片模板必须使用 HTTP 或 HTTPS";
    }
    if (url.username || url.password) {
      return "瓦片模板不能在 URL 中携带账号或密码";
    }
  } catch {
    return "瓦片模板不是合法 URL";
  }
  return null;
}

export function materializeLightPollutionTile(
  template: string,
  zoom = 4,
  x = 12,
  y = 6,
): string {
  return template
    .replaceAll("{z}", String(zoom))
    .replaceAll("{x}", String(x))
    .replaceAll("{y}", String(y));
}
