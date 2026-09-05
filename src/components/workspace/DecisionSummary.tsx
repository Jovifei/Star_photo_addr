"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { evaluateNight } from "@/lib/scoring";
import { buildDecisionSummary } from "@/lib/decisionSummary";
import type { InspectorTabId } from "@/components/workspace/ContextInspector";

export default function DecisionSummary({
  onJumpToEvidence,
}: {
  onJumpToEvidence?: (tab: InspectorTabId) => void;
}) {
  const { state } = useStore();
  const leadIndex = Math.max(0, state.nightKeys.indexOf(state.selectedNight));
  const evaluation = useMemo(() => {
    if (!state.forecast || !state.selectedLocation) return null;
    return evaluateNight(
      state.forecast,
      state.selectedLocation,
      state.selectedNight,
      leadIndex,
    );
  }, [state.forecast, state.selectedLocation, state.selectedNight, leadIndex]);

  const model = buildDecisionSummary({
    location: state.selectedLocation,
    evaluation,
    loading: state.loading,
    updatedAt:
      state.forecast?.metadata?.fetchedAt ??
      state.forecast?.fetchedAt ??
      state.cloudState.activeForecastTime ??
      null,
  });

  return (
    <section
      className="decision-summary"
      data-testid="observation-reason-card"
      aria-labelledby="decision-summary-title"
    >
      <p className="panel-kicker">今晚判断</p>
      <h2 id="decision-summary-title">{model.locationName ?? "选择一个地点"}</h2>
      <p className={`status-pill ${model.gradeTone}`}>{model.gradeLabel}</p>
      <dl>
        <div>
          <dt>最佳窗口</dt>
          <dd>{model.windowLabel}</dd>
        </div>
        <div>
          <dt>{model.riskTitle}</dt>
          <dd>{model.riskText}</dd>
        </div>
        <div>
          <dt>更新时间</dt>
          <dd>{model.updatedLabel}</dd>
        </div>
      </dl>
      {onJumpToEvidence ? (
        <button
          type="button"
          className="text-button"
          onClick={() => onJumpToEvidence("settings")}
        >
          查看图层与数据源
        </button>
      ) : null}
    </section>
  );
}
