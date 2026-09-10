# 逐星工程文档入口

本目录是《逐星》的工程知识源。README 说明产品边界，`project-tracking/` 记录项目状态与提交台账，`testing/` 记录测试策略与结果，`engineering-change-log/` 记录每次变更的原因、实现和验证。

## 推荐阅读顺序

1. [项目制造与交付流程](./01-ARC-项目制造与交付流程.md)：从需求、数据、实现到测试、发布和部署的完整闭环。
2. [项目文档地图](./02-REF-项目文档地图.md)：按问题查找产品、数据、运维、测试和跟踪文档。
3. [README](../README.md)：当前产品能力、路线、数据语义和本地启动方式。
4. [工作区架构](./product/WORKSPACE_ARCHITECTURE.md)：今夜观测、暗夜选址、观星计划、火烧云和云海的职责边界。
5. [阿里云部署手册](./ALIYUN_DEPLOYMENT.md)：服务器、Docker Compose、Nginx、HTTPS 和发布后检查。
6. [测试说明](./TESTING.md) 与 [测试状态](./testing/TEST_STATUS.md)：测试分层、门禁、结果和未覆盖环境。
7. [项目状态](./project-tracking/PROJECT_STATUS.md)、[变更台账](./project-tracking/CHANGE_LEDGER.md)：当前主线、发布证据和后续工作。

## 文档维护规则

- 当前源码、实际命令输出和生产健康检查优先于旧计划或聊天记录。
- 每个功能、Bug、测试或部署变更至少新增一份 `engineering-change-log/` 记录，并同步版本记录和相关 tracking/testing 文档。
- 文档必须区分静态代码、构建、Mock E2E、真实数据源、生产运行和人工/真机证据；没有执行的项目保持 `MANUAL`、`BLOCKED` 或 `DEFERRED`。
- 不在文档、日志或示例中写入 Token、API Key、私钥、数据库 URI、原始个人位置或完整生产日志。
- `tasks/`、`superpowers/` 和阅读指南属于过程文件，不是项目知识结论；它们不替代本目录的工程记录。

## 当前版本索引

当前工作分支正在收口 v1.0.12 发布候选；生产主线仍为 v1.0.11，合并后的最终 SHA、部署和公网验收必须回写到 tracking/testing 文档。版本记录见 [`CHANGELOG.md`](./CHANGELOG.md)，本轮工程记录见 `engineering-change-log/`。
