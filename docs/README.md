# 逐星工程文档入口

本目录是《逐星》的工程知识源。两个入口：

- **怎么做** → [ENGINEERING_PLAYBOOK.md](./ENGINEERING_PLAYBOOK.md)：提交/发布前必做步骤、错误记录与解决方案、快速排障索引。**每次写代码、部署、排障前必读。**
- **有什么** → 本文件：按功能归类的文档地图。

## 目录结构（2026-11-04 归类）

```
docs/
├── ENGINEERING_PLAYBOOK.md   # 必读执行手册（发布步骤 + 错误记录 + 排障）
├── README.md                 # 本文件：文档地图
├── CHANGELOG.md              # 文档目录自身变更记录
├── reference/                # 产品规划、数据决策、视觉系统等长期参考
├── deployment/               # 部署、运维、测试门禁、离线 E2E
├── acceptance/               # 版本验收与发布状态记录
├── audits/                   # 算法审计与校准报告
├── history/                  # 按日期归档的历史阶段报告与补丁
├── handoff-docs/             # 跨会话交接与远端授权文档
├── engineering-change-log/   # 每次变更的目的、根因、验证（持续追加）
├── project-tracking/         # 项目状态、变更台账、测试积压
├── testing/                  # 测试分层方案与执行状态
├── evidence/                 # 验收原始数据（JSON 矩阵、截图）
├── product/                  # 工作区架构
├── handoff/                  # 功能级交接记录
├── ui-audit/                 # UI/移动端审计与验证
├── qa/                       # 历史 QA 截图与复核
├── plans/                    # 阶段执行计划
├── research/                 # 站点研究产物
├── design-references/        # 外部参考站截图
├── gpt_plan/                 # 早期 GPT 协作计划（历史）
├── superpowers/              # 过程计划文件（历史）
├── openspec/                 # 规格说明
├── images/                   # README 配图
└── artifacts/                # 一次性产物（截图等）
```

## 快速查找

### 日常开发

| 文档 | 内容 | 更新时机 |
| --- | --- | --- |
| [ENGINEERING_PLAYBOOK.md](./ENGINEERING_PLAYBOOK.md) | 提交/发布必做步骤、错误记录、排障 | 每次新故障后必追加 |
| [reference/01-ARC-项目制造与交付流程.md](./reference/01-ARC-项目制造与交付流程.md) | 从需求到发布的制造闭环 | 架构或部署经验变化 |
| [reference/02-REF-项目文档地图.md](./reference/02-REF-项目文档地图.md) | 按问题查找文档（旧版地图，路径以本文件为准） | 大类调整时 |
| [project-tracking/PROJECT_STATUS.md](./project-tracking/PROJECT_STATUS.md) | 当前主线、完成项、阻断项 | 每个工作包结束 |
| [project-tracking/CHANGE_LEDGER.md](./project-tracking/CHANGE_LEDGER.md) | 合并后的主线 SHA 与证据 | 每次合并 |

### 部署与运维

| 文档 | 内容 |
| --- | --- |
| [deployment/ALIYUN_DEPLOYMENT.md](./deployment/ALIYUN_DEPLOYMENT.md) | 阿里云 ECS、Docker Compose、Nginx、HTTPS、发布后检查 |
| [deployment/DEPLOYMENT.md](./deployment/DEPLOYMENT.md) | 通用 VPS 部署与升级 |
| [deployment/OPERATIONS.md](./deployment/OPERATIONS.md) | 配额、缓存、stale、排障 |
| [deployment/ALIYUN_DATA_REFRESH_CHECKLIST.md](./deployment/ALIYUN_DATA_REFRESH_CHECKLIST.md) | TTL、强刷冷却、数据源刷新验收 |
| [deployment/TESTING.md](./deployment/TESTING.md) | 测试分层与门禁 |
| [deployment/OFFLINE_E2E.md](./deployment/OFFLINE_E2E.md) | 离线 E2E 运行方式 |
| [deployment/DARK_SKY_DATA_SETUP.md](./deployment/DARK_SKY_DATA_SETUP.md) | 本地 Bortle/SQM 资产安装 |
| [deployment/REMOTE_DEPLOYMENT_PRIVATE_GUIDE.md](./deployment/REMOTE_DEPLOYMENT_PRIVATE_GUIDE.md) | 私有运维说明（含敏感边界，不入知识库镜像） |

### 数据与视觉规范

| 文档 | 内容 |
| --- | --- |
| [reference/LIGHT_POLLUTION_DATA_DECISION.md](./reference/LIGHT_POLLUTION_DATA_DECISION.md) | VIIRS、World Atlas 与 SQM/Bortle 的语义边界 |
| [reference/PUBLIC_ASSETS_AUDIT.md](./reference/PUBLIC_ASSETS_AUDIT.md) | 公共资源审计与降级路径 |
| [reference/UNIFIED_VISUAL_SYSTEM.md](./reference/UNIFIED_VISUAL_SYSTEM.md) | 主题 token、面板、地图视觉规则 |
| [reference/THEME_SYSTEM.md](./reference/THEME_SYSTEM.md) | 主题系统与可访问性规则 |
| [reference/UI_UX_PRO_MAX_AUDIT.md](./reference/UI_UX_PRO_MAX_AUDIT.md) | UI/UX 审计结论 |
| [reference/PERSEIDS_REFERENCE_AUDIT.md](./reference/PERSEIDS_REFERENCE_AUDIT.md) | 参考站结构分析 |
| [product/WORKSPACE_ARCHITECTURE.md](./product/WORKSPACE_ARCHITECTURE.md) | 四个工作区职责边界 |

### 云海与评分校准（审计）

| 文档 | 内容 |
| --- | --- |
| [audits/CLOUDSEA_CALIBRATION_HANDOFF_20261103.md](./audits/CLOUDSEA_CALIBRATION_HANDOFF_20261103.md) | 命中率校准接力与辐射谷雾定标判据 |
| [audits/CLOUDSEA_CONSERVATIVE_HOLDOUT_20261026.md](./audits/CLOUDSEA_CONSERVATIVE_HOLDOUT_20261026.md) | 保守候选独立留出验证 |
| [audits/CLOUDSEA_CALIBRATION_AUDIT_20261023.md](./audits/CLOUDSEA_CALIBRATION_AUDIT_20261023.md) | 评分反例复现与数据能力实测 |
| [audits/ICON_CLOUDSEA_SOURCE_DIAGNOSIS_20261029.md](./audits/ICON_CLOUDSEA_SOURCE_DIAGNOSIS_20261029.md) | ICON 能见度缺失与压力层诊断 |
| [audits/EMPIRICAL_CLOUDSEA_CALIBRATION_20261025.md](./audits/EMPIRICAL_CLOUDSEA_CALIBRATION_20261025.md) | 经验定标方法与边界 |

### 验收与发布记录

| 文档 | 内容 |
| --- | --- |
| [acceptance/CLOUDSEA_ENGINEERING_DELIVERY_20261027.md](./acceptance/CLOUDSEA_ENGINEERING_DELIVERY_20261027.md) | 云海工程交付验收 |
| [acceptance/SCORING_FINAL_DELIVERY_20261024.md](./acceptance/SCORING_FINAL_DELIVERY_20261024.md) | 评分加固最终交付 |
| [acceptance/FIREGLOW_RELEASE_STATUS_20261029.md](./acceptance/FIREGLOW_RELEASE_STATUS_20261029.md) | v1.0.29 发布与回滚记录 |
| [acceptance/FIREGLOW_GATE_RECHECK_20261029.md](./acceptance/FIREGLOW_GATE_RECHECK_20261029.md) | 数据源门禁复核 |
| [history/](./history/) | 2026-08~10 各阶段部署/验收报告（按日期归档） |

### 历史交接

| 文档 | 内容 |
| --- | --- |
| [handoff-docs/CODEX_HANDOFF_MAP_PHASE2.md](./handoff-docs/CODEX_HANDOFF_MAP_PHASE2.md) | Phase2 任务地图（历史） |
| [handoff-docs/HANDOFF_SCORING_FULL_STAGE_20261024.md](./handoff-docs/HANDOFF_SCORING_FULL_STAGE_20261024.md) | 评分加固阶段授权 |
| [handoff-docs/HANDOFF_REMOTE_FULL_STAGE_20261008.md](./handoff-docs/HANDOFF_REMOTE_FULL_STAGE_20261008.md) | 远端阶段授权 |
| [handoff-docs/NEXT_SESSION_PROMPT_20261008.md](./handoff-docs/NEXT_SESSION_PROMPT_20261008.md) | 会话接力提示（历史） |
| [handoff-docs/INDEPENDENT_AGENT_AUDIT_REQUEST_PRIVATE_20261004.md](./handoff-docs/INDEPENDENT_AGENT_AUDIT_REQUEST_PRIVATE_20261004.md) | 独立审计请求（私有） |
| [handoff/](./handoff/) | 功能级交接（观测完整性、移动内容流） |

## 文档维护规则

- 当前源码、实际命令输出和生产健康检查优先于旧计划或聊天记录。
- 每个功能、Bug、测试或部署变更至少新增一份 `engineering-change-log/` 记录；**每个新故障必须在 [ENGINEERING_PLAYBOOK.md](./ENGINEERING_PLAYBOOK.md) 追加 E-xxx 条目**。
- 文档必须区分静态代码、构建、Mock E2E、真实数据源、生产运行和人工/真机证据；没有执行的保持 `MANUAL`、`BLOCKED` 或 `DEFERRED`。
- 不在文档写入 Token、API Key、私钥、数据库 URI、原始个人位置或完整生产日志。
- `tasks/`、`superpowers/`、`gpt_plan/` 属于过程文件，不是项目知识结论。
- 移动或新增 docs 文件后，必须全仓扫描 `docs/<旧路径>` 引用并修复，同时更新本文件索引。

## 版本索引

代码版本与用户可见更新以根目录 `package.json` 和根 [`CHANGELOG.md`](../CHANGELOG.md) 为准；生产部署状态必须用 `/healthz` 实测 `version` 与 `buildRevision` 确认。
