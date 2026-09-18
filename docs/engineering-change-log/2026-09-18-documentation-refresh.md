# 工程修改跟踪：文档事实源与近期制作经验收口

> 日期：2026-09-18
> 类型：文档/接力/知识库维护，不是产品版本发布。
> 主线基线：`main@3334e0c08f9ab2e481277628ce4ee875e2f1039e`（v1.0.18）。

## 1. 为什么需要更新

主线旧文档仍停留在 v1.0.14 的发布索引，`CODEX_HANDOFF.md` 还引用已过期的 `main@50496e6` 和历史测试分支；部分历史架构记录把云海写成实验能力、把火烧云写成规划中。模型恢复候选的文档已经补充了较新的事实，但尚未进入 main，导致不同 Agent 读取不同分支时得到相互矛盾的结论。

## 2. 当前事实

- 今夜观测、暗夜选址、火烧云、高山云海四个入口均已进入正式导航；云海第一阶段已完成 surface + pressure profile，Beta/未校准只表示科学准确率边界。
- `codex/model-capability-recovery-20260915` 的代码候选已完成 Node24、本地全仓、浏览器和真实 GFS 验收，但仍未合并 main、未部署；Docker daemon 阻断容器 smoke。
- `codex/mobile-responsive-layout-20260918` 只有只读布局证据和实施计划，状态为 `PLAN_READY_WAITING_CODE_AUTHORIZATION`；尚未修改源码、测试、版本或生产配置。

## 3. 本次文档调整

- 新增/维护 `docs/GUIDE.md`、主线 README、工作区架构、制造流程、项目状态、测试状态、测试 backlog、变更台账和 Codex 接力说明。
- 为历史记录补充时间和“历史/已被后续版本取代”注记，保留审计历史，不把旧结论当作当前状态。
- 在根/Docs Changelog 记录本次文档收口，不提升版本号、不伪造 v1.0.19、不宣称候选已发布。

## 4. 可复用经验

1. Agent 接力入口必须先写当前 main SHA、活动候选、是否合并/部署，以及“已实现”和“未校准”的区别；历史章节只能作为历史证据。
2. UI 只读截图/浏览器观察必须单独标记为观察或计划；固定 fixture 的 E2E、跨浏览器、真机和生产运行证据不能互相替代。
3. 数据层文档必须同时记录模型身份、`cloudAvailable`/`scoringAvailable`、stale/源时间、429 冷却和 Docker/生产阻断，不把 HTTP 200 或本地绿灯写成现场准确率。
4. Obsidian 镜像必须先 DryRun；没有项目映射时保留 `NO_PROJECT_MEMORY`/`MEMORY_SYNC_BLOCKED`，不凭目录名创建 Vault 项目。

## 5. 验证和边界

- 本次只做文档与接力状态维护；`git diff --check`、关键本地链接和敏感内容扫描必须通过。
- 模型恢复候选的既有结果仍按 `docs/testing/TEST_STATUS.md` 记录；本次文档提交不重复宣称代码测试或部署成功。
- 移动端响应式计划的 RED、实现、多视口截图、跨浏览器和真机均为 `NOT_RUN`/待授权。
- Obsidian 项目映射当前缺失，实际 Vault checkpoint/mirror 不可执行；只允许记录阻断状态。
