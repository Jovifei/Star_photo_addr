# 逐星项目跟踪体系

> 状态日期：2026-08-22  
> 当前主干：已包含 PR #13，合并基线 `3a461c09a2cb450de710f87490ff9317b2d81a8e`  
> 当前活动工作分支：无

## 1. 单一事实源

项目跟踪采用仓库内 Markdown，而不是把本地 Excel 或聊天记录作为主数据源：

- 与代码同版本，可通过 Git diff 查看每次状态变化；
- 每个任务可直接关联 Commit、PR、测试报告、截图和工程修改记录；
- Codex 可直接读取、修改并提交，不需要额外同步表格；
- 分支、评审和回滚与代码使用同一套流程；
- 对外汇报需要表格时，可从 Markdown 导出，但导出文件不反向覆盖仓库状态。

因此，**仓库内文档是唯一事实源**；临时聊天结论、截图和本地表格不能替代它。

## 2. 文档地图

| 文档 | 作用 | 何时更新 |
| --- | --- | --- |
| [`PROJECT_STATUS.md`](./PROJECT_STATUS.md) | 已完成、进行中、待完成、下一步与发布阻断 | 每个工作包结束或阶段变化时 |
| [`TEST_BACKLOG.md`](./TEST_BACKLOG.md) | MANUAL、BLOCKED、DEFERRED 测试的详细执行卡 | 测试状态、依赖或验收标准变化时 |
| [`CHANGE_LEDGER.md`](./CHANGE_LEDGER.md) | 每次合并/重要提交解决了什么、验证了什么 | PR 合并或直接提交 main 后 |
| [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md) | Codex 读取顺序、分支规则和执行模板 | 下一优先级或工作流变化时 |
| [`../testing/TEST_PLAN_V1.md`](../testing/TEST_PLAN_V1.md) | 测试分层、模块用例和发布门禁 | 测试策略变化时 |
| [`../testing/TEST_STATUS.md`](../testing/TEST_STATUS.md) | 已实施测试、精确结果和 Bug 修复 | 每轮测试结束时 |
| `../engineering-change-log/` | 单次变更的目的、根因、修改、验证和回滚 | 每次功能、修复或测试提交 |

## 3. 状态定义

| 状态 | 含义 |
| --- | --- |
| `PASS` | 已执行、有证据并达到验收标准 |
| `IN_PROGRESS` | 已有唯一活动分支，正在实施或等待 CI |
| `TODO` | 尚未开始，当前没有外部阻塞 |
| `MANUAL` | 必须使用真机或人工观察，自动化只能部分替代 |
| `BLOCKED` | 缺少 ECS、域名、证书、授权数据或现场设备 |
| `DEFERRED` | 已排入后续阶段；旧文档中的 `SKIP` 统一视为此状态，不是取消 |
| `CANCELLED` | 经评审决定不再实施，必须写明原因 |

任务只有同时满足以下条件才能改为 `PASS`：

1. 执行步骤完成；
2. 验收标准逐项满足；
3. 证据已保存且可追溯；
4. 相关 Bug 已修复或登记；
5. `PROJECT_STATUS.md`、`TEST_BACKLOG.md`、`TEST_STATUS.md` 已同步。

## 4. 每次提交必须更新什么

### 功能、Bug 或测试实现提交

1. 新增或更新 `docs/engineering-change-log/YYYY-MM-DD-*.md`；
2. 更新 `PROJECT_STATUS.md` 中对应工作包；
3. 测试状态变化时更新 `TEST_BACKLOG.md` 和 `TEST_STATUS.md`；
4. PR 合并后在 `CHANGE_LEDGER.md` 记录最终主干 SHA；
5. PR 描述列出实际命令、测试数量、失败和修复；
6. 未执行项目保持 `MANUAL`、`BLOCKED` 或 `DEFERRED`，不得写成通过。

### 纯文档提交

至少更新工程修改记录、提交台账和相关文档链接。

## 5. 分支生命周期

- 一个工作包只允许一个活动分支；
- 有现成活动分支时继续使用，不再创建近义分支；
- 分支必须从最新 `main` 创建；
- 所有修改、测试修复和文档闭环都继续提交在同一分支；
- 最新 HEAD 的 CI 全绿后，使用 Squash 合并；
- 合并后删除临时分支；
- 未确认 `main` 新 HEAD 前，不得报告“已进入 main”；
- 已合并的旧分支即使因 Squash 显示 `Ahead`，也不代表还有未合并功能。

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
| 性能 | k6/Lighthouse 原始 JSON、CPU/内存、错误率和 p95 |
| 阿里云 | ECS 地域、DNS/TCP/TLS/TTFB 原始输出和时间窗口 |
| TLS | 证书链、主机名、有效期、80→443 和续期演练 |
| 科学校准 | 数据许可、仪器型号、校准记录、地点/时间/天气和原始测量 |

## 7. 后续接力入口

```text
1. docs/project-tracking/README.md
2. docs/project-tracking/PROJECT_STATUS.md
3. docs/project-tracking/TEST_BACKLOG.md
4. docs/project-tracking/CODEX_HANDOFF.md
5. docs/testing/TEST_STATUS.md
6. 对应 engineering-change-log
```

不要只依据聊天记录决定“已完成”或“下一步”。
