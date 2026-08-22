# 逐星项目跟踪体系

> 状态日期：2026-08-21  
> 当前基线：`main@50496e61f0be1cb666f344f36d832029df2e988e`  
> 当前工作分支：`test/ux-research-quality-v2-20260820`

## 1. 为什么使用 Markdown，而不是单独维护表格

项目跟踪采用仓库内 Markdown，原因是：

- 与代码同版本，可以通过 Git diff 看清每次状态变化；
- 每个任务可直接链接到提交、PR、测试报告和工程修改记录；
- Codex 可以直接读取、修改和提交，不需要额外同步 Excel；
- 分支、评审、回滚与代码使用同一套流程；
- 对外汇报需要表格时，可以从 Markdown 导出，不把导出文件当作事实源。

因此，**仓库内文档是单一事实源**；临时聊天结论、截图和本地表格不能替代它。

## 2. 文档地图

| 文档 | 作用 | 何时更新 |
| --- | --- | --- |
| [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) | 项目总览：已完成、进行中、待完成、下一步 | 每个 PR 合并前；项目阶段变化时 |
| [`TEST_BACKLOG.md`](./TEST_BACKLOG.md) | 所有 MANUAL、BLOCKED、DEFERRED 测试的详细执行卡 | 测试状态、依赖、验收标准变化时 |
| [`CHANGE_LEDGER.md`](./CHANGE_LEDGER.md) | 每次合并/重要提交解决了什么、验证了什么 | 每个 PR 合并后；直接提交到 main 后 |
| [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md) | 后续 Codex 的读取顺序、分支规则、执行模板 | 工作流或下一优先级变化时 |
| [`../testing/TEST_PLAN_V1.md`](../testing/TEST_PLAN_V1.md) | 测试总体方法、分层、模块用例和发布门禁 | 测试策略变化时 |
| [`../testing/TEST_STATUS.md`](../testing/TEST_STATUS.md) | 已实施自动化测试、精确结果和 Bug 修复 | 每轮测试结束时 |
| `../engineering-change-log/` | 单次变更的目的、根因、修改、验证与回滚 | 每次功能/修复/测试提交 |

## 3. 状态定义

| 状态 | 含义 |
| --- | --- |
| `PASS` | 已执行、已有证据、达到验收标准 |
| `IN_PROGRESS` | 已有唯一活动分支，正在实施或等待 CI |
| `TODO` | 尚未开始，但当前没有外部阻塞 |
| `MANUAL` | 必须使用真机或人工观察，自动化只能部分替代 |
| `BLOCKED` | 缺少 ECS、域名、证书、授权数据或现场设备 |
| `DEFERRED` | 明确排入后续阶段，旧文档中的 `SKIP` 统一视为此状态；不是取消 |
| `CANCELLED` | 经评审决定不再实施，必须写明原因 |

任何任务只有同时满足以下条件才能从非完成状态改为 `PASS`：

1. 执行步骤已完成；
2. 验收标准逐项满足；
3. 证据已保存并可追溯；
4. 相关 Bug 已修复或登记；
5. `PROJECT_STATUS.md`、`TEST_BACKLOG.md`、`TEST_STATUS.md` 已同步。

## 4. 每次提交必须更新什么

### 功能、Bug 或测试实现提交

必须完成：

1. 新增或更新 `docs/engineering-change-log/YYYY-MM-DD-*.md`；
2. 更新 `PROJECT_STATUS.md` 中对应工作包；
3. 若测试状态变化，更新 `TEST_BACKLOG.md` 和 `TEST_STATUS.md`；
4. PR 合并后，在 `CHANGE_LEDGER.md` 记录合并提交；
5. PR 描述列出实际执行的命令、测试数量、失败与修复；
6. 未执行的项目保持 `MANUAL`、`BLOCKED` 或 `DEFERRED`，不得写成通过。

### 纯文档提交

至少更新：

- 工程修改记录；
- `CHANGE_LEDGER.md` 的进行中工作包，或在下一次合并后补入已合并表；
- 文档之间的相互链接。

## 5. 分支规则

- 同一个工作包只允许一个活动分支；
- 有现成活动分支时继续使用，不再创建近义分支；
- 分支从最新 `main` 创建；
- 测试全绿后创建或更新一个 PR；
- 合并优先使用 Squash；
- 合并后删除临时分支；
- 未确认 `main` 新 HEAD 前，不得报告“已进入 main”。

推荐命名：

```text
feat/<work-package>-YYYYMMDD
fix/<work-package>-YYYYMMDD
test/<work-package>-YYYYMMDD
docs/<work-package>-YYYYMMDD
```

## 6. 证据要求

| 测试类型 | 最低证据 |
| --- | --- |
| 单元/契约/集成 | 命令、测试文件数、测试数量、GitHub Actions Run |
| E2E | Playwright HTML、失败截图、Trace；必要时 Video |
| 真机 | 设备型号、系统版本、浏览器版本、录屏/截图、问题步骤 |
| 性能 | k6/Lighthouse 原始 JSON、CPU/内存、请求错误率和 p95 |
| 阿里云 | ECS 地域、DNS/TCP/TLS/TTFB 原始输出、时间窗口 |
| TLS | 证书链、主机名、有效期、80→443、续期演练 |
| 科学校准 | 数据许可、仪器型号、校准记录、地点/时间/天气和原始测量 |

## 7. 后续接力入口

后续执行者应按以下顺序阅读：

```text
1. docs/project-tracking/README.md
2. docs/project-tracking/PROJECT_STATUS.md
3. docs/project-tracking/TEST_BACKLOG.md
4. docs/project-tracking/CODEX_HANDOFF.md
5. docs/testing/TEST_STATUS.md
6. 对应 engineering-change-log
```

不要只依据聊天记录决定“已完成”或“下一步”。
