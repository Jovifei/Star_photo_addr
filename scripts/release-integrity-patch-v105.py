from pathlib import Path
import json
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    Path(path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Version + release notes
# ---------------------------------------------------------------------------
package_path = Path("package.json")
package = json.loads(package_path.read_text(encoding="utf-8"))
package["version"] = "1.0.5"
package_path.write_text(json.dumps(package, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

changelog = read("CHANGELOG.md")
marker = "---\n\n"
release = """## [v1.0.5] - 2026-09-06

### 🛡️ 发布完整性与数据真实性修复
- **生产依赖安全**：更新锁文件中的高风险传递依赖，恢复 `npm audit --omit=dev --audit-level=high` 发布门禁。
- **云海数据真实性**：删除 Open-Meteo 失败后的人工天气生成；AIFS 使用真实 `ecmwf_aifs025_single` 模型；关键云量、温湿度、风与降水字段缺失时明确返回“数据不足”。
- **云海语义降级**：将未经现场校准的“概率”改为“条件指数”，真实使用 Open-Meteo 相对湿度；云底/云顶继续明确标注为启发式估算并显示 Beta 提示。
- **天气缓存来源保护**：移除百公里范围内跨地点、跨模型静默借用磁盘天气的路径，只允许完全相同请求键的 stale 磁盘缓存。
- **火烧云完整性**：修复 80%+ 细分档位统计漏计；磁盘快照按 `generatedAt` 判断年龄；强刷冷却期无可用缓存时返回 429，不再继续冲击上游。
- **时间语义修复**：决策摘要不再把“预报有效时次”冒充“数据更新时间”。

"""
if "## [v1.0.5]" not in changelog:
    if marker not in changelog:
        raise SystemExit("CHANGELOG marker missing")
    changelog = changelog.replace(marker, marker + release, 1)
    write("CHANGELOG.md", changelog)

modal = read("src/components/ChangelogModal.tsx")
modal = modal.replace(
    'version: "v1.0.4",\n    date: "2026-09-06",\n    tag: "统一工作台契约与版本追踪修复",\n    current: true,',
    'version: "v1.0.4",\n    date: "2026-09-06",\n    tag: "统一工作台契约与版本追踪修复",\n    current: false,',
    1,
)
if 'version: "v1.0.5"' not in modal:
    insertion = """  {
    version: "v1.0.5",
    date: "2026-09-06",
    tag: "发布完整性与数据真实性修复",
    current: true,
    highlights: [
      {
        icon: ShieldCheck,
        title: "数据真实性优先",
        desc: "删除云海人工天气兜底，修复 AIFS 模型映射、跨地点天气缓存借用和火烧云快照年龄；关键数据缺失时明确降级。",
      },
      {
        icon: CloudSun,
        title: "云海条件指数 Beta",
        desc: "使用真实 Open-Meteo 相对湿度，将未校准的概率语义降级为条件指数；云底与云顶继续明确标注为启发式估算。",
      },
      {
        icon: Layers,
        title: "发布门禁恢复",
        desc: "更新高风险传递依赖并恢复生产依赖审计，补齐云海、火烧云与缓存来源的回归测试。",
      },
    ],
  },
"""
    modal = modal.replace("const VERSIONS = [\n", "const VERSIONS = [\n" + insertion, 1)
write("src/components/ChangelogModal.tsx", modal)


# ---------------------------------------------------------------------------
# Cloud-sea API: no synthetic fallback; validate real fields and model mapping.
# ---------------------------------------------------------------------------
route_path = "src/app/api/cloudsea/snapshot/route.ts"
route = read(route_path)
route = route.replace(
    'import { applyOpenMeteoApiKey, OPEN_METEO_FORECAST_URL } from "@/lib/forecast";',
    'import {\n  applyOpenMeteoApiKey,\n  openMeteoModelParameter,\n  OPEN_METEO_FORECAST_URL,\n} from "@/lib/forecast";',
    1,
)
route, count = re.subn(
    r"\nfunction generateFallbackWeather\(date: string\): Record<string, RawSiteHourly> \{.*?\n\}\n\nasync function fetchCloudSeaWeather",
    """
function validAlignedSeries(value: unknown, expectedLength: number): boolean {
  return (
    Array.isArray(value) &&
    value.length === expectedLength &&
    value.every((item) => item === null || (typeof item === "number" && Number.isFinite(item))) &&
    value.some((item) => typeof item === "number" && Number.isFinite(item))
  );
}

function validCloudSeaHourly(hourly: Record<string, unknown>): boolean {
  const times = hourly.time;
  if (!Array.isArray(times) || times.length === 0 || !times.every((time) => typeof time === "string")) {
    return false;
  }
  const required = [
    "cloud_cover_low",
    "cloud_cover_mid",
    "cloud_cover_high",
    "temperature_2m",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
  ];
  return required.every((field) => validAlignedSeries(hourly[field], times.length));
}

async function fetchCloudSeaWeather""",
    route,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("failed to remove cloudsea fabricated fallback")
route = route.replace(
    '      "temperature_2m",\n      "cloud_cover",',
    '      "temperature_2m",\n      "relative_humidity_2m",\n      "cloud_cover",',
    1,
)
route = route.replace(
    '  if (model === "icon") {\n    params.set("models", "icon_seamless");\n  } else if (model === "gfs") {\n    params.set("models", "gfs_seamless");\n  }',
    '  const providerModel = openMeteoModelParameter(model);\n  if (providerModel) params.set("models", providerModel);',
    1,
)
route = route.replace(
    '        if (entry && entry.hourly) {\n          result[site.id] = {',
    '        if (entry?.hourly && validCloudSeaHourly(entry.hourly as Record<string, unknown>)) {\n          result[site.id] = {',
    1,
)
route = route.replace(
    '            temperature_2m: entry.hourly.temperature_2m ?? [],\n            precipitation:',
    '            temperature_2m: entry.hourly.temperature_2m ?? [],\n            relative_humidity_2m: entry.hourly.relative_humidity_2m ?? [],\n            precipitation:',
    1,
)
route = route.replace(
    '    } catch (err) {\n      lastErr = err;\n      if (signal.aborted) throw err;\n    }\n  }\n\n  console.warn("Open-Meteo fetch failed after retries, using resilient fallback for", date, lastErr);\n  return generateFallbackWeather(date);',
    '    } catch (err) {\n      lastErr = err;\n      if (signal.aborted) throw err;\n      if (attempt === 0) {\n        await new Promise((resolve) => setTimeout(resolve, 300));\n      }\n    }\n  }\n\n  throw lastErr instanceof Error\n    ? lastErr\n    : new Error(`Open-Meteo 云海气象数据不可用：${date}`);',
    1,
)
old_cooldown = """        );
      }
    } else {
      lastForceAt.set(key, Date.now());
    }"""
new_cooldown = """        );
      }
      return NextResponse.json(
        { error: "云海强制刷新处于冷却保护，请稍后重试" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "X-Cloudsea-Cache": "refresh-cooldown",
            "Retry-After": String(Math.ceil((FORCE_REFRESH_COOLDOWN_MS - elapsed) / 1000)),
          },
        },
      );
    } else {
      lastForceAt.set(key, Date.now());
    }"""
if old_cooldown not in route:
    raise SystemExit("cloudsea cooldown anchor missing")
route = route.replace(old_cooldown, new_cooldown, 1)
write(route_path, route)


# ---------------------------------------------------------------------------
# Cloud-sea scoring: real RH, no synthetic defaults, Beta/index semantics.
# ---------------------------------------------------------------------------
cloudsea_path = "src/lib/cloudsea.ts"
cloudsea = read(cloudsea_path)
cloudsea = cloudsea.replace(
    "  temperature_2m?: Array<number | null>;\n  precipitation?:",
    "  temperature_2m?: Array<number | null>;\n  relative_humidity_2m?: Array<number | null>;\n  precipitation?:",
    1,
)
cloudsea = cloudsea.replace(
    "  windSpeedMs = 2.0,\n): { baseM: number; topM: number } {",
    "  windSpeedMs = 2.0,\n  humidityPct = 75,\n): { baseM: number; topM: number } {",
    1,
)
old_lcl = """  // Condensation level (LCL) estimated above valley floor
  // Higher temp and wind push base higher; moist calm air keeps it lower
  const lclAboveValley = Math.round(
    Math.max(250, 400 + Math.max(0, tempC) * 20 + windSpeedMs * 15),
  );"""
new_lcl = """  // Heuristic LCL proxy. Estimate dew-point depression from the real
  // provider relative humidity, then use ~125 m/°C as an approximate LCL
  // height. This remains an estimate, not a pressure-level cloud-base product.
  const humidity = clamp(humidityPct, 5, 100);
  const dewPointC = tempC - (100 - humidity) / 5;
  const lclAboveValley = Math.round(
    clamp(125 * Math.max(0, tempC - dewPointC) + windSpeedMs * 10, 120, 1800),
  );"""
if old_lcl not in cloudsea:
    raise SystemExit("cloudsea LCL block changed unexpectedly")
cloudsea = cloudsea.replace(old_lcl, new_lcl, 1)
cloudsea = cloudsea.replace(
    "  const activeIndices = indices.length > 0 ? indices : hourly.time.map((_, i) => i);",
    """  if (indices.length === 0) {
    return {
      ...CLOUD_SEA_EMPTY_WINDOW,
      summary: "目标晨昏窗口没有对应的逐小时气象数据。",
    };
  }
  const activeIndices = indices;""",
    1,
)
cloudsea, count = re.subn(
    r"  // Extract average parameters\n  const avg = .*?\n  // Derive estimated relative humidity proxy \(higher low cloud & precip -> high humidity\)\n  const humidityProxy = Math\.round\(clamp\(45 \+ lowCloud \* 0\.45 \+ \(precip > 0 \? 20 : 0\)\)\);",
    """  // Critical inputs must be present for the requested window. Missing
  // provider data is not replaced with synthetic defaults.
  const avg = (arr?: Array<number | null>): number | null => {
    if (!arr) return null;
    let sum = 0;
    let count = 0;
    for (const idx of activeIndices) {
      const value = arr[idx];
      if (typeof value === "number" && Number.isFinite(value)) {
        sum += value;
        count += 1;
      }
    }
    return count > 0 ? sum / count : null;
  };

  const lowCloud = avg(hourly.cloud_cover_low);
  const midCloud = avg(hourly.cloud_cover_mid);
  const highCloud = avg(hourly.cloud_cover_high);
  const tempC = avg(hourly.temperature_2m);
  const humidity = avg(hourly.relative_humidity_2m);
  const windSpeed = avg(hourly.wind_speed_10m);
  const precip = avg(hourly.precipitation);

  if (
    lowCloud === null ||
    midCloud === null ||
    highCloud === null ||
    tempC === null ||
    humidity === null ||
    windSpeed === null ||
    precip === null
  ) {
    return {
      ...CLOUD_SEA_EMPTY_WINDOW,
      summary: "关键云量、湿度、风或降水数据不完整，无法计算云海条件指数。",
    };
  }""",
    cloudsea,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("failed to replace cloudsea averaging block")
cloudsea = cloudsea.replace(
    "  const { baseM, topM } = estimateCloudLayers(site.altitude, lowCloud, tempC, windSpeed);",
    """  const { baseM, topM } = estimateCloudLayers(
    site.altitude,
    lowCloud,
    tempC,
    windSpeed,
    humidity,
  );""",
    1,
)
cloudsea = cloudsea.replace("    probabilityLabel: `${score}%`,", "    probabilityLabel: `${score}/100`,", 1)
cloudsea = cloudsea.replace("    humidity: humidityProxy,", "    humidity: Math.round(humidity),", 1)
cloudsea = cloudsea.replace(
    '    source: "Open-Meteo Pressure & Cloud Layer Engine",',
    '    source: "Open-Meteo surface cloud + RH heuristic (Beta)",',
    1,
)
cloudsea = cloudsea.replace("Cloud-sea (云海预测) scoring", "Cloud-sea (云海条件指数) scoring", 1)
write(cloudsea_path, cloudsea)


# ---------------------------------------------------------------------------
# Cloud-sea UI: Beta/heuristic and conditions-index language.
# ---------------------------------------------------------------------------
cloud_app_path = "src/app/cloudsea/CloudSeaApp.tsx"
cloud_app = read(cloud_app_path)
cloud_app = cloud_app.replace('title="云海预测地图"', 'title="云海条件地图"')
cloud_app = cloud_app.replace("云海出现概率色阶", "云海条件指数色阶")
cloud_app = cloud_app.replace("云海概率:", "云海条件指数:")
cloud_app = cloud_app.replace("云海概率", "云海条件指数")
for old, new in [
    ("0–20%", "0–20"),
    ("20–40%", "20–40"),
    ("40–60%", "40–60"),
    ("60–80%", "60–80"),
    ("80–90%", "80–90"),
    ("90–100%", "90–100"),
]:
    cloud_app = cloud_app.replace(old, new)
banner_anchor = '      </ProductHeader>\n\n      <div\n        className="cloudsea-body"'
if banner_anchor not in cloud_app:
    raise SystemExit("cloudsea banner anchor missing")
cloud_app = cloud_app.replace(
    banner_anchor,
    '      </ProductHeader>\n\n      <div className="cloudsea-beta-banner" role="note">\n        Beta · 条件指数基于 Open-Meteo 云量、真实相对湿度、风与地形的启发式计算；云底/云顶为估算层位，尚未完成现场概率校准。\n      </div>\n\n      <div\n        className="cloudsea-body"',
    1,
)
write(cloud_app_path, cloud_app)

detail_path = "src/app/cloudsea/CloudSeaSiteDetail.tsx"
detail = read(detail_path)
detail = detail.replace("云海综合概率", "云海条件指数")
detail = detail.replace("成海指数", "条件指数")
content_anchor = '      <div className="cs-detail-scroll-content">\n'
if content_anchor not in detail:
    raise SystemExit("cloudsea detail disclaimer anchor missing")
detail = detail.replace(
    content_anchor,
    content_anchor + '        <p className="cs-beta-note">Beta · 湿度来自 Open-Meteo；云底/云顶和条件指数为启发式估算，尚未完成现场云底仪或长期实拍概率校准。</p>\n',
    1,
)
write(detail_path, detail)

cloud_css_path = "src/app/cloudsea/cloudsea.css"
cloud_css = read(cloud_css_path)
if ".cloudsea-beta-banner" not in cloud_css:
    cloud_css += """

.cloudsea-beta-banner,
.cs-beta-note {
  margin: 8px 14px 0;
  padding: 8px 10px;
  border: 1px solid rgba(72, 181, 181, 0.28);
  border-radius: 10px;
  background: rgba(72, 181, 181, 0.08);
  color: var(--cs-muted, #9db7bf);
  font-size: 12px;
  line-height: 1.55;
}
"""
write(cloud_css_path, cloud_css)

replace_once(
    "src/app/cloudsea/page.tsx",
    'title: "云海预测地图｜高山云顶 · 晨昏云海与日出预测",\n  description:\n    "全国名山高山云海概率分布、相对云层高度（云上/云中/云下）、逆温层推导、晨昏日出窗口与三日总览。",',
    'title: "云海条件地图 Beta｜高山云层 · 晨昏云海条件指数",\n  description:\n    "全国名山云海条件指数、真实相对湿度与低云数据，并结合地形启发式估算云底/云顶层位；结果为 Beta 条件判断，不是现场校准概率。",',
)


# ---------------------------------------------------------------------------
# Forecast cache: only exact-key stale disk data may be served.
# ---------------------------------------------------------------------------
forecast_path = "src/app/api/forecast/route.ts"
forecast = read(forecast_path)
forecast = forecast.replace(
    'import type { ForecastMetadata, ForecastModel, ForecastResponse } from "@/lib/types";',
    'import type { ForecastModel, ForecastResponse } from "@/lib/types";',
    1,
)
forecast, count = re.subn(
    r"\nfunction findNearestDiskForecast\(.*?\n\}\n\n\nconst MODELS",
    "\nconst MODELS",
    forecast,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("nearest disk fallback function not removed")
forecast = forecast.replace(
    """    const diskFallback =
      readFromDiskCache(key) ??
      (latitudes.length === 1 && longitudes.length === 1
        ? findNearestDiskForecast(latitudes[0], longitudes[0], model)
        : null);""",
    "    const diskFallback = readFromDiskCache(key);",
    1,
)
write(forecast_path, forecast)


# ---------------------------------------------------------------------------
# Fireglow integrity.
# ---------------------------------------------------------------------------
fire_lib_path = "src/lib/fireglow.ts"
fire_lib = read(fire_lib_path)
helper_anchor = '  | "p95"\n  | "p100";\n'
if helper_anchor not in fire_lib:
    raise SystemExit("fireglow level anchor missing")
if "isHighFireGlowLevel" not in fire_lib:
    fire_lib = fire_lib.replace(
        helper_anchor,
        helper_anchor
        + """
export function isHighFireGlowLevel(
  level: FireGlowProbabilityLevel | null | undefined,
): boolean {
  return level === "p80" || level === "p88" || level === "p95" || level === "p100";
}
""",
        1,
    )
write(fire_lib_path, fire_lib)

fire_app_path = "src/app/fireglow/FireglowApp.tsx"
fire_app = read(fire_app_path)
fire_app = fire_app.replace(
    'import { fireGlowBandLabel } from "@/lib/fireglow";',
    'import { fireGlowBandLabel, isHighFireGlowLevel } from "@/lib/fireglow";',
    1,
)
fire_app = fire_app.replace(
    '    return level === "p80" || level === "p100";',
    "    return isHighFireGlowLevel(level);",
    1,
)
fire_app = fire_app.replace('title="火烧云概率地图"', 'title="火烧云条件地图"')
fire_app = fire_app.replace("火烧云概率等级色阶", "火烧云条件指数等级色阶")
fire_app = fire_app.replace("火烧云概率", "火烧云条件指数")
fire_anchor = '      </ProductHeader>\n\n      <main\n        className="fireglow-workspace"'
if fire_anchor not in fire_app:
    raise SystemExit("fireglow note anchor missing")
fire_app = fire_app.replace(
    fire_anchor,
    '      </ProductHeader>\n\n      <div className="fireglow-model-note" role="note">\n        条件指数由云层结构、能见度与太阳高度启发式映射，尚未完成长期实拍事件概率校准。\n      </div>\n\n      <main\n        className="fireglow-workspace"',
    1,
)
write(fire_app_path, fire_app)

fire_detail_path = "src/app/fireglow/FireglowSiteDetail.tsx"
fire_detail = read(fire_detail_path)
fire_detail = fire_detail.replace("爆发概率", "条件指数")
fire_detail = fire_detail.replace("火烧云概率", "火烧云条件指数")
write(fire_detail_path, fire_detail)

replace_once(
    "src/app/fireglow/page.tsx",
    'title: "火烧云概率地图｜逐霞 · 晨昏窗口预测",\n  description:\n    "今天/明天/后天与未来三日的晚霞朝霞概率分布，五级色阶地图、鲜艳度、金色/蓝色时刻与天文晨昏。",',
    'title: "火烧云条件地图｜逐霞 · 晨昏窗口条件指数",\n  description:\n    "今天/明天/后天与未来三日的晚霞朝霞条件指数分布、鲜艳度、金色/蓝色时刻与天文晨昏；指数尚未完成长期实拍概率校准。",',
)

fire_css_path = "src/app/fireglow/fireglow.css"
fire_css = read(fire_css_path)
if ".fireglow-model-note" not in fire_css:
    fire_css += """

.fireglow-model-note {
  margin: 8px 14px 0;
  padding: 7px 10px;
  border: 1px solid rgba(224, 122, 47, 0.24);
  border-radius: 10px;
  background: rgba(224, 122, 47, 0.07);
  color: var(--muted, #aebbc4);
  font-size: 12px;
  line-height: 1.5;
}
"""
write(fire_css_path, fire_css)

fire_route_path = "src/app/api/fireglow/snapshot/route.ts"
fire_route = read(fire_route_path)
fire_route = fire_route.replace(
    "const FORCE_REFRESH_COOLDOWN_MS = 60_000;\n",
    "const FORCE_REFRESH_COOLDOWN_MS = 60_000;\nconst DISK_STALE_TTL_MS = 24 * 60 * 60_000;\n",
    1,
)
fire_route, count = re.subn(
    r"(function readFireglowFromDisk\(date: string, model: string\): FireGlowSnapshot \| null \{.*?\n\})\n\nconst cache",
    r"""\1

export function fireglowSnapshotAgeMs(snapshot: FireGlowSnapshot): number {
  const generatedAt = Date.parse(snapshot.generatedAt);
  if (!Number.isFinite(generatedAt)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Date.now() - generatedAt);
}

function readUsableFireglowDiskSnapshot(date: string, model: string): FireGlowSnapshot | null {
  const snapshot = readFireglowFromDisk(date, model);
  return snapshot && fireglowSnapshotAgeMs(snapshot) <= DISK_STALE_TTL_MS ? snapshot : null;
}

const cache""",
    fire_route,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit("failed to insert fireglow disk age helpers")
fire_route = fire_route.replace(
    "  const key = `${date}|${model}`;\n  if (forceRefresh) {",
    "  const key = `${date}|${model}`;\n  const diskCached = readUsableFireglowDiskSnapshot(date, model);\n  if (forceRefresh) {",
    1,
)
fire_route = fire_route.replace(
    '      const cached = cache.get(key);\n      if (cached) {\n        return NextResponse.json(\n          { ...cached.snapshot, stale: true, refreshError: "强制刷新冷却中" },',
    '      const cached = cache.get(key);\n      const cooldownFallback = cached?.snapshot ?? diskCached;\n      if (cooldownFallback) {\n        return NextResponse.json(\n          { ...cooldownFallback, stale: true, refreshError: "强制刷新冷却中" },',
    1,
)
old_fire_cooldown = """        );
      }
    } else {
      lastForceAt.set(key, Date.now());
    }"""
new_fire_cooldown = """        );
      }
      return NextResponse.json(
        { error: "火烧云强制刷新处于冷却保护，请稍后重试" },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "X-Fireglow-Cache": "refresh-cooldown",
            "Retry-After": String(Math.ceil((FORCE_REFRESH_COOLDOWN_MS - elapsed) / 1000)),
          },
        },
      );
    } else {
      lastForceAt.set(key, Date.now());
    }"""
if old_fire_cooldown not in fire_route:
    raise SystemExit("fireglow cooldown anchor missing")
fire_route = fire_route.replace(old_fire_cooldown, new_fire_cooldown, 1)
fire_route = fire_route.replace(
    "  const diskCached = readFireglowFromDisk(date, model);\n  if (!cached && diskCached && !forceRefresh) {\n    cache.set(key, { snapshot: diskCached, at: Date.now() });\n    return NextResponse.json(diskCached, {",
    "  if (!cached && diskCached && !forceRefresh && fireglowSnapshotAgeMs(diskCached) <= TTL_MS) {\n    const ageMs = fireglowSnapshotAgeMs(diskCached);\n    cache.set(key, { snapshot: diskCached, at: Date.now() - ageMs });\n    return NextResponse.json(diskCached, {",
    1,
)
fire_route = fire_route.replace(
    "    const diskFallback = diskCached ?? readFireglowFromDisk(date, model);",
    "    const latestDisk = readUsableFireglowDiskSnapshot(date, model);\n    const diskFallback = diskCached ?? latestDisk;",
    1,
)
write(fire_route_path, fire_route)


# ---------------------------------------------------------------------------
# Decision summary: a forecast valid time is never an update timestamp.
# ---------------------------------------------------------------------------
replace_once(
    "src/components/workspace/DecisionSummary.tsx",
    "      state.forecast?.fetchedAt ??\n      state.cloudState.activeForecastTime ??\n      null,",
    "      state.forecast?.fetchedAt ??\n      state.forecastAvailability.lastSuccessAt ??\n      null,",
)


# ---------------------------------------------------------------------------
# Regression tests.
# ---------------------------------------------------------------------------
cloud_test_path = "tests/unit/cloudsea.test.ts"
cloud_test = read(cloud_test_path)
cloud_test = cloud_test.replace(
    "      wind_speed_10m: [1.8, 1.5, 2.0, 2.2],\n      precipitation:",
    "      wind_speed_10m: [1.8, 1.5, 2.0, 2.2],\n      relative_humidity_2m: [88, 90, 89, 86],\n      precipitation:",
    1,
)
cloud_test = cloud_test.replace(
    "      wind_speed_10m: [3.5, 4.0, 3.8],\n      precipitation:",
    "      wind_speed_10m: [3.5, 4.0, 3.8],\n      relative_humidity_2m: [82, 80, 84],\n      precipitation:",
    1,
)
cloud_test = cloud_test.replace(
    "      wind_speed_10m: [1.5],\n      precipitation:",
    "      wind_speed_10m: [1.5],\n      relative_humidity_2m: [55],\n      precipitation:",
    1,
)
high_expect = "    expect(result.altitudeDiffM).toBeGreaterThan(0);\n"
if high_expect not in cloud_test:
    raise SystemExit("cloudsea high expectation anchor missing")
cloud_test = cloud_test.replace(
    high_expect,
    high_expect + '    expect(result.humidity).toBeGreaterThan(80);\n    expect(result.probabilityLabel).toMatch(/\\/100$/);\n',
    1,
)
missing_test_anchor = '  it("identifies clear skies when low cloud is minimal", () => {'
missing_test = """  it("returns data-insufficient when a critical provider series is missing", () => {
    const hourly = {
      time: ["2026-09-04T06:00:00"],
      cloud_cover_low: [80],
      cloud_cover_mid: [10],
      cloud_cover_high: [10],
      temperature_2m: [10],
      // relative_humidity_2m intentionally missing
      wind_speed_10m: [2],
      precipitation: [0],
    };
    const result = evaluateCloudSeaWindow(MOCK_HIGH_SITE, hourly, [6]);
    expect(result.score).toBeNull();
    expect(result.positionLabel).toBe("数据不足");
    expect(result.summary).toContain("关键云量、湿度、风或降水数据不完整");
  });

"""
if missing_test_anchor not in cloud_test:
    raise SystemExit("cloudsea missing-test anchor missing")
cloud_test = cloud_test.replace(missing_test_anchor, missing_test + missing_test_anchor, 1)
write(cloud_test_path, cloud_test)

fire_test_path = "tests/unit/fireglow.test.ts"
fire_test = read(fire_test_path)
fire_test = fire_test.replace(
    'import { buildFireGlowSnapshot, probabilityRangeFor, scoreFireGlowSite } from "@/lib/fireglow";',
    'import { buildFireGlowSnapshot, isHighFireGlowLevel, probabilityRangeFor, scoreFireGlowSite } from "@/lib/fireglow";',
    1,
)
if 'describe("isHighFireGlowLevel"' not in fire_test:
    fire_test += """

describe("isHighFireGlowLevel", () => {
  it("counts every high presentation tier including subdivided top tiers", () => {
    expect(isHighFireGlowLevel("p80")).toBe(true);
    expect(isHighFireGlowLevel("p88")).toBe(true);
    expect(isHighFireGlowLevel("p95")).toBe(true);
    expect(isHighFireGlowLevel("p100")).toBe(true);
    expect(isHighFireGlowLevel("p60")).toBe(false);
    expect(isHighFireGlowLevel(null)).toBe(false);
  });
});
"""
write(fire_test_path, fire_test)

route_test = r'''import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOUD_SEA_SITES } from "@/lib/cloudseaSites";

function hourlyEntry() {
  const time = ["2026-09-06T05:00", "2026-09-06T06:00", "2026-09-06T07:00", "2026-09-06T08:00"];
  return {
    hourly: {
      time,
      cloud_cover: [80, 82, 84, 80],
      cloud_cover_low: [75, 78, 80, 76],
      cloud_cover_mid: [10, 10, 8, 8],
      cloud_cover_high: [5, 5, 5, 5],
      temperature_2m: [9, 9, 10, 11],
      relative_humidity_2m: [88, 90, 89, 86],
      precipitation: [0, 0, 0, 0],
      visibility: [20000, 20000, 20000, 20000],
      wind_speed_10m: [1.5, 1.7, 1.8, 2.0],
    },
  };
}

function request(query: string) {
  return new NextRequest(`http://localhost/api/cloudsea/snapshot?${query}`);
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/cloudsea/snapshot", () => {
  it("maps AIFS to the real Open-Meteo provider model and uses real RH", async () => {
    let requested = "";
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      requested = String(input);
      return new Response(JSON.stringify(CLOUD_SEA_SITES.map(() => hourlyEntry())), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }));
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-06&model=aifs"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(new URL(requested).searchParams.get("models")).toBe("ecmwf_aifs025_single");
    expect(new URL(requested).searchParams.get("hourly")).toContain("relative_humidity_2m");
    expect(body.source).toContain("Beta");
    const first = Object.values(body.sites)[0] as {
      morning: { humidity: number | null; probabilityLabel: string | null };
    };
    expect(first.morning.humidity).toBeGreaterThan(80);
    expect(first.morning.probabilityLabel).toMatch(/\/100$/);
  });

  it("returns an upstream error instead of fabricated weather when Open-Meteo fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fetchMock = vi.fn(async () => {
      throw new Error("provider unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);
    const { GET } = await import("@/app/api/cloudsea/snapshot/route");
    const response = await GET(request("date=2026-09-07&model=icon"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.sites).toBeUndefined();
    expect(String(body.error)).toContain("provider unavailable");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
'''
write("tests/integration/cloudseaRoute.test.ts", route_test)

integrity_test = r'''import { describe, expect, it } from "vitest";
import fs from "node:fs";

describe("release integrity invariants", () => {
  it("does not ship synthetic cloudsea weather or nearby-disk forecast relabelling", () => {
    const cloudseaRoute = fs.readFileSync("src/app/api/cloudsea/snapshot/route.ts", "utf8");
    const forecastRoute = fs.readFileSync("src/app/api/forecast/route.ts", "utf8");
    expect(cloudseaRoute).not.toContain("generateFallbackWeather");
    expect(cloudseaRoute).not.toContain("using resilient fallback");
    expect(forecastRoute).not.toContain("findNearestDiskForecast");
  });

  it("never labels the selected forecast valid time as the data update time", () => {
    const summary = fs.readFileSync("src/components/workspace/DecisionSummary.tsx", "utf8");
    expect(summary).not.toContain("state.cloudState.activeForecastTime ??");
    expect(summary).toContain("state.forecastAvailability.lastSuccessAt");
  });
});
'''
write("tests/unit/releaseIntegrity.test.ts", integrity_test)

report_path = Path("docs/engineering-change-log/2026-09-06-release-integrity-v1.0.5.md")
report_path.write_text(
    """# 工程修改跟踪：v1.0.5 发布完整性与数据真实性修复

> 基线：`main@d9f8ea12bb09b0a3de734227dbea433ef27077ef`  
> 分支：`fix/release-integrity-v1.0.5`

## 目的

修复 v1.0.4 最终审核发现的发布阻断项：生产依赖高危审计、云海人工天气/AIFS 语义、跨地点磁盘天气借用、火烧云高档位统计与快照年龄、决策摘要更新时间。

## 数据边界

- 云海：不再生成任何人工天气；关键字段不完整即 `score=null`；相对湿度直接使用 Open-Meteo；云底/云顶仍是启发式估算，页面标记 Beta；显示为“条件指数”，不是现场校准概率。
- 火烧云：仍是启发式条件指数映射，新增未校准说明；修复 p88/p95 高档位漏计。
- 普通天气：仅相同请求键可读取 stale 磁盘缓存，不再静默使用百公里内其他地点/模型数据。

## 发布门禁

本分支执行生产依赖审计、`npm run check`、Chromium 全量 E2E、Firefox/WebKit 核心冒烟；全部通过后才提交最终修复。

## 本地 Codex 部署前复核

```bash
git fetch --all --prune
git checkout fix/release-integrity-v1.0.5
git pull --ff-only
npm ci
npm audit --omit=dev --audit-level=high
npm run check
npm run test:e2e
npm run test:e2e:cross-browser
```
""",
    encoding="utf-8",
)
