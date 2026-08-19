export type DataSourceProbeStatus =
  | "available"
  | "degraded"
  | "unconfigured"
  | "not-installed";

export interface DataSourceProbe {
  id: "weather" | "satellite" | "light-pollution" | "tianditu" | "local-dark-sky";
  label: string;
  status: DataSourceProbeStatus;
  detail: string;
  checkedAt: string;
  latencyMs?: number;
}

export interface DataSourceHealthResponse {
  status: "ok" | "degraded";
  checkedAt: string;
  cached: boolean;
  sources: Record<DataSourceProbe["id"], DataSourceProbe>;
}

export function dataSourceStatusLabel(status: DataSourceProbeStatus): string {
  return {
    available: "可用",
    degraded: "降级",
    unconfigured: "未配置",
    "not-installed": "未安装",
  }[status];
}
