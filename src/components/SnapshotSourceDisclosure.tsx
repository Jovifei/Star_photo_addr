import type { SnapshotProvenance } from "@/lib/snapshotProvenance";
export default function SnapshotSourceDisclosure({ snapshot, siteId }: {
  snapshot?: { generatedAt: string; provenance?: SnapshotProvenance; transport?: { servedAt: string } } | null;
  siteId: string | null;
}) {
  const sources = siteId ? snapshot?.provenance?.sourcesBySite[siteId] : null;
  return <details className="forecast-method-note" data-testid="snapshot-source-times">
    <summary>来源与时间</summary>
    {!siteId ? <p>选择目录点位查看原始供应商时间。</p> : sources?.length ? sources.map(source =>
      <p key={source.dataset}>{source.provider} · {source.model.toUpperCase()} · {source.dataset === "surface" ? "地面" : "压力层"}：
        原始采集 {source.sourceFetchedAt ?? "未知"}；
        模型起报 {source.providerRunAt ?? "未知"}；
        观测时间 {source.observedAt ?? "未知（数值预报）"}</p>)
      : <p>旧快照未记录原始供应商时间，不能用生成时间替代。</p>}
    <p>快照生成 {snapshot?.generatedAt ?? "未知"}；本次传输 {snapshot?.transport?.servedAt ?? "未知"}。采集时间不等于模型起报或观测时间。</p>
  </details>;
}
