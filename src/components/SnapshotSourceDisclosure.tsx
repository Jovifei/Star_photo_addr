import type { SnapshotProvenance } from "@/lib/snapshotProvenance";
export default function SnapshotSourceDisclosure({ snapshot, siteId }: {
  snapshot?: { generatedAt: string; provenance?: SnapshotProvenance; transport?: { servedAt: string } } | null;
  siteId: string | null;
}) {
  const candidate = siteId ? snapshot?.provenance?.sourcesBySite?.[siteId] : null;
  const sources = Array.isArray(candidate) ? candidate : null;
  const label = (value: unknown, fallback = "未知") => typeof value === "string" && value ? value : fallback;
  return <details className="snapshot-source-note" data-testid="snapshot-source-times">
    <summary>来源与时间</summary>
    {!siteId ? <p>选择目录点位查看原始供应商时间。</p> : sources?.length ? sources.map((source, index) =>
      <p key={`${source?.dataset ?? "unknown"}-${index}`}>{label(source?.provider)} · {label(source?.model).toUpperCase()} · {source?.dataset === "surface" ? "地面" : source?.dataset === "pressure" ? "压力层" : "未知数据集"}：
        原始采集 {label(source?.sourceFetchedAt)}；
        模型起报 {label(source?.providerRunAt)}；
        观测时间 {label(source?.observedAt, "未知（数值预报）")}</p>)
      : snapshot?.provenance
        ? <p>该地点未取得可核验原始来源时间的数据集；按覆盖缺失处理，不能用生成时间代替。</p>
        : <p>旧快照未记录原始供应商时间，不能用生成时间替代。</p>}
    <p>快照生成 {snapshot?.generatedAt ?? "未知"}；本次传输 {snapshot?.transport?.servedAt ?? "未知"}。采集时间不等于模型起报或观测时间。</p>
  </details>;
}
