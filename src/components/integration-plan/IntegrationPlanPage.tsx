import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Cloud,
  Database,
  Layers3,
  Map,
  Satellite,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import styles from "./integration-plan.module.css";

type AuditStatus = "已覆盖" | "主动排除" | "下一步";

interface AuditRow {
  title: string;
  status: AuditStatus;
  target: string;
  current: string;
  next?: string;
}

const auditRows: AuditRow[] = [
  { title: "地图与光污染图层", status: "已覆盖", target: "Leaflet、VIIRS 2023、暗色底图、省界与地点标记", current: "已接入 242 个地点和 35 个省界；VIIRS 失败自动降级基础底图" },
  { title: "筛选与搜索", status: "已覆盖", target: "Bortle 1–4、标签模式、摄影/肉眼、地点与日期", current: "筛选、搜索结果、今晚及未来 4 天均已联动地图和统计" },
  { title: "天气与评分", status: "已覆盖", target: "33 小时 Open-Meteo、分层云量、降水、风、评级", current: "同源 API、空值 `—`、陈旧/错误状态和评分风险链已统一" },
  { title: "地点详情与复查", status: "已覆盖", target: "底部详情、逐小时表、图表、风险、复查", current: "详情支持上下拖动、内部滚动、复查清单和数据状态" },
  { title: "导出", status: "已覆盖", target: "全部地点与符合条件的 Excel 导出", current: "无依赖 Excel 兼容 `.xls`，包含摘要和完整逐小时字段", next: "后续可换原生 `.xlsx` 多工作表" },
  { title: "访问量与统计脚本", status: "主动排除", target: "目标站访问量和第三方统计", current: "按需求删除，不进入逐星产品，也不接入 Cloudflare Beacon" },
  { title: "目标站搜索弹窗与细节动画", status: "下一步", target: "原站独立搜索弹窗、更多微交互", current: "当前使用同源内联搜索，业务结果一致；视觉微交互仍可继续细化" },
];

const phases = [
  { number: "01", title: "统一领域模型", detail: "已将地点、夜晚、模型、时次、天气状态和来源元数据收敛到共享观测会话。", files: "src/lib/store.tsx · src/lib/observingSites.ts" },
  { number: "02", title: "统一数据快照", detail: "已通过同源网关和 30 分钟快照统一地图评分与未来 1/3/5/7 夜决策。", files: "src/app/api/observing/snapshot · scripts/observing-snapshot-worker.mjs" },
  { number: "03", title: "两页产品闭环", detail: "观星地图负责全国选点与图层分析，星野决策负责候选地点的多夜比较。", files: "/ · /planner" },
  { number: "04", title: "发布候选收敛", detail: "旧地点查询、VIIRS 和 sites 地址保留兼容重定向；当前重点是全量回归、数据新鲜度和部署健康。", files: "/stargazing-finder-dark · /viirs · /sites" },
];

function StatusIcon({ status }: { status: AuditStatus }) {
  if (status === "已覆盖") return <CheckCircle2 size={16} aria-hidden="true" />;
  if (status === "主动排除") return <ShieldCheck size={16} aria-hidden="true" />;
  return <CircleDashed size={16} aria-hidden="true" />;
}

export default function IntegrationPlanPage() {
  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandIcon}><Telescope size={18} aria-hidden="true" /></span>
          <span><strong>逐星</strong><small>产品合并方案</small></span>
        </Link>
        <nav className={styles.nav} aria-label="产品入口">
          <Link href="/">逐星</Link>
          <Link href="/planner">星野决策</Link>
        </nav>
        <span className={styles.live}><i />当前方案 · 可执行</span>
      </header>

      <div className={styles.content}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>INTEGRATION BLUEPRINT · 2026.08</p>
            <h1>两个页面，<em>一个观测闭环</em></h1>
            <p className={styles.lead}>全国地点、卫星云图与光污染在观星地图完成筛选；加入候选后进入星野决策比较今晚及未来 3/5/7 夜。两页共用地点、时间、模型、评分和数据新鲜度。</p>
            <div className={styles.heroActions}>
              <Link href="/" className={styles.primaryAction}>打开观星地图 <ArrowRight size={15} /></Link>
              <Link href="/planner" className={styles.secondaryAction}>查看星野决策</Link>
            </div>
          </div>
          <div className={styles.heroSignal} aria-label="当前复刻状态">
            <span className={styles.signalLabel}>当前结论</span>
            <strong>核心业务已覆盖</strong>
            <p>不是逐字节复制：访问量、第三方统计和目标站私有后端按要求不接入。</p>
            <div className={styles.signalLine}><span style={{ width: "86%" }} /></div>
            <small>功能覆盖审计 · 7 个领域项</small>
          </div>
        </section>

        <section className={styles.metrics} aria-label="产品合并指标">
          <div><Map size={17} /><strong>242</strong><span>观星地点快照</span></div>
          <div><Cloud size={17} /><strong>33h</strong><span>统一天气时序</span></div>
          <div><Satellite size={17} /><strong>2</strong><span>核心产品页</span></div>
          <div><Database size={17} /><strong>1</strong><span>共享数据会话</span></div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>PRODUCT SURFACES</p><h2>统一壳，分工明确</h2></div><span className={styles.sectionNote}>状态从任一入口往返保持</span></div>
          <div className={styles.surfaceGrid}>
            <article className={styles.surfaceCard}><span className={styles.surfaceIcon}><Telescope size={18} /></span><p>/</p><h3>逐星</h3><strong>今晚云量与卫星云图</strong><span>负责当前地点的地图、卫星观测、预报时间轨和即时天气。</span></article>
            <article className={styles.surfaceCard}><span className={styles.surfaceIcon}><Layers3 size={18} /></span><p>/planner</p><h3>星野决策</h3><strong>多夜趋势与地点排名</strong><span>负责 1/3/5/7 夜比较、最佳窗口、风险解释和地点决策。</span></article>
          </div>
          <div className={styles.sessionBridge}><span>共享观测会话</span><i /><b>地点 · 夜晚 · 模型 · 时次 · 图层 · 来源状态</b><i /><span>跨入口恢复</span></div>
          <p className={styles.compatibilityNote}>兼容地址 `/stargazing-finder-dark`、`/sites`、`/viirs` 继续可访问，并统一重定向到观星地图对应视图。</p>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>FUNCTION AUDIT</p><h2>原网页功能复刻审计</h2></div><span className={styles.sectionNote}>已区分“复刻”和“主动排除”</span></div>
          <div className={styles.auditTable} role="table" aria-label="原网页功能复刻审计表">
            <div className={styles.auditHead} role="row"><span>功能域</span><span>原网页能力</span><span>当前实现</span><span>状态</span></div>
            {auditRows.map((row) => <div className={styles.auditRow} role="row" key={row.title}>
              <strong>{row.title}</strong>
              <span>{row.target}</span>
              <span>{row.current}{row.next && <small>后续：{row.next}</small>}</span>
              <b data-status={row.status}><StatusIcon status={row.status} />{row.status}</b>
            </div>)}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>MERGE PATH</p><h2>推荐合并路径</h2></div><span className={styles.sectionNote}>保留旧地址，增量收敛</span></div>
          <div className={styles.phaseGrid}>
            {phases.map((phase) => <article className={styles.phaseCard} key={phase.number}><span>{phase.number}</span><h3>{phase.title}</h3><p>{phase.detail}</p><code>{phase.files}</code></article>)}
          </div>
        </section>

        <section className={styles.decision}>
          <div><p className={styles.kicker}>RECOMMENDATION</p><h2>建议先合并数据与状态，再合并页面。</h2><p>第一阶段不改现有首页，不删除克隆路由；先把共享会话和导航链接跑通。这样任何页面都能打开同一个地点、同一个夜晚和同一个时次，验收风险最低。</p></div>
          <div className={styles.decisionSteps}><span><b>已完成</b> 共享观测会话与同源快照</span><ArrowRight size={16} /><span><b>当前</b> 两页闭环发布候选验收</span><ArrowRight size={16} /><span><b>后续</b> 实拍反馈与评分校准</span></div>
        </section>
      </div>
    </main>
  );
}
