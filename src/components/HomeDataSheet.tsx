"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { evaluateNight } from "@/lib/scoring";
import { buildDecisionSummary } from "@/lib/decisionSummary";
import MobileDataSheet from "@/components/MobileDataSheet";
import CloudTimeline from "@/components/CloudTimeline";
import SourcePopover from "@/components/SourcePopover";

export default function HomeDataSheet({ children, compactContent, candidatePane }: {
  children: ReactNode;
  compactContent: ReactNode;
  candidatePane: ReactNode;
}) {
  const { state } = useStore();
  const [sourceOpen, setSourceOpen] = useState(false);
  const sourceButton = useRef<HTMLButtonElement>(null);
  const closeSource = useCallback(() => {
    setSourceOpen(false);
    window.requestAnimationFrame(() => sourceButton.current?.focus({ preventScroll: true }));
  }, []);
  const leadIndex = Math.max(0, state.nightKeys.indexOf(state.selectedNight));
  const evaluation = useMemo(() => {
    if (!state.forecast || state.forecast.metadata?.model !== state.cloudState.model || !state.selectedLocation) return null;
    return evaluateNight(state.forecast, state.selectedLocation, state.selectedNight, leadIndex);
  }, [state.forecast, state.cloudState.model, state.selectedLocation, state.selectedNight, leadIndex]);
  const model = buildDecisionSummary({
    location: state.selectedLocation,
    evaluation,
    loading: state.loading,
    updatedAt: state.forecast?.metadata?.fetchedAt ?? state.forecast?.fetchedAt ?? state.forecastAvailability.lastSuccessAt ?? null,
  });
  const darkSky = state.mapWorkspace === "sites";
  const bortle = state.sample?.bortle;
  const forecastStatus = state.forecastAvailability.error
    ? `${state.forecastAvailability.staleInUse ? "旧预报" : "天气不可用"}：${state.forecastAvailability.error}`
    : state.loading ? "正在读取逐小时预报" : null;

  return <MobileDataSheet
    title={state.selectedLocation?.name ?? (darkSky ? "暗夜选址" : "今夜观测")}
    conclusion={darkSky ? (bortle != null && bortle >= 1 && bortle <= 9 ? `暗空参考 B${bortle} · ${model.gradeLabel}` : `暗空资料未知 · ${model.gradeLabel}`) : model.gradeLabel}
    bestTime={darkSky ? `年度夜光参考 · 今晚窗口 ${model.windowLabel}` : `最佳窗口 ${model.windowLabel}`}
    status={forecastStatus}
    selectionKey={state.selectedLocation?.id ?? null}
  >{(level) => level === "full" ? <>
    <CloudTimeline />{children}
    <section className="mobile-sheet-candidates" aria-label="候选地点对比">{candidatePane}</section>
    <button ref={sourceButton} type="button" className="mobile-sheet-source" aria-haspopup="dialog" aria-expanded={sourceOpen}
      onClick={() => setSourceOpen(true)}>数据依据与局限</button>
    <SourcePopover open={sourceOpen} onClose={closeSource} />
  </> : compactContent}</MobileDataSheet>;
}
