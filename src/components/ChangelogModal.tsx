"use client";

import { useEffect } from "react";
import { X, History, Sparkles, ShieldCheck, Mountain, Layers, CloudSun } from "lucide-react";

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

const VERSIONS = [
  {
    version: "v1.0.2",
    date: "2026-09-05",
    tag: "观星计划全景整合与导航精简",
    current: true,
    highlights: [
      {
        icon: Sparkles,
        title: "精简顶栏导航为 4 大核心支柱",
        desc: "彻底剔除功能重合的「观星计划」独立栏目，精简导航为「今夜观测 | 暗夜选址 | 火烧云 | 云海」，访问 /planner 自动平滑重定向至主工作台。",
      },
      {
        icon: CloudSun,
        title: "逐小时天气与云量走势图",
        desc: "地点详情舱集成高分辨率走势图，直观展现总云量、低云、降水概率与阵风走势，并提供快捷时次切换芯片。",
      },
      {
        icon: Layers,
        title: "日月与银河核心高度轨迹图",
        desc: "可视化呈现整夜太阳、月亮与银河中心的高度角轨迹曲线，精确掌握暗夜窗口与天体升落时刻。",
      },
      {
        icon: Mountain,
        title: "高山低云垂直剖面与海拔层位分析",
        desc: "联动高空气压层推导各高度云层厚度，自动研判站点与云层的“云上/云中/云下”层位关系，精准辅助高山云海与星空选址。",
      },
    ],
  },
  {
    version: "v1.0.1",
    date: "2026-09-05",
    tag: "候选7天排行与详情舱",
    current: false,
    highlights: [
      {
        icon: Sparkles,
        title: "候选地点 · 7天分数动态排行榜",
        desc: "左侧边栏升级为 7 天卡片式动态排行榜，支持顶部横向切换各夜次并自动降序重排，展示金银铜名次徽章、天气指标与 7 天微缩胶囊条。",
      },
      {
        icon: ShieldCheck,
        title: "右侧设置面板去重与纯化",
        desc: "彻底移除右侧设置面板中重复的云图/光污染与星空/云海悬浮开关，纯化为「地点详情舱」与「图层与偏好」两大专业面板。",
      },
      {
        icon: Mountain,
        title: "地点详情舱与逐小时气象矩阵",
        desc: "点击地图或搜索任一地点，右侧集中呈现最佳连续可用窗口、月相照度、暗夜时长、银河最高高度角与逐小时气象详情。",
      },
      {
        icon: Layers,
        title: "一键加入候选与双向联动闭环",
        desc: "右侧提供显眼的「+ 加入候选对比」主按钮，一键收纳地点至左侧 7 天排行榜参与综合排序，支持本地持久化保存。",
      },
    ],
  },
  {
    version: "v1.0.0",
    date: "2026-09-05",
    tag: "里程碑正式版",
    current: false,
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
