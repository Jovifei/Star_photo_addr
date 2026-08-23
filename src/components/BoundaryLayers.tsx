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

const PREFECTURE_BATCH_SIZE = 8;
const PREFECTURE_FAILURE_BUDGET = 3;

/* Hierarchy is expressed by weight, opacity and dash rhythm rather than color alone. */
const COUNTRY_STYLE: PathOptions = {
  color: "#e1c58a",
  weight: 1.45,
  opacity: 0.82,
  dashArray: "7 5",
  lineCap: "round",
};
const PROVINCE_STYLE: PathOptions = {
  color: "#83d3e5",
  weight: 1.15,
  opacity: 0.7,
  dashArray: "5 4",
  lineCap: "round",
};
const PREFECTURE_STYLE: PathOptions = {
  color: "#b0e6ef",
  weight: 0.85,
  opacity: 0.52,
  dashArray: "2 4",
  lineCap: "round",
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

/**
 * Remote province fallback (Aliyun DataV GeoAtlas): the licensed local bundle
 * is opt-in and often absent, and a boundary-less China map is unreadable.
 * Same third-party pattern as the VIIRS WMTS source — fetched at runtime,
 * never redistributed, cached per browser session.
 */
const REMOTE_PROVINCE_URL = "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json";
const REMOTE_PROVINCE_ATTRIBUTION = "省界 © 阿里云 DataV GeoAtlas";
let remoteProvinceCache: Promise<GeoJsonData | null> | null = null;

function loadRemoteProvinces(): Promise<GeoJsonData | null> {
  if (!remoteProvinceCache) {
    remoteProvinceCache = loadGeoJson(REMOTE_PROVINCE_URL);
    remoteProvinceCache.catch(() => {
      // Allow a retry on the next mount after a transient failure.
      remoteProvinceCache = null;
    });
  }
  return remoteProvinceCache;
}

function toFeatures(geo: GeoJsonData): Feature[] {
  if (geo.type === "FeatureCollection") return geo.features;
  if (geo.type === "Feature") return [geo];
  return [{ type: "Feature", geometry: geo, properties: {} } as Feature];
}

/**
 * Administrative boundaries, revealed by zoom level (country / province / prefecture).
 *
 * The GeoJSON bundle remains opt-in because national/provincial geometry must
 * come from a vetted, redistributable source. With a valid local package the
 * map shows country outlines at overview zoom, provinces from zoom 4 and
 * prefectures from zoom 6. Missing files fail closed without a request storm.
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

  // No local bundle: fall back to the remote province source so every map
  // still renders 省界 (see REMOTE_PROVINCE_URL note).
  useEffect(() => {
    if (enabled) return;
    let cancelled = false;
    void loadRemoteProvinces().then((data) => {
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

  if (!enabled) {
    return zoom >= 4 && province ? (
      <GeoJSON
        data={province}
        style={PROVINCE_STYLE}
        interactive={false}
        attribution={REMOTE_PROVINCE_ATTRIBUTION}
      />
    ) : null;
  }

  return (
    <>
      {country && (
        <GeoJSON data={country} style={COUNTRY_STYLE} interactive={false} />
      )}
      {zoom >= 4 && province && (
        <GeoJSON data={province} style={PROVINCE_STYLE} interactive={false} />
      )}
      {zoom >= 6 && prefecture && (
        <GeoJSON data={prefecture} style={PREFECTURE_STYLE} interactive={false} />
      )}
    </>
  );
}
