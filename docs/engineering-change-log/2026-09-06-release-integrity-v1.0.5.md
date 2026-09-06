# 工程修改跟踪：v1.0.5 发布完整性与数据真实性修复

> 基线：`main@d9f8ea12bb09b0a3de734227dbea433ef27077ef`  
> 分支：`fix/release-integrity-v1.0.5`

## 目的

修复 v1.0.4 最终审核发现的发布阻断项：生产依赖高危审计、云海人工天气/AIFS 语义、跨地点磁盘天气借用、火烧云高档位统计与快照年龄、决策摘要更新时间。

## 数据边界

- 云海：不再生成任何人工天气；关键字段不完整即 `score=null`；相对湿度直接使用 Open-Meteo；云底/云顶仍是启发式估算，页面标记 Beta；显示为“条件指数”，不是现场校准概率。
- 火烧云：仍是启发式条件指数映射，新增未校准说明；修复 p88/p95 高档位漏计。
- 普通天气：仅相同请求键可读取 stale 磁盘缓存，不再静默使用百公里内其他地点/模型数据。

## 发布门禁

本分支执行生产依赖审计、`npm run check`、Chromium 全量 E2E、Firefox/WebKit 核心冒烟；全部通过后才提交最终修复。

## 本地 Codex 部署前复核

```bash
git fetch --all --prune
git checkout fix/release-integrity-v1.0.5
git pull --ff-only
npm ci
npm audit --omit=dev --audit-level=high
npm run check
npm run test:e2e
npm run test:e2e:cross-browser
```
