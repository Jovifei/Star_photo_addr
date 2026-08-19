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
