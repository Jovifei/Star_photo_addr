"use client";

/** Conic-gradient score ring. */
export default function ScoreRing({
  value = 0,
  label,
}: {
  value?: number;
  label: string;
}) {
  const safe = Number.isFinite(value) ? value : 0;
  return (
    <div
      className="score-ring"
      style={{ "--score": `${safe * 3.6}deg` } as React.CSSProperties}
    >
      <div>
        <strong>{safe}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
