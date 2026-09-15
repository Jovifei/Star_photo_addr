# 逐星工程文档入口

本目录是《逐星》的工程知识源。README 说明产品边界，`project-tracking/` 记录项目状态与提交台账，`testing/` 记录测试策略与结果，`engineering-change-log/` 记录每次变更的原因、实现和验证。

## 推荐阅读顺序

1. [项目制造与交付流程](./01-ARC-项目制造与交付流程.md)：从需求、数据、实现到测试、发布和部署的完整闭环。
2. [项目文档地图](./02-REF-项目文档地图.md)：按问题查找产品、数据、运维、测试和跟踪文档。
3. [当前工程指南](./GUIDE.md)：四个正式工作区、当前候选、接手顺序和已完成/未完成边界。
4. [README](../README.md)：当前产品能力、路线、数据语义和本地启动方式。
5. [工作区架构](./product/WORKSPACE_ARCHITECTURE.md)：今夜观测、暗夜选址、观星计划、火烧云和云海的职责边界。
6. [阿里云部署手册](./ALIYUN_DEPLOYMENT.md)：服务器、Docker Compose、Nginx、HTTPS 和发布后检查。
7. [测试说明](./TESTING.md) 与 [测试状态](./testing/TEST_STATUS.md)：测试分层、门禁、结果和未覆盖环境。
8. [项目状态](./project-tracking/PROJECT_STATUS.md)、[变更台账](./project-tracking/CHANGE_LEDGER.md)：当前主线、发布证据和后续工作。

## 文档维护规则

- 当前源码、实际命令输出和生产健康检查优先于旧计划或聊天记录。
- 每个功能、Bug、测试或部署变更至少新增一份 `engineering-change-log/` 记录，并同步版本记录和相关 tracking/testing 文档。
- 文档必须区分静态代码、构建、Mock E2E、真实数据源、生产运行和人工/真机证据；没有执行的项目保持 `MANUAL`、`BLOCKED` 或 `DEFERRED`。
- 不在文档、日志或示例中写入 Token、API Key、私钥、数据库 URI、原始个人位置或完整生产日志。
- `tasks/`、`superpowers/` 和阅读指南属于过程文件，不是项目知识结论；它们不替代本目录的工程记录。

## 当前版本与产品状态（2026-09-16）

已部署主线基线为 `main@3334e0c08f9ab2e481277628ce4ee875e2f1039e`（v1.0.18）。今夜观测、暗夜选址、火烧云和高山云海四个入口均已实现并纳入正式导航；云海不是“尚在开发的页面”，而是已完成第一阶段的 surface + pressure 条件指数工作区。云海仍保留 Beta/未校准标签，表示模式推导和科学准确率边界，不表示页面或功能未完成。

当前未合并候选分支 `codex/model-capability-recovery-20260915` 的本地提交为 `4118887`：恢复 GFS 默认模型、显式 ICON/AIFS 的字段隔离、评分字段 fail-closed、健康能力拆分、Open-Meteo 429 冷却和 worker 日期校验。该候选已完成本地 Node 24、浏览器和真实 GFS 验收，但尚未合并 main 或部署；Docker daemon 阻断了镜像 smoke。详情见 [`engineering-change-log/2026-09-15-model-capability-recovery-candidate.md`](./engineering-change-log/2026-09-15-model-capability-recovery-candidate.md)。

通用观星目录为 282 个点、覆盖 31 个省级行政区，首页搜索可返回太子尖、牵牛岗、九山顶、葛仙村和达瓦更扎等本地候选。版本记录见 [`CHANGELOG.md`](./CHANGELOG.md)，主线与候选状态见 [`project-tracking/PROJECT_STATUS.md`](./project-tracking/PROJECT_STATUS.md)。

知识库状态：2026-09-16 已对仓库文档执行 `codex-memory` 文档镜像 DryRun（识别 64 个文件、未写入）。当前 Vault 没有 `star_photo_addr` 项目映射，`load-memory`/`search-memory` 返回 `NO_PROJECT_MEMORY`；因此不能把镜像 DryRun 写成 Obsidian 已同步，也不会擅自创建项目目录。获得经授权的项目映射后，按本目录事实源重新执行实际镜像。
