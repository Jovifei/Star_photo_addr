"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { evaluateNight } from "@/lib/scoring";
import { forecastTrustIssue, missingNightInputs } from "@/lib/forecastIntegrity";
import { isInNight } from "@/lib/nighttime";
import { buildDecisionSummary } from "@/lib/decisionSummary";
import { presentRecommendationEligibility, presentSelectedData } from "@/lib/dataPresentation";
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

  const rawForecast = state.forecast;
  const forecast = rawForecast?.metadata?.model === state.cloudState.model
    ? state.forecast
    : null;
  const forecastIssue = forecastTrustIssue(rawForecast, undefined, state.cloudState.model);
  const unavailableReason = useMemo(() => {
    if (forecastIssue) return forecastIssue;
    if (state.forecastAvailability.error) return state.forecastAvailability.error;
    const hours = forecast?.hourly.filter(hour => isInNight(hour.time, state.selectedNight)) ?? [];
    if (!hours.length) return "当前观测夜没有逐小时预报数据，暂不发布推荐。";
    const missing = [...new Set(hours.flatMap(missingNightInputs))];
    return missing.length
      ? `当前观测夜缺${missing.join("、")}，评分数据不足，暂不发布推荐。`
      : "当前观测夜未满足完整评分条件，暂不发布推荐。";
  }, [forecast, forecastIssue, state.forecastAvailability.error, state.selectedNight]);
  const model = buildDecisionSummary({
    location: state.selectedLocation,
    evaluation,
    loading: state.loading,
    unavailableReason,
    hasWeatherFacts: forecast?.locationId === state.selectedLocation?.id && forecast?.hourly.some(hour => [hour.cloudCover, hour.precipitation, hour.windSpeed].some(value => value != null && Number.isFinite(value))),
    updatedAt:
      state.forecast?.metadata?.fetchedAt ??
      state.forecast?.fetchedAt ??
      state.forecastAvailability.lastSuccessAt ??
      null,
  });
  const selectedForecastTime = state.cloudState.activeForecastTime;
  const selectedDataState = presentSelectedData({
    hasLocation: Boolean(state.selectedLocation),
    loading: state.loading,
    hasForecast: Boolean(rawForecast),
    availabilityError: state.forecastAvailability.error,
    staleInUse: state.forecastAvailability.staleInUse,
    forecastIssue,
    hasEvaluation: Boolean(evaluation),
  });
  const recommendationState = presentRecommendationEligibility({
    hasLocation: Boolean(state.selectedLocation),
    loading: state.loading,
    hasForecast: Boolean(forecast),
    hasEvaluation: Boolean(evaluation),
    forecastIssue,
    availabilityError: state.forecastAvailability.error,
  });
  const trustSummary = forecast
    ? `数据依据 · ${forecast.metadata?.model?.toUpperCase() ?? "未知模型"} · ${forecastIssue ?? "查看技术详情"}`
    : "数据依据 · 暂无天气数据";

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
      <div className="decision-data-state" data-testid="decision-data-state" aria-label="当前数据与推荐门禁">
        <div data-testid="selected-data-state" data-state={selectedDataState.code}>
          <span>当前数据</span>
          <strong>{selectedDataState.label}</strong>
          <small>{selectedDataState.detail}</small>
        </div>
        <div data-testid="recommendation-eligibility" data-state={recommendationState.code}>
          <span>推荐门禁</span>
          <strong>{recommendationState.label}</strong>
          <small>{recommendationState.detail}</small>
        </div>
      </div>
      {forecast ? (
        <details className="decision-summary-evidence" data-testid="forecast-evidence-details">
          <summary data-testid="forecast-trust-summary">{trustSummary}</summary>
          <dl className="decision-summary-evidence-grid">
            <div><dt>模型</dt><dd>{forecast.metadata?.model?.toUpperCase() ?? "未知模型"}</dd></div>
            <div><dt>预报时次</dt><dd>{selectedForecastTime ?? "未选择"}</dd></div>
            <div><dt>请求坐标</dt><dd>{forecast.requestedLatitude?.toFixed(3) ?? state.selectedLocation?.latitude.toFixed(3) ?? "—"},{forecast.requestedLongitude?.toFixed(3) ?? state.selectedLocation?.longitude.toFixed(3) ?? "—"}</dd></div>
            <div><dt>模型网格</dt><dd>{forecast.modelLatitude.toFixed(3)},{forecast.modelLongitude.toFixed(3)}</dd></div>
            <div><dt>海拔及来源</dt><dd>{forecast.modelElevation.toFixed(0)}m · {forecast.elevationSource === "provider-dem" ? "供应商 DEM" : forecast.elevationSource ?? "未知来源"}</dd></div>
            <div><dt>距机位</dt><dd>{forecast.modelDistanceKm == null ? "—" : `${forecast.modelDistanceKm.toFixed(1)}km`}</dd></div>
            <div><dt>原始抓取</dt><dd>{forecast.metadata?.sourceFetchedAt ?? forecast.fetchedAt}</dd></div>
            <div><dt>模型运行</dt><dd>{forecast.providerRunAt ?? forecast.metadata?.providerRunAt ?? "供应商未提供"}</dd></div>
          </dl>
        </details>
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
