# Codex 接力说明：逐星测试与项目跟踪

> 当前事实源：仓库文档，不以聊天摘要代替。  
> 当前主分支：`main@50496e61f0be1cb666f344f36d832029df2e988e`  
> 当前跟踪分支：`test/ux-research-quality-v2-20260820`

## 1. 开始前必须读取

```text
docs/project-tracking/README.md
docs/project-tracking/PROJECT_STATUS.md
docs/project-tracking/TEST_BACKLOG.md
docs/testing/TEST_PLAN_V1.md
docs/testing/TEST_STATUS.md
docs/project-tracking/CHANGE_LEDGER.md
```

然后读取所选工作包相关的源码、测试和最近工程修改记录。

## 2. 任务选择规则

1. 从 `PROJECT_STATUS.md` 选择最高优先级且未阻塞的工作包；
2. `MANUAL` 任务可以编写检查清单和辅助脚本，但没有真机证据时不得标记 PASS；
3. `BLOCKED` 任务只能准备脚本/文档，不得虚构 ECS、TLS 或科学校准结果；
4. 同一工作包只使用一个活动分支；
5. 不要同时创建 performance、visual、docs 多个分支；
6. 先完成代码与测试，再更新状态和提交台账。

## 3. 推荐下一工作包

优先建议：

```text
PERF-K6-050
PERF-K6-100
PERF-SOAK-030
```

建议放在同一个分支：

```text
test/performance-baseline-v1-YYYYMMDD
```

实施内容：

- `tests/performance/k6-smoke.js`；
- `tests/performance/k6-load.js`；
- `tests/performance/k6-soak.js`；
- 负载测试环境变量和安全保护；
- npm scripts；
- 可手工触发的 GitHub Actions workflow；
- JSON/HTML artifact；
- 文档和状态更新。

重要限制：

- 默认压测缓存命中和应用层，不对第三方 Provider 直接放大压力；
- 强制刷新必须使用极低比例，并验证应用冷却；
- 没有隔离预发布环境时，只提交脚本和 dry-run，不在生产执行；
- 不能把预期 429 计为业务 5xx，但必须单独统计。

## 4. 标准执行流程

```text
读取事实源
→ 确认 main HEAD
→ 确认没有同工作包活动分支
→ 从 main 创建唯一分支
→ 写测试或脚本
→ 运行最小专项测试
→ 运行 npm run check
→ 运行相关 E2E/容器/性能门禁
→ 修复真实问题
→ 更新 tracking/testing/change-log
→ git diff --check
→ 提交远端
→ 创建一个 PR
→ 等待并核对最终 HEAD CI
→ Squash 合并
→ 更新 CHANGE_LEDGER
```

## 5. 文档更新清单

每轮必须检查：

- [ ] `PROJECT_STATUS.md`：状态是否变化；
- [ ] `TEST_BACKLOG.md`：是否追加执行记录；
- [ ] `TEST_STATUS.md`：测试数量、结果、Bug；
- [ ] `CHANGE_LEDGER.md`：合并后 SHA；
- [ ] `engineering-change-log`：目的、修改、验证、回滚；
- [ ] PR 描述：未完成边界是否明确。

## 6. 结果报告格式

```text
WORK_PACKAGE:
BRANCH:
HEAD:
PR:
CHANGED_FILES:
TEST_COMMANDS:
RESULTS:
BUGS_FOUND:
BUGS_FIXED:
MANUAL/BLOCKED/DEFERRED:
MAIN_MERGED:
MAIN_HEAD:
```

如果 CI 仍在运行，报告 `CI_RUNNING`；不要重复提交同内容来“催促”工具返回。

## 7. 禁止事项

- 不删除失败测试来获取绿灯；
- 不仅延长 timeout 掩盖竞态；
- 不降低断言而不解释；
- 不把 WebKit 自动化写成 iPhone 真机通过；
- 不把本地网络测试写成阿里云大陆 ECS 通过；
- 不把 VIIRS 视觉图层写成 SQM/Bortle 现场真值；
- 不在 URL、日志或 artifact 中保存 Token、API Key、精确私人位置；
- 不在同一任务中不断创建新分支。
