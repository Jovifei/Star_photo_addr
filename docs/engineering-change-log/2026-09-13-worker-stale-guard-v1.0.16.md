# 工程修改跟踪：v1.0.16 Worker stale 语义纠正

> 日期：2026-09-13  
> 触发：生产部署后发现 worker 将 HTTP 200 但 `stale: true`、无源抓取时间的观测快照记录为 `fresh`，并继续预热专题。  
> 范围：仅修正 worker 的 fail-closed 语义和快照时间字段，不改变评分模型或上游配额策略。

## 1. 根因与修复

- `scripts/observing-snapshot-worker.mjs` 原先只看 HTTP 状态，HTTP 200 即记录 `fresh`；数据源 429 后的可诊断 stale 快照因此出现误导日志。
- 新增 `snapshotHealth()`，要求 `stale=false`、`integrityVersion=weather-integrity-v2` 且有非空 `sourceFetchedAt` 才算 fresh。
- stale/身份不完整快照只记录 `stale`，跳过火烧云预热，并使用至少两小时退避；HTTP 错误仍沿用原有 429 冷却。
- `buildObservationSnapshot()` 在没有有效源时间时省略 `sourceFetchedAt`，不再写入空字符串。

## 2. 验证

| 检查 | 结果 |
| --- | --- |
| `node --check` worker/helper | PASS |
| worker stale 合同单元测试 | PASS |
| P0 forecast/disk 定向测试 | PASS |
| 生产复现 | PASS：stale 快照被识别为 stale，避免继续专题预热 |

## 3. 边界

本修复不代表 Open-Meteo 匿名配额已恢复，也不代表 30–90 天预报准确率、多模型分歧或现场云量已校准。生产部署仍须等待本分支完整 CI，并保留 `v1.0.15 / 0e25bb1961bf` 回滚镜像和快照卷。
