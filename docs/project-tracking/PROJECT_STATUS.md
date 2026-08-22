# 逐星项目状态总览

> 状态日期：2026-08-22  
> 当前主干：`main@3fc11fcb00151b3ab8e80239137728132f51407e`  
> 当前唯一活动工作分支：无（本轮按用户要求直接提交 `main`）  
> 当前阶段：地图可读性与附近排行已实现，等待完整门禁和本地视觉验收

## 1. 当前结论

- 《逐星》详细测试方案 V1.0、第一阶段自动化和项目跟踪体系均已进入 `main`；
- 地图面板可移动/缩放、云量百分比条、暗夜数据缺失说明、分级行政边界、区域化取样点名称、海拔显示保护和观星计划附近排行已提交；
- `/sites` 继续复用统一地图引擎，但已使用“长期暗空”任务标题与今夜观测区分；
- 星空、云海、晚霞的产品边界和自动刷新策略已写入 `docs/product/WORKSPACE_ARCHITECTURE.md`；
- 本轮新增单元和 Chromium E2E 用例，但 GitHub 连接器无法读取直接推送到 `main` 的 Actions Check Run；在 Actions 或本地完整门禁确认前，本工作包保持 `IN_PROGRESS`，不虚报为 PASS；
- 真机、阿里云出口、正式 TLS、有许可栅格/边界和 SQM 科学校准仍不能声明为已验证。

## 2. 已完成工作包

| 工作包 | 状态 | 交付 | 关键证据 |
| --- | --- | --- | --- |
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
| UX-MAP-002 | IN_PROGRESS | `main` | `1edbdbe2`、`4c6349cb`、`3fc11fcb`：面板可读性、暗夜说明、行政边界、附近排行、工作区区分、测试和文档 | GitHub Actions 或本地 `npm run check`、Chromium E2E 全通过；用户完成一次桌面视觉验收 |

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
