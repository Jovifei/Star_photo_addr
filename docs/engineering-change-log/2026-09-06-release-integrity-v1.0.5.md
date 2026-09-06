# 工程修改跟踪：v1.0.5 发布完整性与数据真实性修复

> 基线：`main@d9f8ea12bb09b0a3de734227dbea433ef27077ef`  
> 分支：`fix/release-integrity-v1.0.5`
> PR：`#17`

## 目的

修复 v1.0.4 最终审核发现的发布阻断项：生产依赖高危审计、云海人工天气/AIFS 语义、跨地点磁盘天气借用、火烧云高档位统计与快照年龄、决策摘要更新时间；同时收口未校准模型的用户展示语义，并修复 WebKit 移动端弹窗入口焦点回归。

## 数据边界

- 云海：不再生成任何人工天气；关键字段不完整即 `score=null`；相对湿度直接使用 Open-Meteo；云底/云顶仍是启发式估算，页面标记 Beta；显示为“条件指数”，不是现场校准概率。
- 火烧云：仍是启发式条件指数映射，用户界面统一使用 `0–100` 条件指数分段，不再把分段显示成事件概率或带 `%` 的概率区间；内部 `probabilityLabel/probabilityLevel` 字段名暂为旧快照兼容保留。修复 p80/p88/p95/p100 高档位统计。晨昏关键云量/降水若为 `null`，不再用 `0` 代替；缺失时次会被跳过，整个窗口均不可计算时明确返回“数据不足”。
- 普通天气：仅相同请求键可读取 stale 磁盘缓存，不再静默使用百公里内其他地点/模型数据。
- 时间：DecisionSummary 的“更新时间”仅使用实际 fetch/last-success 时间，不再使用被选中的预报有效时次。

## 稳定性与可访问性

- 云海/火烧云强制刷新在冷却期有缓存时返回明确 stale 数据，无缓存时返回 `429 + Retry-After`，避免继续冲击上游。
- 火烧云磁盘快照以 `generatedAt` 计算年龄，超过 24 小时不再作为 stale fallback。
- `SourcePopover` 在 WebKit 移动端采用同步聚焦 + 下一帧/短延迟条件兜底，只有焦点仍未进入 dialog 时才补焦点；保留 Tab/Shift+Tab 焦点环与 Escape 返回触发元素。

## 回归保护

新增/更新测试覆盖：

- 云海 AIFS provider model、真实 `relative_humidity_2m`、上游失败禁止人工天气、关键字段缺失必须 `score=null`。
- 禁止重新引入 `findNearestDiskForecast` 跨地点磁盘天气借用。
- 禁止把 `activeForecastTime` 当作“数据更新时间”。
- 火烧云高分档位统计，以及用户展示不得重新出现“概率排行 / 三日概率 / 概率 =”等未校准概率语义。
- 火烧云晨昏关键云量/降水缺失不得重新被 `?? 0` 伪装成晴空；全窗口不可计算时 `score=null`、分档为空。
- Firefox/WebKit 数据依据弹窗入口焦点与键盘可达性。
- 375 / 768 / 1024 / 1440px 下 `/`、`/sites` 与 Planner 兼容入口的页面级横向溢出矩阵，所有布局断言保持原阈值 `<= 1px`。

## 发布门禁

本分支要求全部通过后才允许合并：

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm run check
npm run test:e2e
npm run test:e2e:cross-browser
```

此外 PR CI 还验证：

- live data smoke：weather / satellite / geocoding / air quality / Kp；
- Compose 与 Nginx 配置；
- production container build + health probe。

### CI 过程中发现并处理的问题

1. **WebKit 移动端 dialog 首焦点偶发被触发按钮抢回**：已修复；真实 Firefox/WebKit cross-browser smoke 已恢复通过。
2. **旧“4 断点 × 3 路由”横向溢出 E2E 在 60 秒总测试时限触发 timeout**：失败日志没有出现横向溢出断言失败。该测试一次要执行 12 次 production navigation，因此仅把**这个用例**的 wall-clock timeout 调整为 120 秒；所有 `scrollWidth - innerWidth <= 1px` 与 Planner 重定向/旧抽屉不存在等断言完全保留，没有放宽产品验收标准。
3. **火烧云条件指数仍残留概率式文案**：继续审核时发现排行标题、三日 aria、页脚和分档区间仍带“概率/%”语义；已统一为 0–100 条件指数，并新增 release integrity 静态回归，防止再次误写为未校准概率。
4. **火烧云关键空值被 `?? 0` 静默改写**：Finder 天气适配器会合法地产生 `null`，旧评分把 `null` 云量/降水当成 0。现改为严格数值检查；缺失时次不参与评分，全窗口缺失则返回数据不足，避免“无数据 = 晴空”的错误结论。

## 本地 Codex 合并/部署前复核

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

部署前还应人工查看 `/`、`/sites`、`/fireglow`、`/cloudsea` 在 1440 / 1024 / 768 / 390px 下的遮挡、裁切和横向溢出，并核对火烧云/云海的“条件指数”与 Beta/未校准说明没有被误写回“概率”。
