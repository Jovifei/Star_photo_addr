import type { DataSourceProbe } from "@/lib/dataSourceStatus";

export type PresentationTone = "neutral" | "loading" | "good" | "warn" | "bad";

export interface PresentationState {
  code: string;
  label: string;
  detail: string;
  tone: PresentationTone;
}

export interface SelectedDataFacts {
  hasLocation: boolean;
  loading: boolean;
  hasForecast: boolean;
  availabilityError: string | null;
  staleInUse: boolean;
  forecastIssue: string | null;
  hasEvaluation: boolean;
}

export interface RecommendationFacts {
  hasLocation: boolean;
  loading: boolean;
  hasForecast: boolean;
  hasEvaluation: boolean;
  forecastIssue: string | null;
  availabilityError: string | null;
}

export interface HourlyDataFacts {
  hasSource: boolean;
  stale: boolean;
  hasHour: boolean;
  missingFields: string[];
}

export interface MapRecommendationFacts {
  loading: boolean;
  requestFailed: boolean;
  hasSnapshot: boolean;
  stale: boolean;
  publishableCount: number;
}

export function presentProviderHealth(source?: DataSourceProbe): PresentationState {
  if (!source) {
    return { code: "loading", label: "检测中", detail: "正在读取数据源状态", tone: "loading" };
  }
  if (source.status === "available") {
    return { code: "available", label: "上游检测可用", detail: source.detail, tone: "good" };
  }
  if (source.status === "degraded") {
    return { code: "degraded", label: "上游检测降级", detail: source.detail, tone: "warn" };
  }
  if (source.status === "unconfigured") {
    return { code: "unconfigured", label: "未配置（可选）", detail: source.detail, tone: "neutral" };
  }
  return { code: "not-installed", label: "未安装（可选）", detail: source.detail, tone: "neutral" };
}

function isStaleIssue(issue: string | null): boolean {
  return Boolean(issue && /过期|降级|超过\s*6\s*小时|抓取时间/.test(issue));
}

export function presentSelectedData(facts: SelectedDataFacts): PresentationState {
  if (!facts.hasLocation) {
    return { code: "idle", label: "选择地点", detail: "选择地点后检查数据", tone: "neutral" };
  }
  if (facts.loading && !facts.hasForecast) {
    return { code: "loading", label: "读取中", detail: "正在读取当前地点数据", tone: "loading" };
  }
  if (!facts.hasForecast) {
    return {
      code: "unavailable",
      label: "当前数据不可用",
      detail: facts.availabilityError ?? "当前地点没有可用的预报数据",
      tone: "bad",
    };
  }
  if (facts.forecastIssue) {
    if (!isStaleIssue(facts.forecastIssue)) {
      return { code: "invalid", label: "数据身份不匹配", detail: facts.forecastIssue, tone: "bad" };
    }
    return {
      code: "stale",
      label: "数据已过期/降级",
      detail: facts.forecastIssue ?? "当前使用最近成功数据，不能发布新鲜推荐",
      tone: "warn",
    };
  }
  if (facts.staleInUse) return { code: "stale", label: "数据已过期/降级", detail: "当前使用最近成功数据，不能发布新鲜推荐", tone: "warn" };
  if (!facts.hasEvaluation) {
    return { code: "partial", label: "数据部分可用", detail: "当前观测夜未形成完整可评分结果", tone: "warn" };
  }
  return { code: "ready", label: "当前数据完整", detail: "当前地点、模型和观测夜数据可用于评分", tone: "good" };
}

export function presentRecommendationEligibility(facts: RecommendationFacts): PresentationState {
  if (!facts.hasLocation || (facts.loading && !facts.hasForecast)) {
    return { code: "waiting", label: "等待数据", detail: "选择地点并完成数据读取后检查推荐门禁", tone: "neutral" };
  }
  if (facts.hasEvaluation && !facts.forecastIssue && !facts.availabilityError) {
    return { code: "eligible", label: "已通过推荐数据门禁", detail: "后续判断仍由今晚状态与评分结果决定", tone: "good" };
  }
  return {
    code: "withheld",
    label: "不发布推荐",
    detail: facts.forecastIssue ?? facts.availabilityError ?? "当前观测夜未通过完整评分门禁",
    tone: "warn",
  };
}

export function presentHourlyDataValidity(facts: HourlyDataFacts): PresentationState {
  if (!facts.hasSource) {
    return { code: "unavailable", label: "当前数据不可用", detail: "当前时次没有有效预报", tone: "bad" };
  }
  if (facts.stale) {
    return { code: "stale", label: "数据已过期/降级", detail: "当前时次使用过期数据，不发布推荐", tone: "warn" };
  }
  if (!facts.hasHour) {
    return { code: "partial", label: "数据部分可用", detail: "当前时次没有完整天气字段", tone: "warn" };
  }
  if (facts.missingFields.length) {
    return { code: "partial", label: "数据部分可用", detail: `评分字段缺失：${facts.missingFields.join("、")}`, tone: "warn" };
  }
  return { code: "ready", label: "当前数据完整", detail: "当前时次评分字段完整", tone: "good" };
}

export function presentMapRecommendationEligibility(facts: MapRecommendationFacts): PresentationState {
  if (facts.loading) {
    return { code: "waiting", label: "等待数据", detail: "正在按此时次刷新地点评分", tone: "loading" };
  }
  if (facts.requestFailed || !facts.hasSnapshot || facts.stale || facts.publishableCount <= 0) {
    const detail = facts.stale
      ? "评分数据已过期/降级；灰色未知地点仍保持数据不足"
      : facts.requestFailed
        ? "当前时次评分暂不可用；灰色未知地点不等同于低分"
        : "当前时次没有有效分数；灰色未知地点不等同于低分";
    return { code: "withheld", label: "不发布推荐", detail, tone: "warn" };
  }
  return {
    code: "eligible",
    label: "已通过推荐数据门禁",
    detail: `仅有有效分数的地点可发布判断；当前 ${facts.publishableCount} 个地点有有效分数，灰色未知地点仍保持数据不足`,
    tone: "good",
  };
}
