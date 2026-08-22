import { useEffect, useMemo, useRef, useState } from "react";
import {
  Crosshair,
  Info,
  Search as MagnifyingGlass,
  MapPin,
  MoonStar as MoonStars,
  Navigation as NavigationArrow,
  Plus,
  TriangleAlert as Warning,
} from "lucide-react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import ChineseLabelLayer from "@/components/ChineseLabelLayer";
import { searchChinaPlaces } from "../lib/geocoding";
import { fetchSurfaceForecasts } from "../lib/openMeteo";
import { evaluateNight, statusMeta } from "../lib/scoring";
import { formatNightLabel } from "../lib/time";

const DEFAULT_CENTER = [29.7, 120.1];

function MapClick({ onPick }) {
  useMapEvents({
    click(event) {
      const latitude = Number(event.latlng.lat.toFixed(5));
      const longitude = Number(event.latlng.lng.toFixed(5));
      onPick({
        id: `map-${latitude}-${longitude}`,
        name: `地图选点 ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`,
        latitude,
        longitude,
        elevation: null,
        timezone: "Asia/Shanghai",
        source: "地图点击",
      });
    },
  });
  return null;
}

function FlyToSelection({ location }) {
  const map = useMap();
  useEffect(() => {
    if (location) map.flyTo([location.latitude, location.longitude], Math.max(map.getZoom(), 9), { duration: 0.7 });
  }, [location, map]);
  return null;
}

function weatherSummary(evaluation) {
  const hour = evaluation?.window?.[0] ?? evaluation?.hours?.slice().sort((a, b) => b.score - a.score)[0];
  return {
    cloud: Number.isFinite(hour?.cloudCover) ? `${Math.round(hour.cloudCover)}%` : "—",
    rain: Number.isFinite(hour?.precipitationProbability) ? `${Math.round(hour.precipitationProbability)}%` : "—",
    wind: Number.isFinite(hour?.windGust) ? `${Math.round(hour.windGust)} m/s` : "—",
    temperature: Number.isFinite(hour?.temperature) ? `${Math.round(hour.temperature)}°` : "—",
  };
}

export function ObservationMap({ locations, forecasts, days, nightKeys, selectedNight, onSelectNight, onSave }) {
  const [selected, setSelected] = useState(locations[0] ?? null);
  const [candidateForecast, setCandidateForecast] = useState(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [forecastLoading, setForecastLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saveState, setSaveState] = useState("");
  const searchAbort = useRef(null);

  const existingForecast = forecasts.find((item) => item.locationId === selected?.id);
  const activeForecast = existingForecast ?? candidateForecast;
  const evaluation = useMemo(() => {
    if (!activeForecast || !selected) return null;
    return evaluateNight(activeForecast, selected, selectedNight, nightKeys.indexOf(selectedNight));
  }, [activeForecast, selected, selectedNight, nightKeys]);
  const meta = statusMeta(evaluation?.status);
  const summary = weatherSummary(evaluation);
  const selectedIsExisting = locations.some((item) => item.id === selected?.id);
  const selectedIsSaved = locations.some((item) => (
    item.id === selected?.id
    || (selected
      && Math.abs(item.latitude - selected.latitude) < 0.00001
      && Math.abs(item.longitude - selected.longitude) < 0.00001)
  ));
  const selectedId = selected?.id;
  const selectedLatitude = selected?.latitude;
  const selectedLongitude = selected?.longitude;
  const selectedElevation = selected?.elevation;
  const selectedTimezone = selected?.timezone;
  const selectedSource = selected?.source;

  useEffect(() => {
    if (!selectedId || !Number.isFinite(selectedLatitude) || !Number.isFinite(selectedLongitude) || existingForecast) return undefined;
    const requestLocation = {
      id: selectedId,
      name: "地图候选点",
      latitude: selectedLatitude,
      longitude: selectedLongitude,
      elevation: selectedElevation,
      timezone: selectedTimezone,
      source: selectedSource,
    };
    const controller = new AbortController();
    queueMicrotask(() => {
      setForecastLoading(true);
      setForecastError("");
    });
    fetchSurfaceForecasts([requestLocation], 14, controller.signal)
      .then(([forecast]) => setCandidateForecast(forecast))
      .catch((error) => {
        if (error.name !== "AbortError") setForecastError("该坐标的天气暂时不可用，请稍后重试。");
      })
      .finally(() => setForecastLoading(false));
    return () => controller.abort();
  }, [selectedId, selectedLatitude, selectedLongitude, selectedElevation, selectedTimezone, selectedSource, existingForecast]);

  function selectCandidate(candidate) {
    setSelected(candidate);
    setSaveState("");
  }

  async function runSearch(event) {
    event.preventDefault();
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    setSearching(true);
    setSearchError("");
    try {
      const matches = await searchChinaPlaces(query, controller.signal);
      setResults(matches);
      if (!matches.length) setSearchError("没有找到中国大陆境内的匹配地点。");
    } catch (error) {
      if (error.name !== "AbortError") setSearchError("地点搜索暂时不可用，可直接点击地图取点。");
    } finally {
      setSearching(false);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) {
      setSearchError("当前浏览器不支持定位，可改用搜索或地图点击。");
      return;
    }
    setLocating(true);
    setSearchError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(5));
        const longitude = Number(position.coords.longitude.toFixed(5));
        selectCandidate({
          id: `gps-${latitude}-${longitude}`,
          name: "我的当前位置",
          latitude,
          longitude,
          elevation: Number.isFinite(position.coords.altitude) ? Math.round(position.coords.altitude) : null,
          timezone: "Asia/Shanghai",
          source: "浏览器定位",
        });
        setLocating(false);
      },
      () => {
        setSearchError("未获得定位权限。你仍可搜索地点或点击地图。");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }

  function saveSelected() {
    const name = selected?.name?.trim();
    if (!selected || !activeForecast || !name || selectedIsSaved) return;
    onSave({
      ...selected,
      name,
      elevation: Number.isFinite(selected.elevation) ? selected.elevation : Math.round(activeForecast.modelElevation),
      source: selected.source === "地图点击" ? "地图选点 · 模型海拔" : selected.source,
    });
    setSaveState("已保存到本机点位；刷新后会加入全局排名。");
  }

  return (
    <section className="map-workspace" aria-label="地图选点">
      <div className="map-toolbar">
        <div>
          <span className="section-kicker">地图观测台</span>
          <h2>在地图上寻找观测机位</h2>
          <p>搜索中国境内地点，或直接点击地图取点；选中后立即计算 7/14 天星空建议。</p>
        </div>
        <div className="event-chip"><MoonStars strokeWidth={2.4} /><span><strong>最新天文事件</strong>事件信息以首页左上角已核验列表为准。</span></div>
      </div>

      <div className="map-layout">
        <div className="map-stage">
          <form className="map-search" onSubmit={runSearch}>
            <MagnifyingGlass />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索城市、山峰或区县" aria-label="搜索地点" />
            <button type="submit" disabled={searching || query.trim().length < 2}>{searching ? "搜索中" : "搜索"}</button>
            <button className="locate-button" type="button" onClick={locateMe} disabled={locating} aria-label="使用当前位置"><Crosshair />{locating ? "定位中" : "定位"}</button>
          </form>
          {(results.length > 0 || searchError) && (
            <div className="search-popover" aria-label="地点搜索结果">
              {searchError && <p className="search-message" role="status" aria-live="polite"><Warning />{searchError}</p>}
              {results.map((result) => (
                <button key={result.id} type="button" onClick={() => { selectCandidate(result); setResults([]); setQuery(result.name); }}>
                  <MapPin /><span><strong>{result.name}</strong><small>{result.context || `${result.latitude.toFixed(3)}, ${result.longitude.toFixed(3)}`}</small></span>
                </button>
              ))}
            </div>
          )}
          <MapContainer center={DEFAULT_CENTER} zoom={7} minZoom={3} className="observation-map" aria-label="观测点位地图" zoomControl>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            />
            <ChineseLabelLayer />
            <MapClick onPick={selectCandidate} />
            <FlyToSelection location={selected} />
            {locations.map((location) => (
              <CircleMarker
                key={location.id}
                center={[location.latitude, location.longitude]}
                radius={selected?.id === location.id ? 9 : 6}
                pathOptions={{ color: selected?.id === location.id ? "#ffffff" : "#45d8ea", fillColor: "#45d8ea", fillOpacity: 0.85, weight: 2 }}
                eventHandlers={{ click: () => selectCandidate(location) }}
              ><Tooltip>{location.name} · {location.elevation == null ? "海拔待核" : `${Math.round(location.elevation)} m`}</Tooltip></CircleMarker>
            ))}
            {selected && !locations.some((location) => location.id === selected.id) && (
              <CircleMarker center={[selected.latitude, selected.longitude]} radius={10} pathOptions={{ color: "#ffffff", fillColor: "#9b8cf9", fillOpacity: 0.95, weight: 3 }}>
                <Tooltip permanent direction="top">{selected.name}</Tooltip>
              </CircleMarker>
            )}
          </MapContainer>
          <div className="map-hint"><NavigationArrow strokeWidth={2.4} />点击地图任意位置开始评估</div>
        </div>

        <aside className="map-inspector" aria-label="观测点位评估">
          <div className="map-site-picker">
            <span className="picker-label">已保存点位 · 可用键盘快速选择</span>
            <div className="map-site-quicklist" aria-label="已保存点位快速选择">
              {locations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  aria-pressed={selected?.id === location.id}
                  className={selected?.id === location.id ? "active" : ""}
                  onClick={() => selectCandidate(location)}
                >
                  <span>{location.name}</span><small>{location.elevation == null ? "海拔待核" : `${Math.round(location.elevation)} m`}</small>
                </button>
              ))}
            </div>
          </div>
          <div className="inspector-heading">
            <div>
              <span className="section-kicker">已选观测地点</span>
              {selected && !selectedIsExisting ? (
                <input
                  className="inspector-name-input"
                  aria-label="点位名称"
                  value={selected.name}
                  maxLength={40}
                  onChange={(event) => setSelected((current) => ({ ...current, name: event.target.value }))}
                />
              ) : <h3>{selected?.name ?? "选择一个地点"}</h3>}
            </div>
            <span className={`status-pill ${meta.tone}`} role="status" aria-live="polite">{forecastLoading ? "计算中" : meta.label}</span>
          </div>
          {selected && <p className="inspector-coordinate"><MapPin />{selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)} · {Number.isFinite(selected.elevation) ? `${Math.round(selected.elevation)} m` : activeForecast ? `模型地形 ${Math.round(activeForecast.modelElevation)} m` : "海拔读取中"}</p>}

          <div className="map-night-rail" aria-label={`未来 ${days} 个观测夜`}>
            {nightKeys.map((night, index) => {
              const value = activeForecast && selected ? evaluateNight(activeForecast, selected, night, index) : null;
              return <button key={night} type="button" aria-pressed={selectedNight === night} className={selectedNight === night ? "active" : ""} onClick={() => onSelectNight(night)}><span>{formatNightLabel(night, true)}</span><strong>{value?.score ?? "—"}</strong><small>{index >= 7 ? "趋势" : statusMeta(value?.status).label}</small></button>;
            })}
          </div>

          {forecastError && <p className="map-error" role="status" aria-live="polite"><Warning />{forecastError}</p>}
          <div className="map-score-row">
            <div><span>天气/天文分</span><strong>{evaluation?.score ?? "—"}</strong></div>
            <div><span>连续窗口</span><strong>{evaluation?.windowLabel ?? "—"}</strong></div>
          </div>
          <div className="map-weather-grid">
            <div><span>总云量</span><strong>{summary.cloud}</strong></div>
            <div><span>降水概率</span><strong>{summary.rain}</strong></div>
            <div><span>阵风</span><strong>{summary.wind}</strong></div>
            <div><span>气温</span><strong>{summary.temperature}</strong></div>
          </div>
          <p className="map-reason">{evaluation?.reason ?? (forecastLoading ? "正在读取逐小时天气与天文条件…" : "选择地点后显示判断依据。")}</p>

          <div className="layer-boundary"><Info /><p><strong>光污染数据尚未接入</strong>当前底图仅用于选点，不展示 Bortle/SQM；上方分数不含光污染，不能单独作为机位结论。后续必须接入有版本、许可和更新时间的可信图层后才能参与排名。</p></div>
          <button className="primary-button wide" type="button" onClick={saveSelected} disabled={!selected || !activeForecast || !selected.name.trim() || selectedIsSaved}><Plus />{selectedIsSaved ? "已在点位列表" : "保存为我的点位"}</button>
          {saveState && <p className="save-state" role="status" aria-live="polite">{saveState}</p>}
        </aside>
      </div>
    </section>
  );
}
