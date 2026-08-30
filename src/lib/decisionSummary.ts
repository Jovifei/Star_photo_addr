import { statusMeta } from "@/lib/scoring";
import type { Location, NightEvaluation } from "@/lib/types";

export type DecisionSummaryKind = "empty" | "unknown" | "ready";

export interface DecisionSummaryModel {
  kind: DecisionSummaryKind;
  locationName: string | null;
  gradeLabel: string;
  gradeTone: "good" | "warn" | "bad" | "muted";
  windowLabel: string;
  riskTitle: string;
  riskText: string;
  updatedLabel: string;
}

export function buildDecisionSummary(input: {
  location: Location | null;
  evaluation: NightEvaluation | null;
  loading: boolean;
  updatedAt: string | null;
}): DecisionSummaryModel {
  const updatedLabel = formatUpdatedLabel(input.updatedAt);

  if (!input.location) {
    return {
      kind: "empty",
      locationName: null,
      gradeLabel: "未选地点",
      gradeTone: "muted",
      windowLabel: "—",
      riskTitle: "选点引导",
      riskText: "点击地图任意位置，或搜索城市，开始读取暗夜与天气。未选地点时不产生今晚结论。",
      updatedLabel,
    };
  }

  if (input.loading || !input.evaluation) {
    return {
      kind: "unknown",
      locationName: input.location.name,
      gradeLabel: "数据不足",
      gradeTone: "muted",
      windowLabel: "—",
      riskTitle: "评分未知",
      riskText: "当前没有可用的夜间评分，显示为数据不足，不用「一般」代替。",
      updatedLabel,
    };
  }

  const meta = statusMeta(input.evaluation.status);
  const blockers = input.evaluation.blockers.filter(Boolean);
  const hasBlockers = blockers.length > 0;

  return {
    kind: "ready",
    locationName: input.location.name,
    gradeLabel: meta.label,
    gradeTone: meta.tone as DecisionSummaryModel["gradeTone"],
    windowLabel: input.evaluation.windowLabel || "暂无连续窗口",
    riskTitle: hasBlockers ? "主要风险" : "未见已接入门禁",
    riskText: hasBlockers
      ? blockers.join("、")
      : "未出现已接入的降水、低能见度或大阵风门禁。雷暴以当地气象预警为准，不在此写成安全或无雷暴。",
    updatedLabel,
  };
}

function formatUpdatedLabel(iso: string | null): string {
  if (!iso) return "尚未更新";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "尚未更新";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}
