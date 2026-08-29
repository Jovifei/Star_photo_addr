"use client";

import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { FeatureCollection, GeoJsonObject, Geometry } from "geojson";
import { useEffect, useMemo, useState } from "react";
import {
  BASEMAP_ATTRIBUTION,
  BASEMAP_SUBDOMAINS,
  BASEMAP_TILE_CLASS_NAME,
  BASEMAP_TILE_URL,
} from "@/lib/constants";
import { evaluateFinderLocation, ratingColor } from "@/lib/stargazingFinder";
import type { FinderLocation, FinderMode, FinderWeatherRecord } from "@/lib/stargazingFinderTypes";
import { FINDER_GEOJSON_URL, FINDER_MAP_SOURCE } from "./finderData";
import styles from "./stargazing-finder.module.css";
import "leaflet/dist/leaflet.css";

const VIIRS_WMTS_URL = "https://lpm.darkmap.cn/gwc/service/wmts?layer=PostGIS:VIIR_2023&style=&tilematrixset=EPSG:900913&Service=WMTS&Request=GetTile&Version=1.0.0&Format=image/png&TileMatrix=EPSG:900913:{z}&TileCol={x}&TileRow={y}";

interface ProvinceProperties {
  name?: string;
  center?: [number, number];
  centroid?: [number, number];
}

type ProvinceCollection = FeatureCollection<Geometry, ProvinceProperties>;

interface FinderMapProps {
  locations: FinderLocation[];
  weather: Record<string, FinderWeatherRecord>;
  selectedId: string | null;
  targetDate: string;
  mode: FinderMode;
  onSelect: (location: FinderLocation) => void;
  showLabels: boolean;
  viirsEnabled: boolean;
  onViirsError: () => void;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function markerIcon(color: string, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: styles.markerIcon,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<span class="${styles.markerDot}" style="--marker-color:${color};--marker-scale:${selected ? "1.3" : "1"}"></span>`,
  });
}

function provinceIcon(name: string): L.DivIcon {
  return L.divIcon({
    className: styles.provinceLabel,
    iconSize: [70, 24],
    iconAnchor: [35, 12],
    html: `<span>${escapeHtml(name.replace(/(省|市|自治区|特别行政区|壮族自治区|回族自治区|维吾尔自治区)$/u, ""))}</span>`,
  });
}

function ViewportSync({ selectedId, locations }: { selectedId: string | null; locations: FinderLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const location = locations.find((item) => item.id === selectedId);
    if (location) map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 7), { duration: 0.45 });
  }, [locations, map, selectedId]);
  return null;
}

function ProvinceLayers({ boundaries }: { boundaries: ProvinceCollection | null }) {
  if (!boundaries) return null;
  return (
    <>
      <GeoJSON data={boundaries as GeoJsonObject} style={{ color: "#f5f9ff", weight: 2.2, opacity: 0.62, fillOpacity: 0 }} interactive={false} />
      <GeoJSON data={boundaries as GeoJsonObject} style={{ color: "#101a32", weight: 0.9, opacity: 0.92, fillOpacity: 0 }} interactive={false} />
      {boundaries.features.map((feature, index) => {
        const center = feature.properties?.center ?? feature.properties?.centroid;
        const name = feature.properties?.name;
        if (!center || !name || /香港|澳门|天津/u.test(name)) return null;
        return <Marker key={`${name}-${index}`} position={[center[1], center[0]]} icon={provinceIcon(name)} interactive={false} />;
      })}
    </>
  );
}

export default function FinderMap({ locations, weather, selectedId, targetDate, mode, onSelect, showLabels, viirsEnabled, onViirsError }: FinderMapProps) {
  const [boundaries, setBoundaries] = useState<ProvinceCollection | null>(null);
  const [viirsFailed, setViirsFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(FINDER_GEOJSON_URL, { cache: "force-cache" })
      .then((response) => response.ok ? response.json() as Promise<ProvinceCollection> : null)
      .then((data) => { if (!cancelled && data) setBoundaries(data); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const evaluations = useMemo(() => new Map(locations.map((location) => [location.id, evaluateFinderLocation(location, weather[location.id], targetDate, mode)])), [locations, mode, targetDate, weather]);
  const usingFallback = !viirsEnabled || viirsFailed;

  const onViirsTileError = () => {
    if (viirsFailed) return;
    setViirsFailed(true);
    onViirsError();
  };

  return (
    <div className={styles.mapShell}>
      <MapContainer className={styles.leafletMap} center={[36, 105]} zoom={4} minZoom={3} maxZoom={18} zoomControl={false} worldCopyJump={false} preferCanvas attributionControl>
        <TileLayer
          url={BASEMAP_TILE_URL}
          subdomains={BASEMAP_SUBDOMAINS}
          attribution={BASEMAP_ATTRIBUTION}
          className={BASEMAP_TILE_CLASS_NAME}
          opacity={usingFallback ? 0.94 : 0.56}
        />
        {viirsEnabled && !viirsFailed && <TileLayer url={VIIRS_WMTS_URL} attribution={FINDER_MAP_SOURCE} opacity={0.98} maxZoom={18} eventHandlers={{ tileerror: onViirsTileError }} />}
        <ProvinceLayers boundaries={boundaries} />
        <ViewportSync selectedId={selectedId} locations={locations} />
        <ZoomControl position="bottomright" />
        {locations.map((location) => {
          const evaluation = evaluations.get(location.id);
          const rating = evaluation?.rating ?? "unknown";
          const color = ratingColor(rating);
          const selected = location.id === selectedId;
          return (
            <Marker
              key={location.id}
              position={[location.latitude, location.longitude]}
              icon={markerIcon(color, selected)}
              eventHandlers={{ click: () => onSelect(location) }}
              title={location.name}
            >
              {showLabels && <Tooltip permanent direction="top" offset={[0, -9]} opacity={0.96}>
                <span className={styles.markerLabel}><strong>{location.name}</strong></span>
              </Tooltip>}
            </Marker>
          );
        })}
      </MapContainer>
      <div className={styles.mapModeBadge}>
        <span className={styles.livePulse} aria-hidden="true" />
        {viirsEnabled && !viirsFailed ? "VIIRS 2023 光污染底图" : "暗色基础地图"}
      </div>
      <div className={styles.mapAttributionNote}>{viirsEnabled && !viirsFailed ? FINDER_MAP_SOURCE : "暗色基础地图 · VIIRS 不可用或已关闭"}</div>
      <div className={styles.mapHint}><span>点击地点标记</span>查看详情 · 地图可拖动缩放</div>
    </div>
  );
}
