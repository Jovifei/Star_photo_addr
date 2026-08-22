# 逐星项目状态总览

> 状态日期：2026-08-22  
> 主干已包含：PR #13 / `3a461c09a2cb450de710f87490ff9317b2d81a8e`  
> 当前唯一活动工作分支：无  
> 当前阶段：跟踪体系已落地，等待选择下一工作包

## 1. 当前结论

- 《逐星》详细测试方案 V1.0 已进入 `main`；
- 契约、API 集成、故障注入、键盘焦点、Chromium、Firefox、WebKit、真实数据源和容器测试已完成第一阶段并通过；
- 云量契约、跨浏览器配置、移动端刷新竞态及日期相关的评分筛选 E2E 均已修复；
- 未完成测试已升级为可直接交给 Codex/人工执行的任务卡，并随 PR #13 合入 `main`；
- 当前没有未合并功能分支；真机、阿里云、TLS、性能、视觉回归和科学真值仍不能声明为已验证。

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

当前没有活动工作包和未合并功能分支。下一项工作应先从最新 `main` 创建一个唯一分支，完成后合并并删除该分支。

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

### 5.1 真机与人工体验

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| DEV-IOS-001 | iPhone Safari 真机 | MANUAL | P0 | iPhone、HTTPS 可访问环境 |
| DEV-ANDROID-001 | Android 多厂商 | MANUAL | P1 | 至少 Pixel/三星/小米或等效设备 |
| UX-ZOOM-001 | 200% 浏览器缩放 | MANUAL | P1 | 桌面 Chrome/Firefox/Edge |
| A11Y-COLOR-001 | 高对比与色觉模式 | MANUAL | P1 | Windows 高对比、灰阶/色觉模拟 |

### 5.2 部署基础设施

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| DEP-ECS-001 | 阿里云大陆 ECS 海外出口 | BLOCKED | P0 | 实际 ECS、地域、服务器访问权限 |
| DEP-TLS-001 | 正式域名 TLS | BLOCKED | P0 | 域名、DNS、证书/ACME、Nginx |

### 5.3 性能、稳定性与视觉

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| PERF-K6-050 | k6 50 用户压力 | DEFERRED | P1 | 预发布环境、监控、限流基线 |
| PERF-K6-100 | k6 100 用户突发 | DEFERRED | P1 | 50 用户通过、上游保护确认 |
| PERF-SOAK-030 | 30 分钟 soak | DEFERRED | P1 | 预发布环境、CPU/内存采集 |
| PERF-LHCI-001 | Lighthouse CI | DEFERRED | P2 | 稳定 Mock 或预发布页面 |
| VIS-BASE-001 | 像素视觉基线 | DEFERRED | P1 | 稳定字体、Mock 地图、人工审批流程 |

### 5.4 科学数据校准

| ID | 项目 | 状态 | 优先级 | 依赖 |
| --- | --- | --- | --- | --- |
| SCI-SQM-001 | Bortle/SQM 科学真值 | BLOCKED | P0（仅针对科学声明） | 授权栅格、SQM 仪器、现场样本、校准方案 |

详细步骤、验收标准和证据见 [`TEST_BACKLOG.md`](./TEST_BACKLOG.md)。

## 6. 推荐执行顺序

### 阶段 A：无需外部账号即可推进

1. `PERF-K6-050`：编写受控负载脚本与报告模板；
2. `PERF-SOAK-030`：建立 30 分钟稳定性脚本；
3. `PERF-LHCI-001`：加入可重复性能基线；
4. `VIS-BASE-001`：为关键状态生成稳定截图基线；
5. `UX-ZOOM-001`、`A11Y-COLOR-001`：人工验收并登记问题。

### 阶段 B：需要设备

1. `DEV-IOS-001`；
2. `DEV-ANDROID-001`；
3. 将真机发现的问题转为可稳定自动化的回归测试。

### 阶段 C：阿里云发布准备

1. `DEP-ECS-001`；
2. `DEP-TLS-001`；
3. 在 ECS/正式域名上重跑数据源、容器、负载和长稳测试。

### 阶段 D：科学真值

1. 确认栅格和数据许可；
2. 确认 SQM 仪器与采样协议；
3. 执行 `SCI-SQM-001`；
4. 只有通过后才允许新增精确 Bortle/SQM 科学声明。

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
