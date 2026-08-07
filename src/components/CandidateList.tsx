"use client";

import type { CityCandidateStatus } from "@/data/cities";
import type { CityCandidate } from "@/lib/types";

const EMPTY_TEXT: Record<Exclude<CityCandidateStatus, "ok">, string> = {
  loading: "正在加载候选点位…",
  empty: "候选点位数据为空。",
  unavailable:
    "暂无候选点位数据：本地候选清单未随仓库分发（许可未确认）。可点击地图任意位置取样。",
};

/** The featured dark-sky candidate locations, with an explicit no-data state. */
export default function CandidateList({
  candidates,
  status,
  activeId,
  onPick,
}: {
  candidates: CityCandidate[];
  status: CityCandidateStatus;
  activeId?: string;
  onPick: (candidate: CityCandidate) => void;
}) {
  const hasRows = status === "ok" && candidates.length > 0;

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">CANDIDATE SITES</span>
          <h3>精选暗夜候选</h3>
        </div>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {hasRows ? `${candidates.length} 个点位` : "无数据"}
        </span>
      </div>
      <div className="candidate-list" style={{ marginTop: 8 }}>
        {!hasRows && (
          <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            {EMPTY_TEXT[status as Exclude<CityCandidateStatus, "ok">]}
          </p>
        )}
        {hasRows &&
          candidates.map((candidate) => (
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
              {/* bortle === 0 means the source row carried no usable class. */}
              <span className="bortle-chip">
                {candidate.bortle > 0 ? `B${candidate.bortle}` : "—"}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
