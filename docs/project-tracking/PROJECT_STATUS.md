# 逐星项目状态总览

> 状态日期：2026-09-10
> 当前主干：`main@a66ad049dfd69a87b0f97b5a5870679163260427`（v1.0.11）
> 当前活动工作分支：`codex/unified-score-filters-20260910`（v1.0.12 发布候选）
> 当前阶段：v1.0.12 已完成实现和本地质量门禁，待分支发布、合并、部署与公网验收；生产仍为 v1.0.11

## 0. 当前发布快照（v1.0.12 发布候选）

- 顶部命令栏按“评分时间 → B1–B4 暗空参考 → 推荐门槛 → 仅显示推荐地点”排列；搜索、定位和四组参数保持紧凑同排，窄屏才堆叠。
- B1–B4 文案和分数预设明确为：B1 极暗 ≥85、B2 自然暗夜 ≥70、B3 乡村夜空 ≥55、B4 乡村/郊区过渡 ≥50；命令栏档位单选并同步推荐门槛，目录参考不进入实时天气评分。
- 主页默认使用云量预报 + 光污染参考，卫星实况及其较高的 24 小时时间轴需主动选择；旧的持久化实况状态会在无显式 URL 时迁移回默认组合。
- 火烧云和云海排行各自增加 0–100 分门槛滑块，列表只保留 `score >= threshold` 的数值评分点位；null/数据不足点位不计入达标数量，地图标记仍保留未知语义。
- 当前候选已通过 `npm run check`（52 个测试文件 / 304 项），专题门槛和首页默认行为有独立 Chromium 桌面/移动 E2E；生产仍保持 v1.0.11，待最终公网验收回写 SHA。

以下第 1–8 节保留历史工作包与长期未完成项；新的发布状态以本节和对应最新工程记录为准。

## 1. 当前结论

- 《逐星》详细测试方案 V1.0、第一阶段自动化和项目跟踪体系均已进入 `main`；
- 地图面板可移动/缩放、云量百分比条、暗夜数据缺失说明、分级行政边界、区域化取样点名称、海拔显示保护和观星计划附近排行已提交；
- `/sites` 继续复用统一地图引擎，但已使用“长期暗空”任务标题与今夜观测区分；
- 星空、云海、晚霞的产品边界和自动刷新策略已写入 `docs/product/WORKSPACE_ARCHITECTURE.md`；
- 本轮新增单元和 Chromium E2E 用例；发布前仍需完成远端分支推送、main 合并、部署和公网验收，未完成前不把候选写成生产 PASS；
- 真机、阿里云出口、正式 TLS、有许可栅格/边界和 SQM 科学校准仍不能声明为已验证。

## 2. 已完成工作包

| 工作包 | 状态 | 交付 | 关键证据 |
| --- | --- | --- | --- |
| RELEASE-UI-012 | IN_PROGRESS | 顶部控件统一、主页默认图层纠偏、火烧云/云海评分门槛滑块、v1.0.12 记录 | 当前分支 `codex/unified-score-filters-20260910`；`npm run check` 52/304、Chromium E2E 110/34、live smoke/audit 通过；待 push、合并和部署 |
| RELEASE-UI-011 | PASS | 顶部直接筛选控件、B1–B4 说明、v1.0.11 版本记录、生产部署和公网验收 | `main@a66ad049dfd6`；`npm run check`、Chromium E2E、live smoke、audit、生产 `/healthz` |
| DOC-README-001 | PASS | 图形化 README、使用说明、截图与部署命令 | `c16804b...` / PR #8 |
| DATA-HARDEN-001 | PASS | 云量刷新、卫星、VIIRS、快照、AQI/气压/Kp、阿里云链路加固 | `2910b236...` / PR #9 |
| DATA-AUDIT-002 | PASS | 坐标校验、共享 GIBS、分源 TTL、冷缓存强刷保护 | `3ca93736...` + 纠偏 `02281ce7...` |
| UX-VIEWPORT-001 | PASS | 当前视野推荐、编号标记、卡片排序、移动端层级修复 | `94043d87...` / PR #10 |
| QA-PLAN-001 | PASS | 《逐星》详细测试方案 V1.0 与初始状态清单 | `18e03cdf...` / PR #11 |
| QA-AUTO-001 | PASS | 契约/集成/故障注入/跨浏览器/CI 证据及 3 项 Bug 修复 | `50496e61...` / PR #12 |
| TRACK-001 | PASS | 项目状态、剩余测试任务卡、提交台账、Codex 接力和分支规则 | `3a461c09...` / PR #13 |

## 3. 当前进行中

| 工作包 | 状态 | 分支 | 已提交内容 | 完成条件 |
| --- | --- | --- | --- | --- |
| RELEASE-UI-012 | IN_PROGRESS | `codex/unified-score-filters-20260910` | v1.0.12 功能、测试和版本文档已在候选分支；生产仍为 v1.0.11 | 分支 push、main 合并、部署和公网验收；本地完整 E2E/live/audit 已通过 |

## 4. 已合并、可清理的远端分支

以下分支的功能或文档已经进入 `main`；GitHub 因 Squash/Merge 提交拓扑仍可能显示 `Ahead`，不代表存在遗漏功能：

```text
codex/unify-stargazing-theme-20260819      → PR #7 已合并
docs/readme-visual-guide-20260819          → PR #8 已合并
fix/data-refresh-aliyun-audit-20260819     → PR #9 已合并
feat/province-viewport-recommendations-20260820 → PR #10 已合并
docs/test-plan-v1-20260820                 → PR #11 已合并
test/quality-foundation-v1-20260820        → PR #12 已合并
test/ux-research-quality-v2-20260820       → PR #13 已合并
audit/module-data-aliyun-readiness-20260820 → 无独有提交，已被 main 完整超越
```

删除这些分支不会删除已经进入 `main` 的最终功能；提交和 PR 历史仍可追溯。

## 5. 待完成工作包

### 5.1 本轮需要用户环境补充

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| UX-MAP-002-LOCAL | 拉取本轮主干并做桌面视觉验收 | MANUAL | P0 | 本地 Node 24、Chromium；重点检查面板拖动/缩放、无遮挡、附近排行 |
| DATA-DARKSKY-001 | 安装有许可的 Bortle/SQM 数值栅格 | BLOCKED | P0（仅针对数值暗夜能力） | 合法数据文件、服务器写权限、重新构建镜像 |
| MAP-BOUNDARY-001 | 配置天地图令牌或本地授权边界包 | BLOCKED | P1 | 天地图账号/令牌或有许可 GeoJSON；域名白名单 |

### 5.2 真机与人工体验

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| DEV-IOS-001 | iPhone Safari 真机 | MANUAL | P0 | iPhone、HTTPS 可访问环境 |
| DEV-ANDROID-001 | Android 多厂商 | MANUAL | P1 | 至少 Pixel/三星/小米或等效设备 |
| UX-ZOOM-001 | 200% 浏览器缩放 | MANUAL | P1 | 桌面 Chrome/Firefox/Edge |
| A11Y-COLOR-001 | 高对比与色觉模式 | MANUAL | P1 | Windows 高对比、灰阶/色觉模拟 |

### 5.3 部署基础设施

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| DEP-ECS-001 | 阿里云大陆 ECS 海外出口 | BLOCKED | P0 | 实际 ECS、地域、服务器访问权限 |
| DEP-TLS-001 | 正式域名 TLS | BLOCKED | P0 | 域名、DNS、证书/ACME、Nginx |

### 5.4 性能、稳定性与视觉

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| PERF-K6-050 | k6 50 用户压力 | DEFERRED | P1 | 预发布环境、监控、限流基线 |
| PERF-K6-100 | k6 100 用户突发 | DEFERRED | P1 | 50 用户通过、上游保护确认 |
| PERF-SOAK-030 | 30 分钟 soak | DEFERRED | P1 | 预发布环境、CPU/内存采集 |
| PERF-LHCI-001 | Lighthouse CI | DEFERRED | P2 | 稳定 Mock 或预发布页面 |
| VIS-BASE-001 | 像素视觉基线 | DEFERRED | P1 | 稳定字体、Mock 地图、人工审批流程 |

### 5.5 科学数据校准

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| SCI-SQM-001 | Bortle/SQM 科学真值 | BLOCKED | P0（仅针对科学声明） | 授权栅格、SQM 仪器、现场样本、校准方案 |

详细步骤、验收标准和证据见 [`TEST_BACKLOG.md`](./TEST_BACKLOG.md)；本轮暗夜资产安装步骤见 [`../DARK_SKY_DATA_SETUP.md`](../DARK_SKY_DATA_SETUP.md)。

## 6. 本轮本地验收顺序

```bash
git checkout main
git pull --ff-only
npm ci
npm run check
npx playwright install chromium
npm run test:e2e
```

视觉重点：

1. 左上“观星地点”和右上“云量与图层”可通过“面板布局”调整 90%–135%；
2. 拖动面板标题后不影响地图缩放、按钮和滑杆；
3. 总云量/高云/中云/低云显示为横向百分比条；
4. `/sites` 显示长期暗空任务说明；
5. 无本地栅格时天顶亮度/Bortle 显示“未安装”而不是假值；
6. `/planner` 的附近排行可切换 10/50/100/200 km。

## 7. 发布阻断规则

以下任一情况存在时，不得把对应能力标记为“生产已验证”：

- P0 测试未通过；
- iPhone Safari 核心流程不可操作；
- 阿里云 ECS 无法稳定访问关键上游；
- TLS 证书链、主机名或续期未验证；
- 性能测试出现持续 5xx、OOM 或刷新绕过；
- stale 数据未明确标记；
- 未经现场校准却输出精确 SQM/Bortle 真值。

## 8. 下次更新要求

下一轮提交必须更新：

- 本文件中对应工作包状态；
- `TEST_BACKLOG.md` 的执行记录；
- `TEST_STATUS.md` 的结果汇总；
- `CHANGE_LEDGER.md`；
- 一份对应的 `engineering-change-log`。
