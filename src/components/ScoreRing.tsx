"use client";

/** Conic-gradient score ring. */
export function scoreRingValue(value?: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
    ? value : null;
}

export default function ScoreRing({
  value,
  label,
}: {
  value?: number | null;
  label: string;
}) {
  const safe = scoreRingValue(value);
  return (
    <div
      className="score-ring"
      role="img"
      aria-label={`${label}：${safe == null ? '暂无评分' : `${safe}/100`}`}
      style={{ "--score": `${(safe ?? 0) * 3.6}deg` } as React.CSSProperties}
    >
      <div>
        <strong>{safe ?? '—'}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
