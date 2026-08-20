export const DEFAULT_LIGHT_POLLUTION_TILE_URL =
  "https://lpm.darkmap.cn/gwc/service/wmts?layer=PostGIS:VIIR_2023&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:{z}&TileCol={x}&TileRow={y}";

export const DEFAULT_LIGHT_POLLUTION_ATTRIBUTION =
  "光污染参考 © darkmap.cn · VIIRS 2023";

const configuredTileUrl =
  process.env.NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL?.trim() ?? "";
const configuredAttribution =
  process.env.NEXT_PUBLIC_LIGHT_POLLUTION_ATTRIBUTION?.trim() ?? "";

/**
 * Visual VIIRS 2023 reference raster. This is a third-party tile service and
 * must not be presented as a live Bortle/SQM measurement. Aliyun deployments
 * can replace it at build time with a licensed/self-hosted WMTS template.
 */
export const LIGHT_POLLUTION_TILE_URL =
  configuredTileUrl || DEFAULT_LIGHT_POLLUTION_TILE_URL;

/**
 * Never credit the default provider after a custom URL is configured. When an
 * operator omits a label, use a neutral fallback rather than false attribution.
 */
export function resolveLightPollutionAttribution(
  tileUrl: string,
  attribution: string,
): string {
  const configuredUrl = tileUrl.trim();
  const configuredLabel = attribution
    .replace(/<[^>]*>/g, "")
    .replace(/\p{C}/gu, " ")
    .trim()
    .slice(0, 180);
  if (configuredLabel) return configuredLabel;
  return configuredUrl
    ? "自定义光污染参考图层"
    : DEFAULT_LIGHT_POLLUTION_ATTRIBUTION;
}

export const LIGHT_POLLUTION_ATTRIBUTION =
  resolveLightPollutionAttribution(
    configuredTileUrl,
    configuredAttribution,
  );

/**
 * Materialize a browser tile template for the server-side probe. Leaflet
 * understands `{s}`, `{r}` and `{-y}` in addition to z/x/y; leaving any of
 * those literal made a valid custom template fail `/api/data-status` even
 * though the browser could render it.
 */
export function materializeLightPollutionTile(
  template: string,
  zoom = 4,
  x = 12,
  y = 6,
): string {
  const invertedY = Math.max(0, 2 ** zoom - y - 1);
  return template
    .replaceAll("{z}", String(zoom))
    .replaceAll("{x}", String(x))
    .replaceAll("{-y}", String(invertedY))
    .replaceAll("{y}", String(y))
    .replaceAll("{s}", "a")
    .replaceAll("{r}", "");
}

function isLocalDevelopmentHost(hostname: string): boolean {
  const value = hostname.toLowerCase();
  return (
    value === "localhost" ||
    value.endsWith(".localhost") ||
    value === "127.0.0.1" ||
    value === "::1"
  );
}

/**
 * Validate the public Leaflet/WMTS template before either the browser or the
 * server-side health probe tries to use it. A malformed build-time value used
 * to produce a page that looked healthy while every tile request was invalid.
 */
export function lightPollutionTemplateError(template: string): string | null {
  const value = template.trim();
  if (!value) return "瓦片模板为空";
  if (/\p{C}/u.test(value)) return "瓦片模板包含控制字符";

  const missing: string[] = [];
  if (!value.includes("{z}")) missing.push("{z}");
  if (!value.includes("{x}")) missing.push("{x}");
  if (!value.includes("{y}") && !value.includes("{-y}")) {
    missing.push("{y} 或 {-y}");
  }
  if (missing.length) {
    return `瓦片模板缺少 ${missing.join("、")} 占位符`;
  }

  const concrete = materializeLightPollutionTile(value, 4, 12, 6);
  if (/\{[^}]+\}/.test(concrete)) {
    return "瓦片模板包含不支持的占位符";
  }

  try {
    const url = new URL(concrete);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "瓦片模板必须使用 HTTP 或 HTTPS";
    }
    if (url.protocol === "http:" && !isLocalDevelopmentHost(url.hostname)) {
      return "公网瓦片模板必须使用 HTTPS，避免浏览器混合内容拦截";
    }
    if (url.username || url.password) {
      return "瓦片模板不能在 URL 中携带账号或密码";
    }
  } catch {
    return "瓦片模板不是合法 URL";
  }
  return null;
}
