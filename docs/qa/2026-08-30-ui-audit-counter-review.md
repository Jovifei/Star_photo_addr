# UI 信息架构审核报告 · 反评审

> 评审对象：另一位 agent 的《UI 审核已完成》（基线 `audit/ui-information-architecture-20260829`）
> 评审人：主理人（齐活林）
> 评审时间：2026-08-30
> 取证方式：全部结论来自本机 on-disk 真实状态（git 对象 / 工作区文件 / `tmp/ui-batch0-validation/visual-report.json`），不引用旧会话结论

---

## 0. 结论先行

| 维度 | 判定 |
| --- | --- |
| 诊断（问题出在信息架构，不是缺功能） | ✅ **同意**，有截图证据支持 |
| 处方（新建 `refactor/ui-workspace-shell-v1` 做 WorkspaceShell / DecisionSummary / ContextInspector） | ❌ **反对照做** —— 该分支已存在，且这三项已落地 |
| 取证基线（`audit/...` 分支） | ⛔ **不可用** —— 它是破坏性取证分支，删了 6 个文件 |
| 配色/视觉法则 | ⚠️ **保留** —— 需与既有 Visual law 对齐 |
| 是否追加优化项 | ✅ **追加 8 项，其中 3 项 P0 是报告完全没提到的** |

一句话：**诊断对，处方过期，取证基线有毒。**

---

## 1. 事实基线（先对齐，避免各说各话）

### 1.1 分支与提交血缘（本机核实）

| 项 | 值 |
| --- | --- |
| 当前分支 | `refactor/ui-workspace-shell-v1` |
| 分支 HEAD | `062afd4` |
| `origin/main` | `e8a6e49`（审核报告基线是 `6b649ab`，main 已前进） |
| 我领先 main | **16 个提交** |
| 我落后 main | **0 个提交**（包含 batch0：`65fdb05`/`ab04749`/`bfabc63`/`a9c7f3c`/`1370c5a`/`e8a6e49`） |
| PR #16 head | `062afd4`（open，未合并） |

> 注：本机 `.git/packed-refs` 里 `refs/remotes/origin/main` 曾被我写成过期的 `7e94868`，
> 导致一次 ahead/behind 计算失真。已修正为 `e8a6e49`。

### 1.2 审核分支 `audit/...`（`3fbc9a4`）是**破坏性**的

它基于 `main e8a6e49` 往前 4 个 `chore(audit)` 提交，净变化 **+654 / −849**：

| 被删除的文件 | 行数 | 影响 |
| --- | --- | --- |
| `tests/e2e/ui-foundation-batch0.spec.ts` | 305 | batch0 UI 基础回归套件整体消失 |
| `src/lib/locationIdentity.ts` | 71 | **候选点稳定身份模块被删** |
| `tests/unit/locationIdentity.test.ts` | 62 | 对应单测被删 |
| `src/features/planner/planner-responsive.css` | 31 | planner 响应式样式被删 |
| `tests/unit/constants.test.ts` | 16 | 常量单测被删 |
| `tasks/todo.md` | 12 | — |

还改动了 `src/lib/store.tsx`、`src/lib/constants.ts`、`src/lib/types.ts`、
`src/components/ObservationDetails.tsx`、`src/features/planner/PlannerApp.jsx`、
`src/features/planner/components/ObservationMap.jsx`。

**两条硬结论：**

1. 该分支**绝不能作为实施基线，也绝不能合并**。它删除的 `locationIdentity.ts` 恰好是
   `2026-08-30-data-refresh-and-map-controls.md` 明确列为 non-goal 的「候选点稳定身份」。
2. 报告里的四页 × 四视口结论，是**在这棵被改造的树上截的图**。截图可以说明布局，
   但**不能证明真实产品的行为**——尤其是候选身份、batch0 回归这些被删掉的部分。

### 1.3 报告的核心处方，已经落地了

`refactor/ui-workspace-shell-v1` 相对 main 的 16 个提交里，IA 主线全部完成：

```
36f7872 feat(ui): add decision summary copy helper without changing scores   → src/lib/decisionSummary.ts
77d1343 fix(ui): keep decision summary copy free of forbidden safety words
34c4e8e feat(ui): render tonight decision summary from existing evaluation   → DecisionSummary.tsx
b07f335 feat(ui): add inspector tablist with lazy panes                     → ContextInspector.tsx
db61f83 feat(ui): dock tonight map into left-canvas-inspector shell         → WorkspaceShell.tsx
3acffde fix(ui): keep 44px controls and stop header title crowding tabs
c8fb56f feat(ui): put planner nearby and day-range into the left column
8d08a80 feat(ui): keep fireglow full-width and separate probability orange from risk red
fa48ccc test(ui): lock workspace shell geometry and retarget overlay selectors
edb1f8c fix(ui): complete inspector and fireglow shell semantics
3c07f12 fix(ui): close workspace shell quality gate gaps
91ed81b docs(tasks): record workspace shell PR handoff
26b4c4f fix(a11y): stabilize source dialog focus loop in WebKit
b912f8e feat(ui): add adjustable inspector and forecast lift                → useInspectorWidth.ts
e254732 fix(a11y): stabilize source dialog entry focus
062afd4 feat(ui): workspace shell, forecast availability and fireglow refresh loop
```

工作区核实（全部 EXISTS）：
`src/lib/decisionSummary.ts`、`workspace/WorkspaceShell.tsx`、`workspace/DecisionSummary.tsx`、
`workspace/ContextInspector.tsx`、`workspace/workspace-shell.css`、`workspace/useInspectorWidth.ts`、
`workspace/ForecastAvailability.tsx`、`BortleFilterBar.tsx`；
`src/components/DecisionBrief.tsx` 已按计划删除。

**报告建议"下一步直接建立 `refactor/ui-workspace-shell-v1` 分支"——这个名字和我的分支完全撞车，
照做会导致双分支同名打架 + 重复造轮子。**

---

## 2. 我同意的部分

| # | 报告主张 | 我的证据 | 判定 |
| --- | --- | --- | --- |
| A1 | 核心问题是"视觉孤岛"，不是缺功能 | `visual-report.json` 全部 24 张截图 `overflow: 0`，无横向溢出、无布局崩坏 | ✅ 同意。是层级问题，不是 CSS 问题 |
| A2 | 暗夜选址不是独立工作区 | 四个视口的 URL 全是 `/?view=light-pollution&panel=sites`，**不是路由** | ✅ 同意，硬证据 |
| A3 | 桌面应从浮窗改为「左输入 / 中画布 / 右检查器」 | 已由 `db61f83` + `c8fb56f` 落地 | ✅ 同意且已完成 |
| A4 | 决策摘要要在四页统一 | 今夜观测已落地（`34c4e8e`），火烧云 / 计划 / 选址未接 | ✅ 同意方向，但反对一次做完（见 B3） |
| A5 | 控件 ≥44px、可见焦点、颜色不作为唯一语义 | `BortleFilterBar.tsx` 已用 `aria-pressed` + 计数 + 文字标签三重冗余 | ✅ 同意且已落实 |

---

## 3. 我反对 / 保留的部分

### B1 ❌ 反对：照做"新建 `refactor/ui-workspace-shell-v1` 分支"
该分支已存在（HEAD `062afd4`，PR #16 开启）。照做 = 同名分支冲突 + 重做已完成工作。
**正确做法：直接在 `062afd4` 上续做。**

### B2 ⛔ 反对：以 `audit/ui-information-architecture-20260829` 为基线
见 §1.2。它删掉了候选点身份模块与 batch0 回归套件，净 −195 行。
**任何"从审核分支拉代码"的动作都必须被拒绝。**

### B3 ⚠️ 保留：四页统一决策摘要"一次做完"
`2026-08-30-workspace-shell-display.md` 的约束明确写着：
> Do not mix scoring, Open-Meteo, GIBS, Worker, or candidate identity changes.

一次性铺四页必然要碰 store 与候选身份，直接违反该约束。
**建议拆两步：** ① 先把已有 `DecisionSummary` 接到火烧云 + 计划页（纯展示层，不碰数据）；
② 选址页最后做，因为它先要解决"是不是独立路由"（见 P2-8）。

### B4 ⚠️ 保留：换配色 / 上落地页橙色
同一份计划的 **Visual law** 写明：
> Keep UNIFIED_VISUAL_SYSTEM night tokens. Do not apply ui-ux-pro-max's orange landing palette.

若报告建议改用 ui-ux-pro-max 的橙色落地页调色板，**我反对**。夜间 token 是这套产品的识别基础。

### B5 ⚠️ 保留：三栏骨架在 1024×768 短屏
1024 − 左 300 − 右 360 = **中画布仅 364px**，再减去时间轴，地图可用高度不足。
`visual-report.json` 里 `tablet-home` 的 `tileStats.osm` 从 desktop 的 16 掉到 **6**，
已经能看出中画布被挤压。**建议 1024 断点下降级为两栏（画布 + 可切换抽屉），不要硬撑三栏。**

---

## 4. 我要追加的优化项（报告的盲区）

### P0-1 🔴 手机端首页**没有**决策摘要（报告完全没提，且方向相反）

`visual-report.json` 的 `facts.reasonCard`：

| 截图 | 视口 | reasonCard |
| --- | --- | --- |
| `desktop-home` | 1440×1000 | 完整：「今晚判断 / 未选地点 / 最佳窗口— / 更新时间 16:00 / 查看云量与数据源」 |
| `tablet-home` | 1024×768 | 完整（同上） |
| `phone-home` | 390×844 | **空字符串** ❌ |
| `landscape-home` | 844×390 | **空字符串** ❌ |
| `phone-sites` | 390×844 | 有，但被截断成只剩「更新时间 16:00」⚠️ |
| `landscape-sites` | 844×390 | 有，但被截断 ⚠️ |

**最反直觉的地方：在手机上，主落地页反而看不到结论，切到选址面板才看得到。**
这跟报告"决策摘要要无处不在"的目标正好相反，而且缺的正是最该被看见的位置。
→ **我认为这才是第一优先级 P0。**

### P0-2 🔴 `/planner` 默认没有地图

四张 planner 基础截图 `tileStats.osm` 全是 **0**、`attribution` 为空；
只有 `desktop-planner-map.png` 是 12 块瓦片（说明地图是手动切出来的）。

对一个"多地点比较"的产品，默认无地图意味着候选点在计划页里是**抽象字符串而不是空间对象**。
→ 建议：计划页默认出图；或至少把地图入口提到首屏。

### P0-3 🔴 底图只有 OSM，光污染栅格没有真的渲染

全部 24 张 `tileStats.carto = 0`，但 attribution 里却写着
「光污染参考 © darkmap.cn · VIIRS 2023，省界 © 阿里云 DataV GeoAtlas」。

**署名在，图层不在。** 用户很可能只是在看一张普通 OSM 底图。
根因与 `2026-08-30-data-refresh-and-map-controls.md` 第 6 步（暗夜数值栅格未安装）同源。
→ 这是数据问题不是 UI 问题，但它是"暗夜选址"这个产品能否成立的前提。**阻塞项：需外部许可凭据。**

### P1-4 🟠 客户端请求冷却（**本轮已补**）
`refreshData` 用 `forceRefresh=true`（`refresh=1` + `cache:"no-store"`）绕过 HTTP 缓存直击上游，
Open-Meteo 429 快速失败时连点重试会打爆免费额度。服务端有冷却（fireglow/air-quality 各 60s），
**客户端此前完全没有**。已补 `FORECAST_SAMPLE_COOLDOWN_MS = 10_000`（按地点维度）。
报告完全没提"限流下的 UI 反馈"这一层。

### P1-5 🟠 逐小时数据的上游状态必须显式可见（**本轮已补**）
`workspace/ForecastAvailability.tsx` 五态渲染：loading / 错误+有 stale / 错误+无数据 / ready / 隐藏，
附最近成功时间 + 可点重试。**不要让一个孤立的「—」替一次故障说话。**

### P1-6 🟠 三份计划必须收敛成一条执行序列
`docs/superpowers/plans/` 下三份计划同时指向 `refactor/ui-workspace-shell-v1`：

| 计划 | 写的基线 | 状态 |
| --- | --- | --- |
| `2026-08-30-workspace-shell-display.md` | `main e8a6e49` | 已落地，应标记完成 |
| `2026-08-30-adjustable-inspector-and-timeline.md` | 分支 `26b4c4f` | `26b4c4f` 已是我分支祖先，应标记完成 |
| `2026-08-30-data-refresh-and-map-controls.md` | HEAD `e254732` | **活跃**（第 1–5 步已由 `062afd4` 完成，第 6–7 步未做） |

下一位 agent 如果误读旧基线，又会从头开工。建议把前两份改为 `status: DONE` 并注明落地 SHA。

### P2-7 🟡 视觉回归要进门禁
`tmp/ui-batch0-validation/` 已经产出 24 张截图 + 结构化 facts（overflow / tileStats / emptyState / reasonCard）。
这套东西不该躺在 `tmp/`。**建议固化为 `npm run test:visual`，并把
`reasonCard` 非空、`tileStats.osm > 0`、`tileStats.carto > 0` 变成断言**——
这样 P0-1 / P0-2 / P0-3 以后会自动变红，不用靠人看图。

### P2-8 🟡 `/sites` 是否升为真路由
我倾向于是，但成本不小（要动深链静默写入，而深链属于 non-goal）。
**折中方案：URL 语义不变，但 `panel=sites` 时把左侧输入列整体换成选址筛选器**，
先把"独立工作区"的体验做出来，路由改造往后放。

---

## 5. 建议执行顺序

```
1. P0-1  手机端首页决策摘要缺失          （纯展示层，风险最低，收益最高）
2. P0-2  计划页默认出图                  （纯展示层）
3. A4-①  决策摘要接到火烧云 + 计划页     （纯展示层，不碰 store/候选身份）
4. P1-6  收敛计划文档，标记两份 DONE
5. P2-7  视觉回归进门禁                  （把上面三条锁死）
6. A4-②  选址页决策摘要 + 独立工作区体验
7. P0-3  暗夜数值栅格                    （阻塞：外部许可凭据）
8. P2-8  /sites 路由化                   （可长期后置）
```

**三条纪律（给下一位执行者）：**
- 不要新建分支，直接在 `refactor/ui-workspace-shell-v1`（HEAD `062afd4`）上续做；
- 不要以 `audit/ui-information-architecture-20260829` 为基线或合并来源；
- 不要碰 scoring / Open-Meteo / GIBS / Worker / 候选点身份 / 深链静默写入。

---

## 6. 本轮已交付

| 项 | 值 |
| --- | --- |
| 提交 | `062afd4` feat(ui): workspace shell, forecast availability and fireglow refresh loop |
| 变更 | 20 文件，+1284 / −154 |
| 新增文件 | `src/components/BortleFilterBar.tsx`、`src/components/workspace/ForecastAvailability.tsx`、`tests/e2e/workspace-data-refresh.spec.ts` |
| 我的增量 | 客户端按地点 10s 请求冷却（`FORECAST_SAMPLE_COOLDOWN_MS`）+ 重试按钮冷却态 |
| 门禁 | typecheck 0 错 / vitest 231 通过（40 文件）/ eslint 0 问题 / build exit 0 |
| 推送 | 直接 `git push` 到 `origin/refactor/ui-workspace-shell-v1`，纯 fast-forward `e254732..062afd4` |
| 未验证 | `npm run test:e2e`（本机无浏览器 + dev server）、四视口视觉回归、计划第 6 步（外部许可） |
