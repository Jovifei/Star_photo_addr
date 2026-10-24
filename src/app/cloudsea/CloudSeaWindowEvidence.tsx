import type { CloudSeaWindowScore } from "@/lib/cloudsea";

/** Window coverage and peak describe different facts; neither is a probability. */
export default function CloudSeaWindowEvidence({ window: win }: { window: CloudSeaWindowScore }) {
  const coverage = win.coverage;
  const hasCoverage = coverage && coverage.expectedHours > 0;
  return (
    <span className="cloudsea-card-evidence" data-testid="cloudsea-window-evidence">
      {win.score == null && hasCoverage ? "窗口覆盖不足 · " : ""}
      {hasCoverage
        ? `天气 ${coverage.surfaceValidHours}/${coverage.expectedHours} 时 · 可评分 ${coverage.scoreableHours}/${coverage.expectedHours} 时`
        : "覆盖时次未知"}
      {win.peakTime && win.peakScore != null && Number.isFinite(win.peakScore)
        ? ` · 最佳 ${win.peakTime} · ${win.peakScore}/100`
        : null}
    </span>
  );
}
