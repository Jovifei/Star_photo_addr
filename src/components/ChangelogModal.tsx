"use client";

import { useEffect } from "react";
import { X, History, Sparkles, ShieldCheck, Mountain, Layers, CloudSun } from "lucide-react";
import { APP_VERSION_LABEL } from "@/lib/appVersion";

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
}

const VERSIONS = [
  {
    version: APP_VERSION_LABEL,
    date: "2026-09-09",
    tag: "热门摄影地点扩展",
    current: true,
    highlights: [
      {
        icon: Mountain,
        title: "舟山海岛机位扩展",
        desc: "新增朱家尖大青山猫跳、东极岛庙子湖、枸杞岛山海奇观、嵊山岛东崖绝壁与花鸟岛前坑顶 5 个海岛摄影候选。",
      },
      {
        icon: CloudSun,
        title: "银河与晚霞边界",
        desc: "按公开观星、文旅与地图 POI 资料记录银河、日出、日落和海岸构图方向；不把目录 Bortle 当作现场暗空测量。",
      },
      {
        icon: Layers,
        title: "默认精选更实用",
        desc: "首页默认候选从 10 个扩展为 11 个，加入大青山猫跳并保留候选加入空间；保留用户 LocalStorage 候选。",
      },
      {
        icon: ShieldCheck,
        title: "海岛出行边界",
        desc: "候选说明补充船期、海况、潮汐、夜间开放、清场、灯光和绝壁/步道风险，出发前需核对景区与客运公告。",
      },
    ],
  },
  {
    version: "v1.0.7",
    date: "2026-09-09",
    tag: "舟山海岛机位扩展",
    current: false,
    highlights: [
      {
        icon: Mountain,
        title: "云海点位扩展",
        desc: "CloudSea 新增 10 个有公开景区资料支持的山顶、梯田与云海观景点，压力层接口仍按同一契约计算。",
      },
      {
        icon: CloudSun,
        title: "晚霞与星空选址扩展",
        desc: "补充东山岛、霞浦东壁、涠洲岛、东极岛、四姑娘山、元阳与景迈山等热门摄影候选。",
      },
      {
        icon: Layers,
        title: "默认精选更实用",
        desc: "首页默认候选从 4 个扩展为 10 个，保留用户 LocalStorage 候选，不把目录 Bortle 当作实时测量。",
      },
      {
        icon: ShieldCheck,
        title: "夜间时次选择稳定",
        desc: "矩阵选中评分窗口之前但属于当前夜间的时次时，不再被当前小时自动回弹。",
      },
      {
        icon: ShieldCheck,
        title: "生产依赖已加固",
        desc: "升级 Next.js、sharp 与传递依赖，生产依赖审计不再报告高风险漏洞。",
      },
    ],
  },
  {
    version: "v1.0.6",
    date: "2026-09-08",
    tag: "生产验收一致性 Hotfix",
    current: false,
    highlights: [
      {
        icon: ShieldCheck,
        title: "版本来源统一",
        desc: "顶栏、健康接口和版本记录统一读取 package.json 的唯一版本源。",
      },
      {
        icon: CloudSun,
        title: "无数据语义收口",
        desc: "CloudSea 与 Fireglow 的无数据点位使用独立 muted 状态，不再视觉上冒充最低条件等级。",
      },
      {
        icon: Layers,
        title: "边界请求 fail-closed",
        desc: "移除不可靠的 DataV 自动行政边界 fallback，并同步生产数据源与 CloudSea pressure-level 文档。",
      },
    ],
  },
  {
    version: "v1.0.5",
    date: "2026-09-06",
    tag: "发布完整性与数据真实性修复",
    current: false,
    highlights: [
      {
        icon: ShieldCheck,
        title: "数据真实性优先",
        desc: "删除云海人工天气兜底，修复 AIFS 模型映射、跨地点天气缓存借用和火烧云快照年龄；关键数据缺失时明确降级。",
      },
      {
        icon: CloudSun,
        title: "云海条件指数 Beta",
        desc: "使用真实 Open-Meteo 相对湿度，将未校准的概率语义降级为条件指数；云底与云顶来自 pressure-level model profile，并明确标注为模式推导。",
      },
      {
        icon: Layers,
        title: "发布门禁恢复",
        desc: "更新高风险传递依赖并恢复生产依赖审计，补齐云海、火烧云与缓存来源的回归测试。",
      },
    ],
  },
  {
    version: "v1.0.4",
    date: "2026-09-06",
    tag: "统一工作台契约与版本追踪修复",
    current: false,
    highlights: [
      {
        icon: Layers,
        title: "统一工作台回归契约",
        desc: "E2E 覆盖已迁移到当前「地点详情 / 图层与偏好」检查器、移动端地图工具抽屉、Planner 兼容跳转与暗夜选址 B1–B4 筛选条。",
      },
      {
        icon: ShieldCheck,
        title: "版本与部署状态可追溯",
        desc: "健康接口在生产环境直接读取应用包版本，顶栏版本徽标、锁文件和部署构建版本保持一致。",
      },
      {
        icon: CloudSun,
        title: "降级与重试回归稳定",
        desc: "天气 HTTP 429 的故障注入按目标地点隔离，并验证人工重试后恢复真实逐小时数据。",
      },
    ],
  },
  {
    version: "v1.0.3",
    date: "2026-09-06",
    tag: "火烧云与云海专属摄影地点详情舱",
    current: false,
    highlights: [
      {
        icon: Sparkles,
        title: "高山剖面标尺图与暮光全光谱色轴",
        desc: "彻底告别纯文字罗列！云海详情舱内置「山峰峰顶 vs 预估云顶/云底」立体剖面示意图与落差引线；火烧云详情舱配备金色时刻/蓝色时刻横向光谱色谱时间轴，直观锁定最佳摄影窗口。",
      },
      {
        icon: Mountain,
        title: "360° 罗盘微仪表盘与成海指示条",
        desc: "独家内置 SVG 动态罗经微仪表盘，精准旋转指向日出/日落实地地平方位角；集成水汽充沛度、层位落差度与风力聚海度三维微指示条，一眼洞悉成海气象条件。",
      },
      {
        icon: Layers,
        title: "便当盒（Bento Grid）摄影速查方案",
        desc: "重构实拍机位长文为模块化速查卡片：推荐机位胶囊、广角/长焦镜头搭配、GND/ND滤镜参数、最佳窗口与撤机时机提醒，告别阅读负担。",
      },
    ],
  },
  {
    version: "v1.0.2",
    date: "2026-09-05",
    tag: "观星计划全景整合与导航精简",
    current: false,
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
      {
        icon: ShieldCheck,
        title: "地图悬浮开关纯化与开屏默认治理",
        desc: "彻底移除地图中央多余的「星空/云海」切换药丸，仅保留「云图/光污染」；进入「今夜观测」默认恒定为星空云量图层，进入「暗夜选址」恒定呈现光污染底图，杜绝状态串扰。",
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
