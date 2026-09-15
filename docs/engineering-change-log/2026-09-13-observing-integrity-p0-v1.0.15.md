# 工程修改跟踪：v1.0.15 观星数据完整性 P0 修复

> 历史状态说明（2026-09-16）：本文保留 v1.0.15 当时的未完成项和发布边界。后续 v1.0.16–v1.0.18 及模型能力恢复候选已补齐其中部分门禁；当前准确率校准、生产配额和现场真值仍未完成，详见最新工程记录。

> 日期：2026-09-13  
> 目的：修复“观星 94 分但现场低/中层云较多”事故暴露的数据完整性、评分语义和请求治理风险。  
> 发布边界：本记录只覆盖 P0 完整性与发布门禁，不代表预报准确率已经校准。

## 1. 基线与范围

- 仓库：`Jovifei/Star_photo_addr`
- 分支：`codex/data-source-integrity-audit-20260913`
- 原审计：`3e1e13200bbf4a01ef09b8b90a431fb371f37c87`
- 接收候选：`ee313b9d1da61a177fbd07f152283cc262b17408`
- P0 实施基线：`898727ea752e064a6b903281a97abf0ea598975b`
- 发布版本：`v1.0.15`

## 2. 已完成修改

### 数据门槛与 stale 保护

- forecast 与 observing snapshot 要求 `weather-integrity-v2`、模型身份、有效 UTC/offset 抓取时间、唯一时间轴和完整地点批次。
- 磁盘 fallback 最多保留 6 小时；旧 schema、缺字段、未来时间、重复时间轴、错误模型/数量和 `stale=true` 均 fail-closed。
- stale/超龄结果可以保留原始云量供诊断，但撤销 score、band、confidence、bestWindow，不作为正常推荐。

### 评分与来源身份

- 新增共享 `scoreHour`，地图、候选和详情对同一地点/模型/时次使用同一核心天气 + 天文评分。
- 评分输入保守取 `max(total, low, mid, high)`，不把分层云相加，也不把它称为新的气象实测总云量；完整性不足返回数据不足。
- `scoreBasis`、`scoreTime`、`aggregation`、模型、原始抓取时间、provider run（取不到则 `null`）、请求/模式网格坐标、DEM 海拔来源、网格距离和缺失字段进入 UI。

### 请求治理与批量校验

- store、候选、云图网格和观察快照使用模型/地点限定的共享请求键；浏览器队列上限 4、服务端 Open-Meteo 并发上限 2，失败/429 有冷却且强刷优先。
- 模型切换清理旧状态，旧回包不得覆盖新模型；AbortController 不会误杀共享消费者。
- Finder 批量严格检查地点数量、坐标映射、时区/offset、时间轴长度/顺序/唯一性和四层云量；worker 预热首页实际使用的 ICON、当前观测夜和时次族，避免 282 点 × 多模型冷启动。

## 3. 验证证据

执行环境：Node `24.18.0`、npm `11.16.0`。

| 门禁 | 结果 | 证据 |
| --- | --- | --- |
| `npm ci` | PASS | 依赖按锁文件安装完成 |
| `npm run check`（P0 基线） | PASS | lint、typecheck、Vitest 58 文件/337 项、Next 16.3.4 build |
| `npm run test:live` | PASS | Open-Meteo 四模型/pressure/AQI/geocode、NASA GIBS、NOAA Kp、可选光污染瓦片连通性与结构 |
| Chromium 本地 E2E | PASS | 118 passed / 36 designed skips / 0 failed |
| Firefox/WebKit 本地 smoke | PASS | 4 passed / 0 failed |
| P0 浏览器故障注入 | PASS | stale94、低云 61、候选双视图、模型切换、429 冷却恢复、云图强刷桌面/移动回归 |
| GitHub Actions PR #29（`898727e`） | PASS | quality、live-data-smoke、container-smoke、e2e、cross-browser-smoke 全部成功；e2e 154 项实例按设计含跳过 |
| `npm audit --omit=dev --audit-level=high` | PASS | 0 vulnerabilities |

故障注入观察：候选同一规范化请求键重复 in-flight 为 `0`，候选峰值并发断言为 `2`；429/503 用例均验证明确错误、冷却或保留旧画布后恢复。CI 日志中出现的 429 是测试注入/恢复路径，不是失败门禁。

## 4. 未完成与发布边界

- 30–90 天历史预报对现场/卫星标签的准确率、低中层云漏报率和提前量尚未校准；不能宣称“94 分可靠”或“现场无云”。
- ICON/GFS/Best Match/AIFS 的多模型分歧仍为 `not-checked`，未把单模型结果平均成真值。
- GIBS 帧年龄策略、NOAA UTC 解析、AQI/pressure/geocode/专题健康探针和 282 个目录逐条 `sourceUrl/verifiedAt/evidenceLevel` 仍是后续工作。
- 真机 Safari/Android、压力/soak、授权 Bortle/SQM 栅格和现场科学样本不在本版本自动化门禁内。

## 5. 回滚与部署说明

部署前保留上一生产版本 `v1.0.14 / 39338495db0d` 的 build identity、镜像和 `star-photo_observing-snapshots` 卷；不清空旧缓存，不修改 `.env` 密钥。按 `docs/ALIYUN_DEPLOYMENT.md` 先核对实际 main SHA，再以串行预热和健康检查完成发布。最终 main/deployment SHA 与公网验收结果在发布台账和交接回传中记录。
