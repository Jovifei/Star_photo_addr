"use client";

import { useEffect, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import type { PathOptions } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";

const COUNTRY_URL = "/images/perseids/data/world-country-boundaries.geojson";
const PROVINCE_URL = "/images/perseids/data/china-province-boundaries-wgs84.geojson";
const PREFECTURE_INDEX_URL =
  "/images/perseids/data/china-prefecture-boundaries.index.json";
const PREFECTURE_BASE = "/images/perseids/data/boundaries/prefectures";

const COUNTRY_STYLE: PathOptions = { color: "#d4b273", weight: 1, opacity: 0.7 };
const PROVINCE_STYLE: PathOptions = { color: "#79cfe2", weight: 1, opacity: 0.6 };
const PREFECTURE_STYLE: PathOptions = {
  color: "#b0e6ef",
  weight: 0.8,
  opacity: 0.5,
  dashArray: "3 3",
};

type GeoJsonData = Feature | FeatureCollection | Geometry;

interface PrefectureIndexEntry {
  adcode: string | number;
}

interface PrefectureIndex {
  entries?: PrefectureIndexEntry[];
}

async function loadGeoJson<T = GeoJsonData>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

/** Administrative boundaries, revealed by zoom level (country / province / prefecture). */
export default function BoundaryLayers() {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [country, setCountry] = useState<GeoJsonData | null>(null);
  const [province, setProvince] = useState<GeoJsonData | null>(null);
  const [prefecture, setPrefecture] = useState<GeoJsonData | null>(null);
  const loadedPref = useRef(false);

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  useEffect(() => {
    void loadGeoJson(COUNTRY_URL).then(setCountry);
    void loadGeoJson(PROVINCE_URL).then(setProvince);
  }, []);

  useEffect(() => {
    if (zoom < 6 || loadedPref.current) return;
    loadedPref.current = true;
    (async () => {
      const index = await loadGeoJson<PrefectureIndex>(PREFECTURE_INDEX_URL);
      const entries = index?.entries ?? [];
      const results = await Promise.all(
        entries.map(async (entry) => {
          const geo = await loadGeoJson<GeoJsonData>(
            `${PREFECTURE_BASE}/${entry.adcode}.geojson`,
          );
          return geo;
        }),
      );
      const features = results
        .filter((geo): geo is GeoJsonData => geo !== null)
        .flatMap((geo): Feature[] => {
          if (geo.type === "FeatureCollection") return geo.features;
          if (geo.type === "Feature") return [geo];
          // Bare geometry -> wrap in a minimal Feature so react-leaflet can render it.
          return [{ type: "Feature", geometry: geo, properties: {} } as Feature];
        });
      setPrefecture(
        features.length ? { type: "FeatureCollection", features } : null,
      );
    })();
  }, [zoom]);

  return (
    <>
      {country && <GeoJSON data={country} style={COUNTRY_STYLE} interactive={false} />}
      {zoom >= 4 && province && (
        <GeoJSON data={province} style={PROVINCE_STYLE} interactive={false} />
      )}
      {zoom >= 6 && prefecture && (
        <GeoJSON data={prefecture} style={PREFECTURE_STYLE} interactive={false} />
      )}
    </>
  );
}
