"use client";

import { useMemo, useState } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { Coordinate } from "@/lib/nearbyDirectorySites";

interface DirectorySite extends Coordinate { id: string; name: string }

export default function TopicMapSearch<T extends DirectorySite>({
  sites,
  onSite,
  onCoordinate,
}: {
  sites: readonly T[];
  onSite: (site: T) => void;
  onCoordinate: (point: Coordinate) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => query.trim()
    ? sites.filter((site) => site.name.includes(query.trim())).slice(0, 5)
    : [], [query, sites]);
  const { loading, error, locate } = useGeolocation((latitude, longitude) =>
    onCoordinate({ latitude, longitude }),
  );

  const pick = (site: T) => {
    setQuery(site.name);
    setOpen(false);
    onSite(site);
  };
  return <div className="topic-map-search">
    <div className="topic-map-search-field">
      <input type="search" value={query} aria-label="搜索目录摄影点位" placeholder="搜索目录摄影点位"
        autoComplete="off" onFocus={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
          if (event.key === "Enter" && matches[0]) { event.preventDefault(); pick(matches[0]); }
        }} />
      {open && matches.length ? <div className="topic-map-search-results" role="listbox" aria-label="目录点位搜索结果">
        {matches.map((site) => <button key={site.id} type="button" role="option" aria-selected={false}
          onMouseDown={(event) => event.preventDefault()} onClick={() => pick(site)}>{site.name}</button>)}
      </div> : null}
    </div>
    <button type="button" className="topic-map-locate" aria-label="在地图定位我的位置" disabled={loading} onClick={locate}>
      {loading ? "定位中" : "定位"}
    </button>
    {error ? <p className="topic-map-search-error" role="status">{error}</p> : null}
  </div>;
}
