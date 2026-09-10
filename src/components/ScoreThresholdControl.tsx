"use client";

interface ScoreThresholdControlProps {
  value: number;
  count: number;
  label: string;
  testId: string;
  onChange: (value: number) => void;
}

/** Shared 0–100 score gate for the Fireglow and CloudSea ranked lists. */
export default function ScoreThresholdControl({
  value,
  count,
  label,
  testId,
  onChange,
}: ScoreThresholdControlProps) {
  return (
    <label className="score-threshold-control" data-testid={testId}>
      <span className="score-threshold-control-head">
        <span>{label}</span>
        <strong>≥{value}分</strong>
      </span>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={`${label}（0–100分）`}
        aria-valuetext={`≥${value}分，显示 ${count} 个地点`}
      />
      <small>显示 {count} 个达到门槛的地点</small>
    </label>
  );
}
