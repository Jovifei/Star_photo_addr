# 逐星项目文档地图

## 1. 权威层级

遇到结论不一致时按以下顺序核对：

1. 当前源码、配置、测试和实际命令输出；
2. 根 `README.md` 与本目录维护的工程文档；
3. Git 提交、部署健康检查和真实数据源结果；
4. Obsidian 项目记忆（仅作上下文，不能代替当前证据）；
5. 聊天记录、截图或旧计划（只能帮助定位问题）。

文档必须标明证据类型：静态源码、构建、Mock、真实 Provider、生产运行、浏览器人工观察或真机/科学测量。没有证据的预期只能写为计划或风险。

## 2. 按主题查找

### 产品、架构与语义

| 文档 | 说明 | 更新时机 |
| --- | --- | --- |
| [`../README.md`](../README.md) | 产品目标、四个工作区、数据边界、本地启动和 API 总览 | 产品能力、路线或运行方式变化 |
| [`01-ARC-项目制造与交付流程.md`](./01-ARC-项目制造与交付流程.md) | 从需求到发布的制造闭环、文件职责、门禁、部署和回滚 | 架构、发布或部署经验变化 |
| [`product/WORKSPACE_ARCHITECTURE.md`](./product/WORKSPACE_ARCHITECTURE.md) | 星空、暗夜选址、观星计划、云海、晚霞职责边界 | 工作区职责或数据模型变化 |
| [`UNIFIED_VISUAL_SYSTEM.md`](./UNIFIED_VISUAL_SYSTEM.md) | 主题 token、面板、地图、表格和移动端视觉规则 | 设计系统变化 |
| [`UI_UX_PRO_MAX_AUDIT.md`](./UI_UX_PRO_MAX_AUDIT.md) | UI/UX 审计结论、触控尺寸、可访问性和响应式原则 | UI 审计或回归规则变化 |

### 数据、许可与真实性

| 文档 | 说明 | 更新时机 |
| --- | --- | --- |
| [`DARK_SKY_DATA_SETUP.md`](./DARK_SKY_DATA_SETUP.md) | 本地 Bortle/SQM、边界资产的许可、目录、开关和验证 | 资产、令牌或许可状态变化 |
| [`LIGHT_POLLUTION_DATA_DECISION.md`](./LIGHT_POLLUTION_DATA_DECISION.md) | VIIRS、World Atlas 与 SQM/Bortle 的语义和接入决策 | 数据源、许可或评分边界变化 |
| [`PUBLIC_ASSETS_AUDIT.md`](./PUBLIC_ASSETS_AUDIT.md) | 公共资源审计、不可恢复资源和降级路径 | 资源恢复/清理或合规复核 |
| [`PERSEIDS_REFERENCE_AUDIT.md`](./PERSEIDS_REFERENCE_AUDIT.md) | 参考站结构分析与清洁实现边界 | 参考设计或来源边界变化 |

### 部署、运维和数据刷新

| 文档 | 说明 | 更新时机 |
| --- | --- | --- |
| [`ALIYUN_DEPLOYMENT.md`](./ALIYUN_DEPLOYMENT.md) | Linux/ECS、Docker Compose、Nginx、HTTPS、健康检查 | 服务器、域名或 Compose 变化 |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | 通用 VPS 部署和日常升级 | 通用部署方式变化 |
| [`REMOTE_DEPLOYMENT_PRIVATE_GUIDE.md`](./REMOTE_DEPLOYMENT_PRIVATE_GUIDE.md) | 维护者私有部署操作说明；包含敏感环境边界，不应直接镜像到知识库 | 运维流程或权限变化 |
| [`ALIYUN_DATA_REFRESH_CHECKLIST.md`](./ALIYUN_DATA_REFRESH_CHECKLIST.md) | TTL、强刷冷却、响应头和数据源刷新验收 | 缓存、刷新或 Provider 变化 |
| [`OPERATIONS.md`](./OPERATIONS.md) | 配额、缓存、stale、故障和常见排障 | 运维故障或运行参数变化 |

### 测试、质量和发布

| 文档 | 说明 | 更新时机 |
| --- | --- | --- |
| [`TESTING.md`](./TESTING.md) | 测试怎么写、如何分层、已知 Bug 与改进路线 | 测试策略或工具变化 |
| [`testing/TEST_PLAN_V1.md`](./testing/TEST_PLAN_V1.md) | 测试范围、P0/P1/P2、门禁和建议目录 | 验收标准或测试分层变化 |
| [`testing/TEST_STATUS.md`](./testing/TEST_STATUS.md) | 实际执行结果、通过数量和未覆盖项目 | 每轮门禁结束 |
| [`project-tracking/TEST_BACKLOG.md`](./project-tracking/TEST_BACKLOG.md) | MANUAL、BLOCKED、DEFERRED 测试执行卡 | 测试依赖或状态变化 |
| [`CHANGELOG.md`](./CHANGELOG.md) / [`../CHANGELOG.md`](../CHANGELOG.md) | 文档目录与根目录版本变更记录 | 每次版本发布 |

### 项目跟踪与接力

| 文档 | 说明 | 更新时机 |
| --- | --- | --- |
| [`project-tracking/README.md`](./project-tracking/README.md) | 文档事实源、状态定义、分支和提交规则 | 跟踪流程变化 |
| [`project-tracking/PROJECT_STATUS.md`](./project-tracking/PROJECT_STATUS.md) | 当前主线、完成项、未完成项和阻断项 | 每个工作包结束/阶段变化 |
| [`project-tracking/CHANGE_LEDGER.md`](./project-tracking/CHANGE_LEDGER.md) | 合并后的主线 SHA、解决的问题和证据 | 每次合并或重要 main 提交 |
| [`project-tracking/CODEX_HANDOFF.md`](./project-tracking/CODEX_HANDOFF.md) | 新会话读取顺序、接力模板和禁止事项 | 接力流程或优先级变化 |
| [`engineering-change-log/`](./engineering-change-log/) | 单次变更的目的、根因、修改、验证和回滚 | 每个功能/Bug/部署提交 |

## 3. 三条常用阅读路径

### 新开发者接手

`docs/README.md` → 根 `README.md` → `01-ARC-项目制造与交付流程.md` → `product/WORKSPACE_ARCHITECTURE.md` → 当前 `engineering-change-log` → 源码和测试。

### 发布或部署

`project-tracking/PROJECT_STATUS.md` → `testing/TEST_STATUS.md` → 当前工程变更记录 → `ALIYUN_DEPLOYMENT.md` → `01-ARC-项目制造与交付流程.md §4` → 生产 `/healthz` 与数据源检查。

### 数据真实性或暗夜能力

根 `README.md` 的科学语义 → `LIGHT_POLLUTION_DATA_DECISION.md` → `DARK_SKY_DATA_SETUP.md` → `PUBLIC_ASSETS_AUDIT.md` → `testing/TEST_BACKLOG.md` 的 `DATA-DARKSKY-001` / `SCI-SQM-001`。

## 4. 哪些内容不应当写成当前知识

- `tasks/` 中的 Todo、计划、临时诊断和自动化代理状态；
- `superpowers/plans`、`superpowers/specs`、阅读指南和模板；
- 只在本地生成但未复核的构建目录、截图、trace、video、数据库和原始日志；
- 未脱敏的服务器命令输出、内部地址、凭证、Token、个人位置和第三方原始响应；
- “HTTP 200”“Mock 通过”“静态代码看起来可用”以外没有运行证据的生产结论。

## 5. 文档变更模板

新增或修改工程知识文档时，按以下顺序写：

```text
结论 → 背景/问题 → 当前实现 → 关键文件 → 验证证据 → 未覆盖边界 → 回滚/下一步
```

单次变更至少应能回答：为什么改、改了什么、怎么验证、哪些仍未验证、下一位维护者从哪里继续。
