"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { evaluateNight } from "@/lib/scoring";
import { forecastTrustIssue } from "@/lib/forecastIntegrity";
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
    if (
      !state.forecast ||
      state.forecast.metadata?.model !== state.cloudState.model ||
      !state.selectedLocation
    ) return null;
    return evaluateNight(
      state.forecast,
      state.selectedLocation,
      state.selectedNight,
      leadIndex,
    );
  }, [state.cloudState.model, state.forecast, state.selectedLocation, state.selectedNight, leadIndex]);

  const model = buildDecisionSummary({
    location: state.selectedLocation,
    evaluation,
    loading: state.loading,
    updatedAt:
      state.forecast?.metadata?.fetchedAt ??
      state.forecast?.fetchedAt ??
      state.forecastAvailability.lastSuccessAt ??
      null,
  });
  const forecast = state.forecast?.metadata?.model === state.cloudState.model
    ? state.forecast
    : null;
  const forecastIssue = forecastTrustIssue(forecast, undefined, state.cloudState.model);
  const selectedForecastTime = state.cloudState.activeForecastTime;

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
      {forecast ? (
        <p className="decision-summary-provenance" data-testid="forecast-provenance">
          数据身份：{forecast.metadata?.model?.toUpperCase() ?? "未知模型"} · 预报时次 {selectedForecastTime ?? "未选择"} ·
          请求 {forecast.requestedLatitude?.toFixed(3) ?? state.selectedLocation?.latitude.toFixed(3) ?? "—"},{forecast.requestedLongitude?.toFixed(3) ?? state.selectedLocation?.longitude.toFixed(3) ?? "—"} ·
          网格 {forecast.modelLatitude.toFixed(3)},{forecast.modelLongitude.toFixed(3)} ·
          海拔 {forecast.modelElevation.toFixed(0)}m（{forecast.elevationSource === "provider-dem" ? "供应商 DEM" : forecast.elevationSource ?? "未知来源"}） ·
          距机位 {forecast.modelDistanceKm == null ? "—" : `${forecast.modelDistanceKm.toFixed(1)}km`} ·
          原始抓取 {forecast.metadata?.sourceFetchedAt ?? forecast.fetchedAt} ·
          模型运行 {forecast.providerRunAt ?? forecast.metadata?.providerRunAt ?? "供应商未提供"} ·
          {forecastIssue ? `质量：${forecastIssue}` : "质量：可用；多模型核验：未检查"}
        </p>
      ) : null}
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
