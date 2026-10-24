# C3/C4 · 新鲜部分覆盖与来源缺席不应被误称为旧数据（2026-10-24）

## 事实与复现

- 审核基线：`da159975f7a32f02fa2b9ed869e4ec729e2553a4`（main 不动；本次分支独立）。
- 场景：`GET /api/cloudsea/snapshot` 返回 HTTP 200，某个地点具备可发布云海窗口指数、`stale=false`、`pressure.status=partial`、`refreshError="压力层仅 20/54 地点可用"`。这个 `refreshError` 是覆盖不足的说明，并非原始来源已经过期。
- 修复前：`src/app/cloudsea/CloudSeaApp.tsx` 把 `refreshError` 与 `stale` 做 OR，移动端汇总因此写成「旧数据 · 仅供参考」。来源新鲜但部分缺测被误称过期，违反 stale 与 partial 的独立语义。
- 修复：`snapshotStale` 和 `selectedSnapshotStale` **只依据源数据的 `stale` 事实**。覆盖不足及刷新错误仍经 `dataNotice`、`pressure`、`surface` 单独展示；不改评分、缓存、超时或上游请求。
- 对照：真正 `stale=true` 且有相同可展示历史指数，仍显示「旧数据 · 仅供参考」。

## C4：来源时间文案不能伪称旧快照

- 另一个确定性反例：新快照带 `provenance.version=1`，`sourcesBySite[siteId]=[]`，表示该地点没有实际取得对应来源；此前 `src/components/SnapshotSourceDisclosure.tsx` 文案却断言「旧快照未记录」，混淆了数据缺席与旧版本元数据缺失。
- 修复按有无 `provenance` 区分：有新来源结构但该地点数据缺席，显示覆盖缺失；完全没有来源结构的历史快照仍显示旧版本时间记录不足。两者都不以 `generatedAt` 或 `transport.servedAt` 代替来源时间。
- 新增桌面 Chromium E2E：来源结构存在但站点列表为空时，不得出现旧快照字样。

## 回归与兼容性

- E2E 文件：`tests/e2e/cloudsea-topic-ia.spec.ts`，新增两条移动端 Chromium 合同和一条桌面来源时间合同：`fresh+partial+refreshError` 不再伪称旧数据、`stale+partial+refreshError` 必须仍标旧。
- 之前相关用例包括「pressure partial 保留选中指数」、「三日中的新鲜胜出窗口不受另一日期 stale 污染」。
- 修改文件还包括 `src/components/SnapshotSourceDisclosure.tsx`，不改上游数据，也不改变评分公式。
- 本补丁与 Draft PR #54 `codex/scoring-review-20261024` 的 C1/C2 文件无重叠；两份 PR 都以相同 main 基线为父，可由本地 Codex 在固定 SHA 验证后依授权整合。禁止直接合并 main、部署或覆盖 Owner 未跟踪报告。
- 本文件新增于代码及测试提交 `349bb6c8bef1bba4d57a3a44fb71d4d1ab71ae7b` 后；最终分支 HEAD 请以 PR 和交接回复列出的精确 SHA 为准。

## LOCAL_CODEX_HANDOFF / 验证命令（不代表已执行）

1. 核对本分支与 PR #54 各自 exact HEAD，确保最终合并结果同时包含 C1、C2、C3；保留 `E:/project/Star_photo_addr` Owner 工作树原状。
2. CI 先执行 `npm run check`、`npm run test:e2e`、`npm run test:e2e:cross-browser`、生产容器 smoke。以 exact SHA 关联每次日志；CI 只能证明测试合并树，不等于可部署正式镜像。
3. 本地接收并整合后检查移动屏宽 390px：`stale=false, pressure.partial, refreshError` 显示真实指数与「压力层仅…」但不写旧数据；`stale=true` 必须显示旧数据；旧数据不得用于新鲜推荐。
4. 生产镜像隔离预检、`/healthz` 精确版本、真实数据三类入口和正式 HTTPS/移动端仍需本地证据。供应商返回200、容器健康不等于真实可用预测。来源时间 / 模式起报 / 传输时间不得混写。
5. 两次实拍仍缺地点、时次和相应固定起报预报；科学概率校准 NOT_RUN，不提供无依据命中率。

测试状态由后续 GitHub CI 或本地真实执行回执更新；远端本会话未调用本机命令执行器，本地测试为 NOT_RUN。
