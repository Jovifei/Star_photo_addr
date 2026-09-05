"use client";

import { useEffect } from "react";
import { X, History, Sparkles, ShieldCheck, Mountain, Layers, CloudSun } from "lucide-react";

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

const VERSIONS = [
  {
    version: "v1.0.0",
    date: "2026-09-05",
    tag: "里程碑正式版",
    current: true,
    highlights: [
      {
        icon: Sparkles,
        title: "深空双倒角悬浮舱体统一",
        desc: "火烧云与云海工作台全面统一对齐为「深空观测站·双倒角悬浮舱体」设计规范（四周留白、14px 倒角微青微光边框、柔和环境光阴影）。",
      },
      {
        icon: ShieldCheck,
        title: "快照装甲保护与抗限流雪崩",
        desc: "服务端引入快照覆盖防劣化校验，上游 429 时坚决保护离线有效快照；前端移除自动静默重刷，彻底消除全站数据变灰。",
      },
      {
        icon: Mountain,
        title: "名山海拔推导与近邻气象保底",
        desc: "内置太子尖(1557m)、牵牛岗(1490m)、天荒坪(980m)、牛背山(3660m)等高程词典与 120km 空间近邻容灾，修复海拔0m与429报错。",
      },
      {
        icon: Layers,
        title: "星空窗口表格粘性固定",
        desc: "表格首列地点名 Sticky 粘性固定，横向滚屏绝不裁切地名，无数据点位优雅保底显示。",
      },
      {
        icon: CloudSun,
        title: "UI 重叠与裁切修复",
        desc: "解除地图顶部药丸工具栏与提示横幅空间重叠，修复云海图例左侧文字裁切，移除多余暗框。",
      },
    ],
  },
  {
    version: "v0.3.1",
    date: "2026-08-30",
    tag: "观测评分系统",
    current: false,
    highlights: [
      {
        icon: Layers,
        title: "242处核心景点气象预报",
        desc: "集成全国星空胜地与暗夜公园逐小时气象与多模式评分预测。",
      },
      {
        icon: Sparkles,
        title: "云海局地光晕模型",
        desc: "优化云海概率余弦衰减光晕，消除平原大色块。",
      },
    ],
  },
  {
    version: "v0.2.0",
    date: "2026-08-20",
    tag: "暗夜与光污染",
    current: false,
    highlights: [
      {
        icon: ShieldCheck,
        title: "波特尔与天顶亮度模型",
        desc: "引入 MPSAS 与 Bortle 等级先验推算模型，支持夜光环境评估。",
      },
    ],
  },
  {
    version: "v0.1.0",
    date: "2026-08-10",
    tag: "初始原型构建",
    current: false,
    highlights: [
      {
        icon: Sparkles,
        title: "星空观测规划器立项",
        desc: "搭建 Next.js 全栈框架与 Leaflet 专业天文观测底图交互底座。",
      },
    ],
  },
];

export default function ChangelogModal({ open, onClose }: ChangelogModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="changelog-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="changelog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="changelog-modal-header">
          <div className="changelog-modal-title-wrap">
            <History size={18} className="changelog-icon" aria-hidden="true" />
            <div>
              <h2 id="changelog-title" className="changelog-modal-title">版本更新记录</h2>
              <span className="changelog-modal-sub">Star Weather Planner 版本历程与演进日志</span>
            </div>
          </div>
          <button
            type="button"
            className="changelog-modal-close"
            onClick={onClose}
            aria-label="关闭更新日志"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="changelog-modal-body">
          {VERSIONS.map((item) => (
            <section key={item.version} className={`changelog-release${item.current ? " is-current" : ""}`}>
              <div className="changelog-release-head">
                <div className="changelog-release-badge">
                  <span className="changelog-version-num">{item.version}</span>
                  {item.current && <span className="changelog-current-pill">当前版本</span>}
                  <span className="changelog-tag-pill">{item.tag}</span>
                </div>
                <time className="changelog-date">{item.date}</time>
              </div>

              <div className="changelog-highlights">
                {item.highlights.map((h, idx) => {
                  const IconComp = h.icon;
                  return (
                    <div key={idx} className="changelog-item">
                      <div className="changelog-item-icon">
                        <IconComp size={14} aria-hidden="true" />
                      </div>
                      <div className="changelog-item-text">
                        <strong>{h.title}</strong>
                        <p>{h.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="changelog-modal-footer">
          <span>详细日志见本地 <code>CHANGELOG.md</code> 文档</span>
          <button type="button" className="changelog-btn-ok" onClick={onClose}>
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
}
