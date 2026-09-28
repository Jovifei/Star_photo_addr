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
  if (facts.staleInUse || isStaleIssue(facts.forecastIssue)) {
    return {
      code: "stale",
      label: "数据已过期/降级",
      detail: facts.forecastIssue ?? "当前使用最近成功数据，不能发布新鲜推荐",
      tone: "warn",
    };
  }
  if (facts.forecastIssue) {
    return { code: "invalid", label: "数据身份不匹配", detail: facts.forecastIssue, tone: "bad" };
  }
  if (!facts.hasEvaluation) {
    return { code: "partial", label: "数据部分可用", detail: "当前观测夜未形成完整可评分结果", tone: "warn" };
  }
  return { code: "ready", label: "当前数据完整", detail: "当前地点、模型和观测夜数据可用于评分", tone: "good" };
}

export function presentRecommendationEligibility(facts: RecommendationFacts): PresentationState {
  if (!facts.hasLocation || (facts.loading && !facts.hasForecast)) {
    return { code: "waiting", label: "等待数据", detail: "选择地点并完成数据读取后检查推荐门禁", tone: "neutral" };
  }
  if (facts.hasEvaluation && !facts.forecastIssue) {
    return { code: "eligible", label: "已通过推荐数据门禁", detail: "后续判断仍由今晚状态与评分结果决定", tone: "good" };
  }
  return {
    code: "withheld",
    label: "不发布推荐",
    detail: facts.forecastIssue ?? facts.availabilityError ?? "当前观测夜未通过完整评分门禁",
    tone: "warn",
  };
}
