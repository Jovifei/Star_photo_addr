"use client";

import type { NightEvaluation } from "@/lib/types";

/** "今晚判断依据" — three-element decision summary. */
export default function DecisionBrief({
  evaluation,
}: {
  evaluation: NightEvaluation | null;
}) {
  const windowOk = (evaluation?.window.length ?? 0) >= 2;
  const hasBlockers = (evaluation?.blockers.length ?? 0) > 0;

  return (
    <div className="panel-section">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">决策摘要</span>
          <h3>今晚判断依据</h3>
        </div>
      </div>
      <div className="decision-item" style={{ marginTop: 8 }}>
        <span className={`decision-dot${windowOk ? "" : ""}`} />
        <div>
          <strong>{windowOk ? "连续窗口成立" : "连续窗口不足"}</strong>
          <p>{evaluation?.windowLabel ?? "暂无连续窗口"}</p>
        </div>
      </div>
      <div className="decision-item">
        <span className={`decision-dot ${hasBlockers ? "" : ""}`} />
        <div>
          <strong>
            {hasBlockers ? "存在天气门禁" : "无主要安全门禁"}
          </strong>
          <p>
            {evaluation?.blockers.join("、") ||
              "未触发雷暴、强降水、低能见度或大阵风门禁"}
          </p>
        </div>
      </div>
      <div className="decision-item info">
        <span className="decision-dot" />
        <div>
          <strong>置信度：{evaluation?.confidence.level ?? "—"}</strong>
          <p>{evaluation?.confidence.reason ?? "等待数据"}</p>
        </div>
      </div>
      <p
        style={{
          fontSize: 11,
          color: "var(--muted)",
          marginTop: 8,
          lineHeight: 1.6,
        }}
      >
        14 天用于看趋势；最终出发前请在 72 小时内再次刷新，并核对道路和现场云况。
      </p>
    </div>
  );
}
