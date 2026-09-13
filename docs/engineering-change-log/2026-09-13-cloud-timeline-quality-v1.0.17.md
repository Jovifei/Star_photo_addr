# 工程修改跟踪：v1.0.17 时间轴数据质量标签纠正

> 日期：2026-09-13  
> 触发：生产 v1.0.16 天气上游 429 时，时间轴同时显示“暂无有效预报/原始抓取未提供”和“数据质量：可用”。  
> 范围：仅修正文案与缺失数据质量语义，保持评分和上游策略不变。

## 1. 根因与修复

- `CloudTimeline` 以前只用 `forecastStale` 判断质量；forecast 与 cloudGrid 都没有结果时，`forecastStale=false` 造成缺失数据落到“可用”。
- 新增 `forecastQualityLabel()`：stale/降级显示“过期/降级，禁止推荐”，无有效预报显示“数据不足”，只有匹配且非 stale 的预报显示“可用”。
- 新增真实浏览器 502 回归，保护来源、时间、质量三项字段的一致性。

## 2. 验证

| 检查 | 结果 |
| --- | --- |
| `npm run check` | PASS：59 个 Vitest 文件 / 340 项、lint、typecheck、Next 16.3.4 build |
| 时间轴纯函数测试 | PASS |
| Chromium 502 缺失预报回归 | PASS |

## 3. 边界

本修复不恢复 Open-Meteo 匿名配额，也不代表预报准确率、多模型分歧或现场云量已校准。数据源 429 时保留明确 degraded/data-insufficient 状态。
