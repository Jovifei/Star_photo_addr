import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowsClockwise,
  Binoculars,
  CalendarBlank,
  CaretRight,
  ChartLineUp,
  CheckCircle,
  Cloud,
  CloudRain,
  Compass,
  Drop,
  Info,
  ListBullets,
  MapPin,
  Moon,
  Mountains,
  Plus,
  Sparkle,
  Warning,
  Wind,
  X,
} from "@phosphor-icons/react";
import ReactECharts from "echarts-for-react";
import { PRESET_LOCATIONS, createLocation } from "./data/locations";
import { deriveCloudLayers } from "./lib/clouds";
import { readCustomLocations, readForecastCache, writeCustomLocations, writeForecastCache } from "./lib/cache";
import { fetchPressureForecast, fetchSurfaceForecasts } from "./lib/openMeteo";
import { evaluateNight, statusMeta } from "./lib/scoring";
import { formatHour, formatNightLabel, nextNightKeys, relativeFreshness } from "./lib/time";

const NAV_ITEMS = [
  { id: "dashboard", label: "今晚", icon: Binoculars },
  { id: "matrix", label: "对比", icon: ChartLineUp },
  { id: "locations", label: "点位", icon: MapPin },
];

function rankValue(item, mode) {
  return mode === "cloud" ? item.evaluation?.cloudSeaPotential ?? -1 : item.evaluation?.score ?? -1;
}

export function App() {
  const [customLocations, setCustomLocations] = useState(() => readCustomLocations());
  const locations = useMemo(() => [...PRESET_LOCATIONS, ...customLocations], [customLocations]);
  const [days, setDays] = useState(7);
  const [mode, setMode] = useState("star");
  const [view, setView] = useState("dashboard");
  const [selectedNight, setSelectedNight] = useState(() => nextNightKeys(14)[0]);
  const [selectedLocationId, setSelectedLocationId] = useState(null);
  const [forecasts, setForecasts] = useState(() => readForecastCache()?.forecasts ?? []);
  const [savedAt, setSavedAt] = useState(() => readForecastCache()?.savedAt ?? null);
  const [stale, setStale] = useState(() => readForecastCache()?.stale ?? false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const nightKeys = useMemo(() => nextNightKeys(days), [days]);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError("");
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 25000);
      try {
        const data = await fetchSurfaceForecasts(locations, 14, controller.signal);
        const cache = writeForecastCache(data);
        setForecasts(data);
        setSavedAt(cache.savedAt);
        setStale(false);
      } catch (requestError) {
        setError(requestError.name === "AbortError" ? "天气数据请求超时，已保留上一次成功数据。" : `${requestError.message}，已保留上一次成功数据。`);
        if (forecasts.length) setStale(true);
      } finally {
        window.clearTimeout(timeout);
        setLoading(false);
      }
    },
    [locations, forecasts.length],
  );

  useEffect(() => {
    if (!forecasts.length || stale) refresh(true);
  }, []); // initial cache-first load

  useEffect(() => {
    if (!nightKeys.includes(selectedNight)) setSelectedNight(nightKeys[0]);
  }, [nightKeys, selectedNight]);

  // 切换顶部/底部导航（今晚·对比·点位）时自动回到页面顶部，避免跳转后停留在上次滚动位置
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view]);

  // 打开详情抽屉时锁定背景滚动，并支持 Esc 键关闭，让点击跳转的落点更明确
  useEffect(() => {
    if (!selectedLocationId) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSelectedLocationId(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedLocationId]);

  const rankings = useMemo(() => {
    return locations
      .map((location) => {
        const forecast = forecasts.find((item) => item.locationId === location.id);
        const leadIndex = nextNightKeys(14).indexOf(selectedNight);
        return { location, forecast, evaluation: forecast ? evaluateNight(forecast, location, selectedNight, leadIndex) : null };
      })
      .sort((a, b) => rankValue(b, mode) - rankValue(a, mode));
  }, [locations, forecasts, selectedNight, mode]);

  const best = rankings[0];
  const detail = selectedLocationId ? rankings.find((item) => item.location.id === selectedLocationId) : null;

  function addLocation(form) {
    const next = [...customLocations, createLocation(form)];
    setCustomLocations(next);
    writeCustomLocations(next);
    setError("新点位已保存到本机；点击刷新获取天气数据。");
  }

  function removeCustomLocation(id) {
    const next = customLocations.filter((item) => item.id !== id);
    setCustomLocations(next);
    writeCustomLocations(next);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark"><Sparkle weight="fill" /></span>
          <div>
            <p className="eyebrow">ASTRO WEATHER</p>
            <h1>星野决策</h1>
          </div>
        </div>
        <nav className="desktop-nav" aria-label="主导航">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
          ))}
        </nav>
        <button className="refresh-button" type="button" onClick={() => refresh()} disabled={loading}>
          <ArrowsClockwise className={loading ? "spin" : ""} />
          <span>{loading ? "更新中" : "刷新"}</span>
        </button>
      </header>

      <main className="main-content">
        <section className="control-strip" aria-label="预测范围与摄影模式">
          <div className="segmented" aria-label="预测天数">
            {[7, 14].map((value) => (
              <button key={value} className={days === value ? "active" : ""} onClick={() => setDays(value)}>{value} 天</button>
            ))}
          </div>
          <div className="segmented mode-switch" aria-label="摄影模式">
            <button className={mode === "star" ? "active" : ""} onClick={() => setMode("star")}><Moon />星空</button>
            <button className={mode === "cloud" ? "active" : ""} onClick={() => setMode("cloud")}><Mountains />云海</button>
          </div>
          <div className={`freshness ${stale ? "stale" : ""}`}>
            <span className="freshness-dot" />{relativeFreshness(savedAt)}{stale ? " · 已过期" : ""}
          </div>
        </section>

        {error && <StatusBanner message={error} stale={stale} />}
        {!forecasts.length && loading ? <LoadingState /> : null}
        {!forecasts.length && !loading ? <EmptyState onRefresh={() => refresh()} /> : null}

        {forecasts.length > 0 && view === "dashboard" && (
          <Dashboard
            best={best}
            rankings={rankings}
            nightKeys={nightKeys}
            selectedNight={selectedNight}
            onSelectNight={setSelectedNight}
            mode={mode}
            onOpenDetail={setSelectedLocationId}
          />
        )}
        {forecasts.length > 0 && view === "matrix" && (
          <MatrixView
            locations={locations}
            forecasts={forecasts}
            nightKeys={nightKeys}
            mode={mode}
            onSelect={(locationId, night) => {
              setSelectedNight(night);
              setSelectedLocationId(locationId);
            }}
          />
        )}
        {view === "locations" && (
          <LocationsView locations={locations} customLocations={customLocations} onAdd={addLocation} onRemove={removeCustomLocation} />
        )}
      </main>

      <footer className="site-footer">
        <span>天气数据：<a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a></span>
        <span>天文计算：Astronomy Engine</span>
        <span>预测用于摄影规划，不替代现场安全判断</span>
      </footer>

      <nav className="mobile-nav" aria-label="移动导航">
        {NAV_ITEMS.map((item) => <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />)}
      </nav>

      {detail && <DetailDrawer item={detail} nightKey={selectedNight} onClose={() => setSelectedLocationId(null)} />}
    </div>
  );
}

function NavButton({ item, active, onClick }) {
  const Icon = item.icon;
  return <button className={active ? "active" : ""} onClick={onClick}><Icon weight={active ? "fill" : "regular"} /><span>{item.label}</span></button>;
}

function StatusBanner({ message, stale }) {
  return <div className={`status-banner ${stale ? "warning" : "info"}`}><Warning weight="fill" /><span>{message}</span></div>;
}

function LoadingState() {
  return <section className="loading-state"><div className="loader" /><h2>正在读取 12 个山顶的天气</h2><p>首次加载会计算 14 天云量、降水和天文窗口。</p></section>;
}

function EmptyState({ onRefresh }) {
  return <section className="empty-state"><Cloud size={36} /><h2>还没有天气数据</h2><p>连接网络后刷新，页面会保留最近一次成功数据。</p><button className="primary-button" onClick={onRefresh}>立即刷新</button></section>;
}

function Dashboard({ best, rankings, nightKeys, selectedNight, onSelectNight, mode, onOpenDetail }) {
  const evaluation = best?.evaluation;
  const meta = statusMeta(evaluation?.status);
  return (
    <>
      <section className="hero-grid">
        <article className="hero-card">
          <div className="hero-header">
            <span className="section-kicker">{formatNightLabel(selectedNight)} · {mode === "star" ? "星空最佳" : "云海潜力"}</span>
            <span className={`status-pill ${meta.tone}`}>{meta.label}</span>
          </div>
          <div className="hero-location">
            <div>
              <p className="hero-overline">综合最优机位</p>
              <h2>{best?.location.name ?? "计算中"}</h2>
              <p className="coordinate"><MapPin />{best?.location.elevation} m · {best?.location.latitude.toFixed(4)}, {best?.location.longitude.toFixed(4)}</p>
            </div>
            <ScoreRing value={mode === "cloud" ? evaluation?.cloudSeaPotential : evaluation?.score} label={mode === "cloud" ? "云海指数" : "星空分"} />
          </div>
          <div className="window-callout">
            <div className="window-icon"><Binoculars /></div>
            <div><span>最佳连续窗口</span><strong>{evaluation?.windowLabel ?? "暂无数据"}</strong></div>
          </div>
          <p className="hero-reason">{evaluation?.reason}</p>
          <div className="hero-metrics">
            <Metric icon={Moon} label="月面照度" value={`${Math.round((evaluation?.moonIllumination ?? 0) * 100)}%`} />
            <Metric icon={Sparkle} label="暗夜时长" value={`${evaluation?.darkHours ?? 0}h`} />
            <Metric icon={Compass} label="银河最高" value={`${evaluation?.galacticMax ?? 0}°`} />
            <Metric icon={Info} label="置信度" value={evaluation?.confidence.level ?? "—"} />
          </div>
          <button className="detail-cta" onClick={() => best && onOpenDetail(best.location.id)}>查看逐小时详情<CaretRight /></button>
        </article>

        <article className="briefing-card">
          <div className="card-heading"><div><span className="section-kicker">DECISION BRIEF</span><h3>今晚判断依据</h3></div><ListBullets /></div>
          <DecisionItem tone={evaluation?.status === "go" ? "good" : "warn"} title={evaluation?.window.length >= 2 ? "连续窗口成立" : "连续窗口不足"} text={evaluation?.windowLabel} />
          <DecisionItem tone={(evaluation?.blockers.length ?? 0) ? "bad" : "good"} title={(evaluation?.blockers.length ?? 0) ? "存在天气门禁" : "无主要安全门禁"} text={evaluation?.blockers.join("、") || "未触发雷暴、强降水、低能见度或大阵风门禁"} />
          <DecisionItem tone={evaluation?.confidence.kind === "trend" ? "warn" : "info"} title={`置信度：${evaluation?.confidence.level ?? "—"}`} text={evaluation?.confidence.reason ?? "等待数据"} />
          <p className="brief-note"><Info />14 天用于看趋势；最终出发前请在 72 小时内再次刷新，并核对道路和现场云况。</p>
        </article>
      </section>

      <NightRail nightKeys={nightKeys} selectedNight={selectedNight} onSelect={onSelectNight} rankings={rankings} mode={mode} />

      <section className="rank-section">
        <div className="section-heading-row">
          <div><span className="section-kicker">LOCATION RANKING</span><h2>{mode === "star" ? "点位星空排名" : "点位云海潜力"}</h2></div>
          <span className="count-label">{rankings.length} 个点位</span>
        </div>
        <div className="ranking-list">
          {rankings.map((item, index) => <RankCard key={item.location.id} item={item} rank={index + 1} mode={mode} onOpen={() => onOpenDetail(item.location.id)} />)}
        </div>
      </section>
    </>
  );
}

function ScoreRing({ value = 0, label }) {
  const safe = Number.isFinite(value) ? value : 0;
  return <div className="score-ring" style={{ "--score": `${safe * 3.6}deg` }}><div><strong>{safe}</strong><span>{label}</span></div></div>;
}

function Metric({ icon: Icon, label, value }) {
  return <div className="metric"><Icon /><span>{label}</span><strong>{value}</strong></div>;
}

function DecisionItem({ tone, title, text }) {
  return <div className={`decision-item ${tone}`}><span className="decision-dot" /><div><strong>{title}</strong><p>{text}</p></div></div>;
}

function NightRail({ nightKeys, selectedNight, onSelect, rankings, mode }) {
  return (
    <section className="night-section">
      <div className="section-heading-row compact"><div><span className="section-kicker">FORECAST NIGHTS</span><h2>观测夜</h2></div><CalendarBlank /></div>
      <div className="night-rail">
        {nightKeys.map((night, index) => {
          const best = rankings
            .map((item) => item.forecast ? evaluateNight(item.forecast, item.location, night, index) : null)
            .filter(Boolean)
            .sort((a, b) => (mode === "cloud" ? b.cloudSeaPotential - a.cloudSeaPotential : b.score - a.score))[0];
          const meta = statusMeta(best?.status);
          return (
            <button key={night} className={selectedNight === night ? "active" : ""} onClick={() => onSelect(night)}>
              <span>{formatNightLabel(night, true)}</span>
              <strong>{mode === "cloud" ? best?.cloudSeaPotential ?? "—" : best?.score ?? "—"}</strong>
              <small className={meta.tone}>{index >= 7 ? "趋势" : meta.label}</small>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function RankCard({ item, rank, mode, onOpen }) {
  const evaluation = item.evaluation;
  const meta = statusMeta(evaluation?.status);
  const score = mode === "cloud" ? evaluation?.cloudSeaPotential : evaluation?.score;
  const bestHour = evaluation?.window[0] ?? evaluation?.hours?.sort((a, b) => b.score - a.score)[0];
  return (
    <button className="rank-card" onClick={onOpen}>
      <span className={`rank-number ${rank <= 3 ? "top" : ""}`}>{String(rank).padStart(2, "0")}</span>
      <div className="rank-main">
        <div className="rank-title"><div><h3>{item.location.name}</h3><p>{item.location.elevation} m · {evaluation?.confidence.level ?? "—"}置信度</p></div><span className={`status-pill ${meta.tone}`}>{meta.label}</span></div>
        <div className="rank-stats">
          <span><Cloud />云量 {Math.round(bestHour?.cloudCover ?? 0)}%</span>
          <span><CloudRain />降水 {Math.round(bestHour?.precipitationProbability ?? 0)}%</span>
          <span><Wind />阵风 {Math.round(bestHour?.windGust ?? 0)} m/s</span>
          <span><Moon />照度 {Math.round((evaluation?.moonIllumination ?? 0) * 100)}%</span>
        </div>
        <p className="rank-window"><Binoculars />{evaluation?.windowLabel ?? "暂无连续窗口"}</p>
      </div>
      <div className="rank-score"><strong>{score ?? "—"}</strong><span>{mode === "cloud" ? "云海" : "星空"}</span><CaretRight /></div>
    </button>
  );
}

function MatrixView({ locations, forecasts, nightKeys, mode, onSelect }) {
  const matrix = useMemo(() => locations.map((location) => {
    const forecast = forecasts.find((item) => item.locationId === location.id);
    return { location, values: nightKeys.map((night, index) => forecast ? evaluateNight(forecast, location, night, index) : null) };
  }), [locations, forecasts, nightKeys]);
  return (
    <section className="matrix-section">
      <div className="section-heading-row"><div><span className="section-kicker">CORE WINDOW</span><h2>{mode === "star" ? "星空核心窗口" : "云海潜力矩阵"}</h2><p>单元格显示{mode === "star" ? "优质连续小时 / 星空分" : "云海潜力指数"}；点击查看详情。</p></div></div>
      <div className="matrix-wrap">
        <table>
          <thead><tr><th>点位</th>{nightKeys.map((night) => <th key={night}>{formatNightLabel(night, true)}</th>)}</tr></thead>
          <tbody>{matrix.map((row) => <tr key={row.location.id}><th>{row.location.name}<small>{row.location.elevation}m</small></th>{row.values.map((value, index) => {
            const meta = statusMeta(value?.status);
            return <td key={nightKeys[index]}><button className={`matrix-cell ${meta.tone}`} onClick={() => onSelect(row.location.id, nightKeys[index])}>{mode === "star" ? <><strong>{value?.window.length ?? 0}h</strong><span>/ {value?.score ?? "—"}</span></> : <strong>{value?.cloudSeaPotential ?? "—"}</strong>}</button></td>;
          })}</tr>)}</tbody>
        </table>
      </div>
      <div className="legend"><span className="good">推荐</span><span className="warn">候选</span><span className="bad">不建议</span><span className="muted">趋势/无数据</span></div>
    </section>
  );
}

function LocationsView({ locations, customLocations, onAdd, onRemove }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", latitude: "", longitude: "", elevation: "" });
  function submit(event) {
    event.preventDefault();
    if (!form.name || !Number.isFinite(Number(form.latitude)) || !Number.isFinite(Number(form.longitude)) || !Number.isFinite(Number(form.elevation))) return;
    onAdd(form);
    setForm({ name: "", latitude: "", longitude: "", elevation: "" });
    setShowForm(false);
  }
  return (
    <section className="locations-section">
      <div className="section-heading-row"><div><span className="section-kicker">OBSERVATION SITES</span><h2>点位管理</h2><p>天气查询统一使用 WGS84 坐标；用户海拔不会被模型静默覆盖。</p></div><button className="primary-button" onClick={() => setShowForm(true)}><Plus />新增点位</button></div>
      <div className="location-table-wrap"><table className="location-table"><thead><tr><th>点位</th><th>纬度</th><th>经度</th><th>海拔(m)</th><th>来源</th><th /></tr></thead><tbody>{locations.map((location) => <tr key={location.id}><td><MapPin />{location.name}</td><td>{location.latitude.toFixed(4)}</td><td>{location.longitude.toFixed(4)}</td><td>{location.elevation}</td><td>{location.source}</td><td>{customLocations.some((item) => item.id === location.id) && <button className="icon-button danger" onClick={() => onRemove(location.id)} aria-label={`删除 ${location.name}`}><X /></button>}</td></tr>)}</tbody></table></div>
      {showForm && <div className="modal-backdrop" onMouseDown={() => setShowForm(false)}><form className="location-form" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}><div className="form-header"><div><span className="section-kicker">NEW LOCATION</span><h3>新增观测点</h3></div><button type="button" className="icon-button" aria-label="关闭表单" onClick={() => setShowForm(false)}><X /></button></div><label>点位名称<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：东白山" required /></label><div className="form-grid"><label>纬度<input type="number" step="0.0001" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} placeholder="29.5000" required /></label><label>经度<input type="number" step="0.0001" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} placeholder="120.3000" required /></label></div><label>用户海拔（米）<input type="number" step="0.1" value={form.elevation} onChange={(event) => setForm({ ...form, elevation: event.target.value })} placeholder="1000" required /></label><p className="form-note"><Info />保存后点击刷新获取 14 天天气。自定义点位只保存在本机浏览器。</p><button className="primary-button wide" type="submit"><CheckCircle />保存点位</button></form></div>}
    </section>
  );
}

function DetailDrawer({ item, nightKey, onClose }) {
  const { location, evaluation } = item;
  const [pressure, setPressure] = useState(null);
  const [pressureError, setPressureError] = useState("");
  const [pressureLoading, setPressureLoading] = useState(true);
  const [activeHour, setActiveHour] = useState(evaluation?.window[0]?.time ?? evaluation?.hours?.[0]?.time);

  useEffect(() => {
    const controller = new AbortController();
    setPressureLoading(true);
    fetchPressureForecast(location, 7, controller.signal)
      .then(setPressure)
      .catch(() => setPressureError("垂直云层暂时不可用；地面天气与天文判断仍可查看。"))
      .finally(() => setPressureLoading(false));
    return () => controller.abort();
  }, [location.id]);

  const profile = pressure?.profiles?.[activeHour] ?? [];
  const layers = pressure ? deriveCloudLayers(profile, pressure.modelElevation, location.elevation) : [];
  const weatherOption = useMemo(() => buildWeatherChart(evaluation?.hours ?? []), [evaluation]);
  const astroOption = useMemo(() => buildAstroChart(evaluation?.hours ?? []), [evaluation]);
  const profileOption = useMemo(() => buildProfileChart(profile, location.elevation), [profile, location.elevation]);

  return (
    <div className="drawer-backdrop" onMouseDown={onClose}>
      <aside className="detail-drawer" onMouseDown={(event) => event.stopPropagation()} aria-label={`${location.name} 详情`}>
        <div className="drawer-header"><div><span className="section-kicker">LOCATION DETAIL · {formatNightLabel(nightKey)}</span><h2>{location.name}</h2><p>{location.elevation} m · {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}</p></div><button className="icon-button" aria-label="关闭详情" onClick={onClose}><X /></button></div>
        <div className="detail-summary"><ScoreRing value={evaluation?.score} label="星空分" /><div><span className={`status-pill ${statusMeta(evaluation?.status).tone}`}>{statusMeta(evaluation?.status).label}</span><h3>{evaluation?.windowLabel}</h3><p>{evaluation?.reason}</p></div></div>
        <div className="detail-metrics"><Metric icon={Cloud} label="云海潜力" value={evaluation?.cloudSeaPotential} /><Metric icon={Moon} label="月面照度" value={`${Math.round((evaluation?.moonIllumination ?? 0) * 100)}%`} /><Metric icon={Sparkle} label="天文暗夜" value={`${evaluation?.darkHours ?? 0}h`} /><Metric icon={Compass} label="银河最高" value={`${evaluation?.galacticMax ?? 0}°`} /></div>

        <DetailSection title="逐小时天气" subtitle="云量、降水与风" icon={Cloud}>
          <ReactECharts option={weatherOption} style={{ height: 260 }} notMerge />
          <div className="hour-chips">{evaluation?.hours.map((hour) => <button key={hour.time} className={activeHour === hour.time ? "active" : ""} onClick={() => setActiveHour(hour.time)}><span>{formatHour(hour.time)}</span><strong>{hour.score}</strong></button>)}</div>
        </DetailSection>
        <DetailSection title="天文轨迹" subtitle="太阳、月亮与银河核心高度" icon={Moon}><ReactECharts option={astroOption} style={{ height: 230 }} notMerge /></DetailSection>
        <DetailSection title="低云海拔评估" subtitle="实验性气压层推导，不是山顶实测" icon={Mountains}>
          {pressureLoading && <div className="inline-loading"><span className="loader small" />读取垂直云层…</div>}
          {pressureError && <p className="inline-error"><Warning />{pressureError}</p>}
          {pressure && <><div className="profile-meta"><span>模型地形：{Math.round(pressure.modelElevation)} m</span><span>用户海拔：{location.elevation} m</span><span>时次：{formatHour(activeHour)}</span></div><ReactECharts option={profileOption} style={{ height: 250 }} notMerge />{layers.length ? <div className="cloud-layer-list">{layers.map((layer, index) => <div className="cloud-layer" key={`${layer.baseMsl}-${index}`}><Cloud weight="fill" /><div><strong>{layer.baseMsl}–{layer.topMsl} m MSL</strong><span>距模型地面 {layer.baseAgl}–{layer.topAgl} m AGL · {layer.confidence}置信度</span></div><span className={`relation ${layer.relation === "云上" ? "good" : layer.relation === "云中" ? "bad" : "warn"}`}>{layer.relation}</span></div>)}</div> : <p className="no-layer">该时次未识别到可靠连续云层。</p>}</>}
        </DetailSection>
        <div className="method-note"><Info /><p><strong>方法边界</strong> 云底/云顶由数值模型气压层推导，已过滤模型地表以下层并取整到 50 m。复杂山地仍需结合现场云图、能见度与周边谷地情况。</p></div>
      </aside>
    </div>
  );
}

function DetailSection({ title, subtitle, icon: Icon, children }) {
  return <section className="detail-section"><div className="detail-section-heading"><div><Icon /><div><h3>{title}</h3><p>{subtitle}</p></div></div></div>{children}</section>;
}

function baseChartStyle() {
  return {
    backgroundColor: "transparent",
    textStyle: { color: "#aebbd0", fontFamily: "system-ui, sans-serif" },
    tooltip: { trigger: "axis", backgroundColor: "#1a2154", borderColor: "#4a5599", textStyle: { color: "#f4f6ff" } },
    grid: { left: 38, right: 14, top: 38, bottom: 32 },
  };
}

function buildWeatherChart(hours) {
  return {
    ...baseChartStyle(),
    legend: { top: 0, textStyle: { color: "#9aabc3" }, data: ["总云", "低云", "降水概率", "阵风"] },
    xAxis: { type: "category", data: hours.map((hour) => formatHour(hour.time)), axisLine: { lineStyle: { color: "#33425d" } }, axisLabel: { color: "#8393ad", interval: 1 } },
    yAxis: [{ type: "value", min: 0, max: 100, axisLabel: { color: "#8393ad", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#1d2a40" } } }, { type: "value", axisLabel: { color: "#8393ad", formatter: "{value}m/s" }, splitLine: { show: false } }],
    series: [
      { name: "总云", type: "line", smooth: true, data: hours.map((hour) => hour.cloudCover), lineStyle: { color: "#d5e1f0" }, itemStyle: { color: "#d5e1f0" }, areaStyle: { color: "rgba(213,225,240,.08)" } },
      { name: "低云", type: "line", smooth: true, data: hours.map((hour) => hour.cloudLow), lineStyle: { color: "#36d2e7" }, itemStyle: { color: "#36d2e7" } },
      { name: "降水概率", type: "bar", data: hours.map((hour) => hour.precipitationProbability), itemStyle: { color: "rgba(79,132,255,.42)" } },
      { name: "阵风", type: "line", yAxisIndex: 1, data: hours.map((hour) => hour.windGust), lineStyle: { color: "#f5ae52", type: "dashed" }, itemStyle: { color: "#f5ae52" } },
    ],
  };
}

function buildAstroChart(hours) {
  return {
    ...baseChartStyle(),
    legend: { top: 0, textStyle: { color: "#9aabc3" }, data: ["太阳", "月亮", "银河核心"] },
    xAxis: { type: "category", data: hours.map((hour) => formatHour(hour.time)), axisLine: { lineStyle: { color: "#33425d" } }, axisLabel: { color: "#8393ad", interval: 1 } },
    yAxis: { type: "value", min: -40, max: 90, axisLabel: { color: "#8393ad", formatter: "{value}°" }, splitLine: { lineStyle: { color: "#1d2a40" } } },
    series: [
      { name: "太阳", type: "line", smooth: true, data: hours.map((hour) => Math.round(hour.sunAltitude)), lineStyle: { color: "#f5ae52" }, itemStyle: { color: "#f5ae52" }, markLine: { symbol: "none", label: { formatter: "天文黑夜 -18°", color: "#74839b" }, lineStyle: { color: "#596780", type: "dashed" }, data: [{ yAxis: -18 }] } },
      { name: "月亮", type: "line", smooth: true, data: hours.map((hour) => Math.round(hour.moonAltitude)), lineStyle: { color: "#dbe8f6" }, itemStyle: { color: "#dbe8f6" } },
      { name: "银河核心", type: "line", smooth: true, data: hours.map((hour) => Math.round(hour.galacticAltitude)), lineStyle: { color: "#36d2e7", width: 3 }, itemStyle: { color: "#36d2e7" } },
    ],
  };
}

function buildProfileChart(profile, siteElevation) {
  const valid = profile.filter((level) => Number.isFinite(level.heightMsl));
  return {
    ...baseChartStyle(),
    grid: { left: 58, right: 18, top: 24, bottom: 34 },
    xAxis: { type: "value", min: 0, max: 100, axisLabel: { color: "#8393ad", formatter: "{value}%" }, splitLine: { lineStyle: { color: "#1d2a40" } } },
    yAxis: { type: "value", name: "MSL m", nameTextStyle: { color: "#8393ad" }, axisLabel: { color: "#8393ad" }, splitLine: { lineStyle: { color: "#1d2a40" } } },
    series: [{ name: "压力层云量", type: "line", data: valid.map((level) => [level.cloudCover ?? 0, level.heightMsl]), lineStyle: { color: "#36d2e7", width: 3 }, itemStyle: { color: "#36d2e7" }, areaStyle: { color: "rgba(54,210,231,.1)" }, markLine: { symbol: "none", label: { formatter: `机位 ${siteElevation}m`, color: "#f5ae52" }, lineStyle: { color: "#f5ae52", type: "dashed" }, data: [{ yAxis: siteElevation }] } }],
  };
}
