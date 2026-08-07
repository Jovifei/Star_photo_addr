"use client";

import type { CityCandidate } from "@/lib/types";

/** The 34 featured dark-sky candidate locations. */
export default function CandidateList({
  candidates,
  activeId,
  onPick,
}: {
  candidates: CityCandidate[];
  activeId?: string;
  onPick: (candidate: CityCandidate) => void;
}) {
  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">CANDIDATE SITES</span>
          <h3>精选暗夜候选</h3>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {candidates.length} 个点位
        </span>
      </div>
      <div className="candidate-list" style={{ marginTop: 8 }}>
        {candidates.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            正在加载候选点位…
          </p>
        )}
        {candidates.map((candidate) => (
          <div
            key={candidate.id}
            className={`candidate-row${activeId === candidate.id ? " active" : ""}`}
            onClick={() => onPick(candidate)}
          >
            <div>
              <div className="name">{candidate.name}</div>
              <div className="meta">
                {candidate.province} · {candidate.latitude.toFixed(2)},{" "}
                {candidate.longitude.toFixed(2)}
              </div>
            </div>
            <span className="bortle-chip">B{candidate.bortle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
