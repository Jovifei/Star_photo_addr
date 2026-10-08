# 逐星接力及远端完整阶段任务 — 2026-10-08

## 1. 当前最终目标

提供可信中文摄影决策：今晚能否拍、去哪里、几点拍。今夜观测、暗夜选址、火烧云、云海四入口同级；地点、日期、模型、来源时间跨入口一致；有效原始天气可见，缺数据不制造评分；手机布局紧凑且地图可操作。

本地后续执行目录固定 `E:\project\Star_photo_addr`，不再创建 C 盘 worktree。

## 2. 已经完成

- 本次初查时 E 原目录仍在 f70d2bf。核查期间旧会话继续完成同步；本次重读确认 E 原目录已为干净 `main@6e534c0da71d5937c9b74a79e536d4089a53de2f`，`origin/main` 同 SHA，`git ls-remote origin refs/heads/main` 已独立确认GitHub服务端同SHA。
- 主线包含云端 `e0573b83ef0ccb7af9847eed097635044a85960a`（PR52）、历史分支功能整合和手机日期栏/重试测试时钟修正。C 来源 merge-main-20261008 已由旧会话归档，当前原目录包含新源码。
- 云端已实现坐标身份约束、版本化跨入口上下文、逐站来源时间、surface UTC epoch/DST、旧缓存只读降级。下一阶段审核实际实现和剩余门槛，不重做这些功能。
- 旧会话与当前 `docs/MAIN_BRANCH_RECONCILIATION_20261008.md` 记录：lint/typecheck/build、91文件516测试、Chromium272 PASS/126适用SKIP/0FAIL、Firefox/WebKit12 PASS；测试候选95c4597，主线合并ea635d9。本次Git比对确认95c4597到main的src/tests/scripts/依赖/CI/Docker文件无差异；本次未重跑测试，测试结果为来源证据。
- 已读原目录 AGENTS、lessons、指定旧会话 `01a0e1d5-75ef-7ca1-aae1-20350351beb4`，以及 Obsidian 本项目概览、PROJECT_STATUS、DEPLOYED_5FBF_ACCEPTANCE。Obsidian旧快照以当前源码和本次Git状态纠正。

## 3. 现在卡在哪里

- Jovi已在本次会话回复“是”，授权按本文件完成整个远端阶段的代码修改、测试及GitHub分支/PR提交；部署与生产数据操作不在授权范围。
- C2C doctor 实际返回 `workspace_mismatch`，workspace_info 返回 Internal error；未证实本地连接已正确绑定 E 原目录。远端真实云端执行环境与 GitHub 权限独立核验；本地只读连接不是云端工程前提。
- Hub revision 本次返回 WinError10061，上报未成功；不自动重试，不把旧会话的成功记录当本次上报。
- 实际缓存天气覆盖矩阵、OnePlus/iOS真机与TalkBack/VoiceOver、全球DST气压层、科学校准仍未闭合。CI、fixture、HTTP200和供应商smoke不能替代验收。
- 生产最近文件记录为5fbf7ba/1.0.27，本次未实时核对；本轮未授权部署或清理生产缓存。

## 4. 关键文件

- 约束与接力：`AGENTS.md`、`tasks/todo.md`、`tasks/lessons.md`、本文件。
- 最新证据：`docs/MAIN_BRANCH_RECONCILIATION_20261008.md`、`docs/CLOUD_IDENTITY_PROVENANCE_DST_20261007.md`、`LOCAL_CODEX_HANDOFF.md`、`tasks/plans/2026-10-08-main-integration.md`。
- 实现链：`src/lib/locationIdentity.ts`、`productRoutes.ts`、`absoluteForecastTime.ts`、`snapshotProvenance.ts`、`forecast.ts`、`forecastIntegrity.ts`、`store.tsx`；forecast/fireglow/cloudsea API routes；`ProductStateBridge.tsx`、`SnapshotSourceDisclosure.tsx`。
- 验收链：`scripts/acceptance-weather-matrix.mjs`、`scripts/check-release-frontend.mjs`、`tests/e2e/location-transfer.spec.ts`、身份/来源/绝对时间 unit tests、`tmp/main-integration-evidence-20261008`。
- 旧架构文档“晚霞规划中/不加导航”和旧测试清单已落后源码，不能作为当前未实现清单。

## 5. 下一步

1. 本轮完整阶段代码范围已获Jovi确认；以当前 E 原目录 main 作为本地接收位置。
2. 复用既有真实云端执行入口，派发一次完整任务；先确认可编辑、运行测试、推送本仓库，能力不足返回准确工具错误。普通只读聊天的秒级答复不是执行交付。
3. 远端连续完成审核→修复→开源研究→下一阶段设计与实施→测试→复核→GitHub提交，交付精确SHA/tree/PR。
4. 本地接收精确提交，在 E 原目录验证并回传GitHub证据，交远端最终审核；下一阶段业务实施仍由远端承担。

## 远端完整任务 Prompt

你负责 Jovifei/Star_photo_addr 的完整工程阶段。最终目标是可信的四入口摄影决策。这是审核、修复、规划、实际实施和 GitHub 提交的长任务，不能用短核查、建议、README修改或下一阶段清单结束。不要为凑时长等待，以完整可交付阶段为准。

先核对当前main head/tree、AGENTS、README、最新接力/整合/云端阶段文档、tasks进度及实际源码；提交时记录真正父基线。起始交接基线6e534c0da71d5937c9b74a79e536d4089a53de2f；若main新增提交，明确差异并在新基线上工作，不覆盖他人修改。读全树与祖先，不只看PR描述或最后diff；源码优先于旧文档/聊天记忆。

完整审核四入口选择、地点恢复与坐标冲突、来源时间、旧缓存兼容、绝对时间及DST、批量天气降级、有效评分计数、手机/桌面数据呈现。已实施的身份/来源/surface DST功能需要审核，不能重新派作未实现功能。对实际发现的缺陷给出可复现证据并修复，保留有效原始天气和同模型字段边界。

根据最终目标和真实剩余事项，独立选择并完成下一完整工程阶段。研究适用官方与开源方案，记录来源、许可、适用性与采纳/不采纳理由，不照搬庞大框架或增加无必要依赖。先写具体计划：问题、最小文件改动、验收标准、风险；获本轮授权后自行实施，不把下一阶段业务实现退回本地。若合理阶段是资格与证据闭环，应实现可复用工具并实际执行可执行部分，不能仅写计划或伪造人类/科学PASS。

执行针对性回归、lint/typecheck/unit-contract-integration/build、必要完整浏览器与跨浏览器门禁。关键缺陷提供失败与修复后证据；禁止删断言、放宽门槛、延长超时刷绿。复核最终diff及边界并修复发现的问题。真实供应商检查先cache-only，429/Retry-After立即停止，禁止refresh轰炸；真机、读屏、科学和不可用资源按BLOCKED/NOT_RUN列出。

只操作本仓库，代码简洁，只改真实缺陷和所选阶段所需文件。保留Owner笔记、配置、缓存、用户数据、备份和回滚。不得部署生产、改凭据/网络/其他项目。使用codex/分支，普通push并建立/更新PR，不force push、不未经授权合main。最终必须交付实际commit SHA、tree、父基线、分支、PR链接、检查命令与结果、精确CI终态、剩余门槛、本地接收清单。缺执行/写入/push能力就给真实工具错误，不将聊天/计划当交付。

授权状态：Jovi已在本次会话明确回复“是”，授权上述完整阶段代码修改、测试和GitHub分支/PR提交。整个阶段连续执行，不拆微任务。本地Codex只接收精确提交、验证并回传，远端承担下一阶段实现。该授权不包括部署、生产数据操作或扩大凭据权限。

## 本次复核

本次重新读取Git状态纠正旧会话并行完成造成的快照变化，只准备文档；未改业务源码、未运行新测试、未派发新远端工程任务。远端任务实际发送以可见回执为准。
