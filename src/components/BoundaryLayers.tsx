"use client";

import { useEffect, useRef, useState } from "react";
import { GeoJSON, useMap } from "react-leaflet";
import type { PathOptions } from "leaflet";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { hasAsset } from "@/lib/assets";

const COUNTRY_URL = "/images/perseids/data/world-country-boundaries.geojson";
const PROVINCE_URL = "/images/perseids/data/china-province-boundaries-wgs84.geojson";
const PREFECTURE_INDEX_URL =
  "/images/perseids/data/china-prefecture-boundaries.index.json";
const PREFECTURE_BASE = "/images/perseids/data/boundaries/prefectures";

/** Prefecture files are fetched in small waves rather than 300+ at once. */
const PREFECTURE_BATCH_SIZE = 8;
/** Abort the whole prefecture load once this many files are missing. */
const PREFECTURE_FAILURE_BUDGET = 3;

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
  minimumZoom?: number;
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

function toFeatures(geo: GeoJsonData): Feature[] {
  if (geo.type === "FeatureCollection") return geo.features;
  if (geo.type === "Feature") return [geo];
  // Bare geometry -> wrap in a minimal Feature so react-leaflet can render it.
  return [{ type: "Feature", geometry: geo, properties: {} } as Feature];
}

/**
 * Administrative boundaries, revealed by zoom level (country / province / prefecture).
 *
 * DEGRADATION: the boundary GeoJSON bundle is not distributed with this
 * repository — its provenance (Aliyun DataV, GCJ-02 derived) carries no 审图号,
 * and re-drawing Chinese national/provincial borders from unverified data is a
 * mapping-compliance risk. The layer therefore issues no requests unless the
 * operator installs a vetted bundle and opts in.
 *
 * Even when enabled the loader is defensive: prefecture files are fetched in
 * bounded waves and the whole pass is abandoned after a few misses, so a
 * partial bundle cannot turn into a 404 storm.
 */
export default function BoundaryLayers() {
  const enabled = hasAsset("boundaries");
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [country, setCountry] = useState<GeoJsonData | null>(null);
  const [province, setProvince] = useState<GeoJsonData | null>(null);
  const [prefecture, setPrefecture] = useState<GeoJsonData | null>(null);
  const prefectureRequested = useRef(false);

  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on("zoomend", onZoom);
    return () => {
      map.off("zoomend", onZoom);
    };
  }, [map]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void loadGeoJson(COUNTRY_URL).then((data) => {
      if (!cancelled) setCountry(data);
    });
    void loadGeoJson(PROVINCE_URL).then((data) => {
      if (!cancelled) setProvince(data);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || zoom < 6 || prefectureRequested.current) return;
    prefectureRequested.current = true;

    let cancelled = false;
    (async () => {
      const index = await loadGeoJson<PrefectureIndex>(PREFECTURE_INDEX_URL);
      const entries = index?.entries ?? [];
      if (cancelled || entries.length === 0) return;

      const features: Feature[] = [];
      let failures = 0;

      for (let i = 0; i < entries.length; i += PREFECTURE_BATCH_SIZE) {
        if (cancelled || failures >= PREFECTURE_FAILURE_BUDGET) break;
        const batch = entries.slice(i, i + PREFECTURE_BATCH_SIZE);
        const loaded = await Promise.all(
          batch.map((entry) =>
            loadGeoJson<GeoJsonData>(`${PREFECTURE_BASE}/${entry.adcode}.geojson`),
          ),
        );
        for (const geo of loaded) {
          if (geo === null) {
            failures += 1;
            continue;
          }
          features.push(...toFeatures(geo));
        }
      }

      if (cancelled) return;
      setPrefecture(
        features.length ? { type: "FeatureCollection", features } : null,
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, zoom]);

  if (!enabled) return null;

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
