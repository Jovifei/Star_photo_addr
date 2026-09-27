export interface Coordinate { latitude: number; longitude: number }

/** Directory proximity only: a map tap never synthesizes a forecast score. */
export function nearbyDirectorySites<T extends Coordinate>(
  point: Coordinate,
  sites: readonly T[],
  limit = 5,
): Array<{ site: T; distanceKm: number }> {
  const rad = Math.PI / 180;
  return sites.map((site) => {
    const dLat = (site.latitude - point.latitude) * rad;
    const dLon = (site.longitude - point.longitude) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(point.latitude * rad) * Math.cos(site.latitude * rad) * Math.sin(dLon / 2) ** 2;
    return { site, distanceKm: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
  }).sort((left, right) => left.distanceKm - right.distanceKm).slice(0, limit);
}
