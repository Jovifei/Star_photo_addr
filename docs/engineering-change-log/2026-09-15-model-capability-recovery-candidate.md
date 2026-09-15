# 2026-09-15 模型能力与评分恢复候选（本地已验收，未发布）

## 身份与边界

仓库：Jovifei/Star_photo_addr。
接收基线：3334e0c08f9ab2e481277628ce4ee875e2f1039e（v1.0.18）。
本轮未合并 main、未部署生产、未操作生产 .env 或快照卷。
网页 Agent 初始创建的远端分支曾与 v1.0.18 基线 identical；本地 Codex 随后在独立 worktree 通过应用器接收压缩包，形成 `codex/model-capability-recovery-20260915@4118887`。
本候选已完成本地代码/浏览器/真实 GFS 验收，但尚未合并 main 或部署生产；不得把本地结果写成生产已恢复。

## 根因

1. DEFAULT_CLOUD_STATE、snapshot 路由和 worker 默认 ICON，但 Finder 要求 visibility 有效。单点四层云可用不代表评分可用。
2. dataSourceHealth 只检查 Best Match 四层云，没有显式评分模型和能见度检查。
3. Provider Retry-After 被截断到 120 秒，且队列在调用方解析 429 前释放槽位，有继续放行的窗口。
4. worker 的公历日期与 00–05 时 UI 使用的前一晚不一致；部分非 429 错误后仍继续专题预热。
5. compose 的 30 分钟默认周期与 worker 脚本 3 小时默认周期不一致；专题预热增加后台请求。

## 候选修复

- 新建 forecastPolicy：GFS 作为新会话默认模型；统一 Finder/健康检查所需的 13 项原始字段；时间轴有序唯一、数组对齐，至少同一小时字段齐全。
- 显式选择 ICON/AIFS/Best Match 不被覆盖；缺能见度继续 unknown，不跨模型填充，不用固定值补齐。
- 新建 openMeteoRateLimit：共享并发 2、队列有界、429 在释放槽位前关闭入口；冷却期间拒绝排队任务，不自动重试；保留数字或 HTTP-date Retry-After。
- 无有效 Retry-After 时，按上游 daily/hourly/minutely 原因采用保守退避。24h/1h/65s 是本项目退避策略，不是对上游配额重置时间的断言。
- 接线 forecast.ts 后 Finder 同时使用新入口；健康探针也使用此入口，不绕过已知冷却。
- /api/data-status 支持显式 model，默认 GFS；按模型隔离缓存和进行中的请求；正缓存不能掩盖已知 429。文案明确仅是杭州单点字段探针，不代表 282 点全部可用或准确率。
- 时间轴质量区分“无预报”“过期禁止推荐”“天气可查看但评分字段不足”“可用”。
- forecast 路由保留上游 429 与 Retry-After；snapshot 响应包括 stale HTTP 200 也透传冷却，并禁止 stale 响应的公共缓存。
- worker 匹配 Shanghai 当前观测夜，校验模型/时间/完整性；任何失败停止专题预热；fireglow 仅在 SNAPSHOT_PREWARM_FIREGLOW=1 时串行运行，首个失败即停止。
- 新部署默认预热周期统一 3 小时。既有 .env 不自动迁移；上线前必须核对 SNAPSHOT_MODEL、SNAPSHOT_INTERVAL_MS 等实际生效值。

## 压缩包生成时的独立验证（历史台账）

执行环境：Node 22.16.0，独立逻辑测试；与正式目标 Node >=24 不同。

- `node --experimental-strip-types scripts/test-model-recovery.mjs`：31 pass / 0 fail。
- 上述包含 6 项真正启动 worker 子进程的 mock fetch 测试；不访问上游，不冒充现场或生产测试。
- 新增纯 TypeScript 模块 `tsc --noEmit --strict ...`：通过。
- worker 与 helper 的 Node 语法检查：通过。
- 新增 2 项应用接线 Vitest、3 项模型健康路由 integration：压缩包生成时未运行；本地接收后已纳入全仓门禁并通过。
- 全仓 npm ci、npm run check、完整 E2E、跨浏览器、Docker smoke、真实上游验收：压缩包生成时未运行；本地接收追加结果见文末。
- 应用器默认只读，要求目标 Git blob SHA 与已审阅基线一致、每个修改片段唯一匹配；有差异即停止，不猜测套用。

## 保持的 P0 边界

未修改评分权重、安全门槛或快照完整性版本；本地接收阶段仅补充 `forecastIntegrity.ts` 的统一必需字段门禁，stale94、总云8/低云61、超龄缓存、缺层等旧回归继续通过。选用 GFS 不是准确率优胜声明。

## 仍未解决／必须独立验收

- 账号/IP 实际配额、出网条件和生产 282 点完整覆盖；该补丁不创造上游额度。
- 模块级冷却不是跨进程、跨服务器或所有出口共享的持久化配额账本；重启会清除内存冷却，不能靠重启规避配额。
- 并发数量不等于调用额度。批量 12 个 HTTP 请求不等于 12 个计费/限额调用，仍需统计地点、变量、日期、模型与专题的加权用量。
- 30–90 天准确率、低中云漏报、多模型分歧、卫星年龄/NOAA UTC、目录证据、真机压力、云海 Phase2。
- 正式版本升级应在候选通过验收后统一更新 package.json、package-lock、页面版本记录和 CHANGELOG。本候选未伪造新发布版本。

## 本地接收复核追加（2026-09-15）

本地 Owner 工作区保持 `main@3334e0c08f9ab2e481277628ce4ee875e2f1039e` 干净；候选应用器在独立 worktree 先输出 `DRY_RUN_OK`，审阅 25 文件差异后才应用。Node 24 Windows 的 worker 测试 harness 仅修正了 `--import` 的 `file://` 参数和 mock 退出码，生产实现与保护断言未放宽。

接收复核补齐了候选遗漏：所有核心评分字段进入同一 fail-closed 门禁；健康响应增加模型、`cloudAvailable`、`scoringAvailable` 和缺失字段；CloudSea surface/pressure、Finder、火烧云和压力路由共用 Open-Meteo 进程级 gate 并传播 429/Retry-After；批量坐标/时间轴与日历日期严格校验；worker 校验响应模型与观测夜日期；runner 镜像复制 worker helper；浏览器端保留长 Retry-After 冷却。

Node 24 候选回归 `32/32`，全仓 `npm run check` 为 `65` 个测试文件 / `391` 项通过；完整 Chromium E2E `122 passed / 36 skipped / 0 failed`；Firefox/WebKit smoke `4/4`；`npm audit --omit=dev --audit-level=high` 无漏洞；Compose 静态配置通过。真实 GFS 单点一次返回 24/24 小时、13 项字段完整，Finder GFS 批量一次返回 282/282 地点可用、13 项字段各 9306 个有效值；健康探针 GFS `cloudAvailable=true`、`scoringAvailable=true`。

本阶段未修改生产 `.env`、未合并 main、未部署；本机 Docker Desktop daemon 无法启动，因此 Docker build/镜像内 worker helper/容器运行 smoke 标记为 `NOT_RUN/BLOCKED`，不能写成通过。账号配额、30–90 天准确率、现场云量漏报和多模型校准仍未完成。
