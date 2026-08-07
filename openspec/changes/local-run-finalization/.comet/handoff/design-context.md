# Comet Design Handoff

- Change: local-run-finalization
- Phase: design
- Mode: compact
- Context hash: 3738dcf17acc1bae52a0fed1485bf5b2b3f602edf0c483dea7f46237dfae3a31

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/local-run-finalization/proposal.md

- Source: openspec/changes/local-run-finalization/proposal.md
- Lines: 1-40
- SHA256: ac98a06e9bfc0c18be3f7756cd6b55baf35c9d044527bc25513979e1fa16b761

```md
## Why

最近 3 个提交（`02e1872`、`5386258`、`5d5553b`）已恢复 Next.js 16 主体并修复类型检查与 Vitest `.ts` 解析，但 `main` 仍不满足"干净克隆后一键本地运行"：

- `package.json` 已是 Next.js 16.2.1 / React 19.2.4，但 `package-lock.json` 仍是旧 Vite / React 19.2.0 依赖树，Node 24 下 `npm ci` 失败。
- README、`LOCAL_CODEX_START.md`、`scripts/local-preflight.ps1`、`playwright.config.js` 仍调用旧 Vite 脚本与 `dist` 目录，而这些脚本已不在 `package.json`。
- `Dockerfile` 仍用 Node 22 并把 `/app/dist/client` 复制到 Nginx，与当前 `output: "standalone"` 不兼容（本阶段不部署，仅记录）。
- `.github/workflows/ci.yml` 只监听 `master`，而默认分支是 `main`，HEAD 没有 CI status。
- 仓库没有 `public/`，但代码请求世界暗夜图、VIIRS 图层/数值瓦片、城市候选、行政边界、元数据与 OG 图片，会 404。
- 根目录仍混有旧 Vite 应用、旧 Worker、旧测试和 Next.js 新应用，已造成过 `.js` 抢先于 `.ts` 的真实故障。

本阶段唯一目标：**从干净克隆完成安装、验证、启动，并在本机浏览器打开实际 Next.js 页面**。暂不部署服务器。

## What Changes

1. 让 `package-lock.json` 与 `package.json` 在 Node 24/npm 下完全同步；从无 `node_modules`/`.next` 的干净目录 `npm ci` 成功。
2. 统一 npm scripts、Playwright、本地预检、README 与 Next.js 实际入口（`dev`/`build`/`start`/`lint`/`typecheck`/`test:unit`/`test:e2e`/`test:live`/`check`）。
3. 修正 CI 监听 `main`，加入 `workflow_dispatch`，使用 Node 24、`npm ci` 与新的总门禁命令。
4. 查找合法备份中的 `public/images/perseids` 资源并建立清单；能恢复则恢复，不能则实现诚实降级（关闭缺失图层、显示"数据未安装/不确定"），不伪造暗夜数据。
5. 新增 Windows 一键本地启动脚本（`scripts/start-local.ps1` + 可选 `start-local.cmd`）。
6. 本地开发服务器实际启动，浏览器打开 `/` 与 `/viirs`，验证搜索/地图点击/天气 API/11 观测夜/定位拒绝/缺失数据降级/桌面与手机布局。
7. 重写 README、本地启动入口与交接状态，删除"已通过但当前命令不存在"的陈述。
8. 从最终提交再做一次全新临时克隆复验。

## Capabilities

### New Capabilities
- `local-run`：干净克隆安装与本地运行能力——`npm ci` 可复现、`http://127.0.0.1:3000` 的 `npm run dev`、Windows 一键启动、资源缺失优雅降级、CI 监听 `main`。

### Modified Capabilities
（本变更为工具链/本地运行收尾，不改变产品行为能力，故无 spec 级需求变更。）

## Impact

- `package.json` / `package-lock.json`（依赖同步）
- `npm` scripts、`playwright.config.js`、`scripts/local-preflight.ps1`、`README.md`、`LOCAL_CODEX_START.md`、`HANDOFF_CODEX.md`
- `.github/workflows/ci.yml`
- `public/` 资源（恢复或降级）
- `scripts/start-local.ps1`（+ 可选 `start-local.cmd`）
- 不触碰业务源码逻辑（`src/app`、`src/components`、`src/lib` 仅在资源/命令层面对齐）

```

## openspec/changes/local-run-finalization/design.md

- Source: openspec/changes/local-run-finalization/design.md
- Lines: 1-48
- SHA256: 1598946ad45cd29f3b87978011544f98670f17b4ed160ae589da5a94c2671b7d

```md
---
comet_change: local-run-finalization
role: technical-design
canonical_spec: openspec
---

## Context

当前权威应用为 Next.js 16 App Router（`src/app/page.tsx`），同源接口 `/api/forecast`、`/api/geocode`（服务端访问 Open-Meteo，无 API Key），本地要求 Node 24（`.nvmrc`），开发端口 3000。最近提交恢复了主体并通过 lint/typecheck/build 门禁，但仓库仍存在三类不一致：

1. **依赖树不一致**：`package.json` 已是 Next 16，lockfile 仍是 Vite/React 19.2.0，导致 `npm ci` 失败。
2. **命令/文档失配**：文档与配置引用 `test:unit`/`test:e2e`/`test:live`/`preview`/`preview:test` 等已不存在的脚本，Playwright 仍假定 Vite `dist`。
3. **资源与 CI 缺口**：无 `public/`，代码请求的暗夜图/VIIRS/边界/城市候选会 404；CI 监听 `master` 而非 `main`。

根目录并存旧 Vite 应用、旧 Worker、旧测试与 Next.js 新应用，已造成 `.js` 抢先 `.ts` 的真实故障，必须明确唯一运行入口。

## Goals / Non-Goals

**Goals:**
- 干净克隆下 `npm ci` 成功且 lockfile 与 `package.json` 完全一致。
- 统一命令语义：`dev`/`build`/`start`/`lint`/`typecheck`/`test:unit`/`test:e2e`/`test:live`/`check`（`check` = lint+typecheck+unit+build，0 skip）。
- CI 监听 `main` + `workflow_dispatch`，Node 24 + `npm ci` + `npm run check`。
- `public/` 资源能恢复则恢复（记录来源/许可/大小），不能则诚实降级，无伪造暗夜数据。
- 提供 Windows 一键本地启动入口，浏览器打开 `http://127.0.0.1:3000`。
- 真实验收路由、API 与桌面/手机布局。

**Non-Goals:**
- 不部署服务器、Vercel、Docker 主机或域名；不配证书/反向代理/DNS/监控/备份。
- 不把普通卫星夜光称为现场 SQM 或真实 Bortle。
- 不以"测试文件存在"代替实际运行通过。
- 不使用 `--force`/`--legacy-peer-deps` 掩盖依赖问题（除非有逐项兼容性证据并在报告中解释）。
- 不 force push、不重写历史、不直接覆盖用户其他分支。

## Decisions

- **lockfile 同步**：用 `npm install --package-lock-only`（Node 24）重新生成 lockfile，不手工编辑、不用 `--force`/`--legacy-peer-deps`。随后 `rm -rf node_modules .next` 后 `npm ci` 复验；最终再从全新临时克隆 `npm ci`。
- **命令语义**：在 `package.json` 补齐 `test:unit`(vitest run)、`test:e2e`(playwright)、`test:live`(Open-Meteo 冒烟)、`check`(lint+typecheck+test:unit+build)。`npm test` 作为单测入口，完整门禁用 `npm run check`。
- **Playwright**：`webServer` 改为 Next `build`+`start`（端口 4178），E2E 针对当前 Next 页面真实运行，不依赖 Vite `dist`/`preview:test`，不靠 `--list` 冒充通过。
- **资源策略**：先只读搜索合法本地备份/旧 worktree/已有制品；仅当确认完整且许可合法才恢复。缺失的 Bortle/VIIRS/候选/边界默认禁用或标注"数据未安装/无数据/不确定"；`sampleBortle` 的 nodata 不得冒充可信 B9/SQM；页面不得反复请求确定不存在的本地资源，不得有未处理异常。
- **CI**：`.github/workflows/ci.yml` 改监听 `main` + `workflow_dispatch`，Node 24、`npm ci`、`npm run check`；E2E 如需纳入需稳定且不把外网不稳定测试混成无说明的必过门禁。
- **一键启动**：`scripts/start-local.ps1` 检查 Node 24 与 npm；缺依赖时 `npm ci`；`npm run dev`；轮询等待 `http://127.0.0.1:3000` 返回 200；调用系统浏览器打开；失败时保留错误并以非零退出码退出，不静默吞错。README 顶部写明端口 3000、Node 24、无需 API Key、不能直接双击 index.html。

## Risks / Trade-offs

- 大型 VIIRS 瓦片本阶段可能无法恢复 → 接受降级（基础 CARTO 地图、搜索、地图点击、天气、11 夜切换仍可用）。
- CARTO/Open-Meteo 在部分环境无法联网 → 必须精确区分"环境阻断"与"产品失败"，不得声称未运行步骤通过。
- `npm ci`/安装受网络（npmmirror 慢）影响，可能耗时较长。
- 本沙箱无显示器，浏览器"打开"以 `curl` 路由 200 校验 + 必要时 headless Playwright 代替肉眼检查；真实视觉 QA 若环境不支持则标注为环境受限。

```

## openspec/changes/local-run-finalization/tasks.md

- Source: openspec/changes/local-run-finalization/tasks.md
- Lines: 1-41
- SHA256: 2c728d7e4b1fc729162f0d90756c7199700d570c01259b388369e0f6f1ca5906

```md
## 1. 依赖与 lockfile 同步

- [ ] 1.1 审计 `package.json` 中 Next 与遗留 Vite 依赖的实际 import，确认无悬空引用
- [ ] 1.2 在 Node 24 下用 `npm install --package-lock-only` 重新生成 `package-lock.json`（不使用 `--force`/`--legacy-peer-deps`）
- [ ] 1.3 删除本分支测试生成的 `node_modules`/`.next` 后 `npm ci` 成功，确认根项目版本/Next/React 与 `package.json` 一致

## 2. 命令与脚本统一

- [ ] 2.1 在 `package.json` 补齐 `test:unit`(vitest run)、`test:e2e`(playwright)、`test:live`(Open-Meteo 冒烟)、`check`(lint+typecheck+test:unit+build)
- [ ] 2.2 重写 `playwright.config.js` 的 `webServer` 为 Next `build`+`start`（端口 4178），E2E 针对当前 Next 页面，移除对 Vite `dist`/`preview:test` 的依赖
- [ ] 2.3 重写 `scripts/local-preflight.ps1` 到 Next 命令
- [ ] 2.4 同步 `README.md`/`LOCAL_CODEX_START.md`/`HANDOFF_CODEX.md` 到真实入口（端口 3000、Node 24、无需 API Key、不能双击 index.html）

## 3. CI 修正

- [ ] 3.1 `.github/workflows/ci.yml` 改为监听 `main`、加入 `workflow_dispatch`，使用 Node 24 + `npm ci` + `npm run check`

## 4. 公共资源与降级

- [ ] 4.1 只读搜索合法本地备份/旧 worktree/已有制品中的 `public/images/perseids`，为每类资源记录来源/许可/大小
- [ ] 4.2 恢复合法且完整的资源；对缺失资源实现优雅降级（Bortle/VIIRS/候选/边界默认禁用或显示"无数据/不确定"），`sampleBortle` 的 nodata 不冒充可信 B9/SQM
- [ ] 4.3 确保缺失资源不会造成反复 404 请求或未处理异常

## 5. 本地一键启动

- [ ] 5.1 新增并验证 `scripts/start-local.ps1`（检查 Node 24 → 缺依赖则 `npm ci` → `npm run dev` → 等待 200 → 打开浏览器 → 失败时非零退出并保留错误）
- [ ] 5.2 可选新增 `start-local.cmd`

## 6. 真实验收

- [ ] 6.1 `npm run check`（lint/typecheck/unit/build）全绿且 0 skipped
- [ ] 6.2 `npm run test:e2e` 真实运行（非 `--list`）
- [ ] 6.3 `npm run test:live` Open-Meteo 冒烟
- [ ] 6.4 `npm run dev`；验证 `GET /`、`GET /viirs`、`GET /api/geocode?q=杭州&count=5&language=zh`、`GET /api/forecast?latitude=30.2741&longitude=120.1551&days=3` 均 200
- [ ] 6.5 浏览器 QA：桌面 1440×1000 与手机 390×844 检查首屏地图、搜索杭州、选择地点侧栏、11 夜切换、地图点击请求天气、定位拒绝、打开 `/viirs`、Console 无未处理异常、必需本地资源无 404
- [ ] 6.6 从最终提交创建全新临时克隆，确认无 `node_modules`/`.next`/`dist` 后重新 `npm ci` + `npm run check` + 最小路由验证

## 7. 文档与收尾

- [ ] 7.1 重写交接/README 使其与现状一致，删除旧 Vite 9/9、Sites Worker、`dist`、8080 等不再成立的描述
- [ ] 7.2 提交独立清晰 commit；push 分支并开 Draft PR 到 `main`（无用户明确合并授权不得擅自合并 main）；不 force push、不重写历史

```

## openspec/changes/local-run-finalization/specs/local-run/spec.md

- Source: openspec/changes/local-run-finalization/specs/local-run/spec.md
- Lines: 1-29
- SHA256: 7ca453995ea3baae6b5d30af1d36030b75a0cc2a27726a15d5234b9f076d764e

```md
## ADDED Requirements

### Requirement: Clean clone install
The application SHALL install from a clean clone (no `node_modules`, no `.next`) via `npm ci` on Node 24, producing a dependency tree fully consistent with `package.json` (Next.js 16.2.1, React 19.2.4, project version 0.3.1). `npm ci` MUST complete without MODULE_NOT_FOUND or peer-dependency errors.

#### Scenario: npm ci succeeds on Node 24
- **WHEN** a developer clones the repository fresh and runs `npm ci` with Node 24
- **THEN** the install completes without MODULE_NOT_FOUND / peer-dependency errors and the lockfile matches `package.json`

### Requirement: Local dev launch on port 3000
The application SHALL be launchable via `npm run dev`, serving the Next.js App Router app with same-origin `/api/forecast` and `/api/geocode` route handlers on `http://127.0.0.1:3000`.

#### Scenario: dev server responds on 127.0.0.1:3000
- **WHEN** `npm run dev` is started and the browser opens http://127.0.0.1:3000
- **THEN** `GET /` and `GET /viirs` return 200 and the APIs return weather data

### Requirement: Graceful asset degradation
When optional `/public` assets (world atlas, VIIRS tiles, boundaries, cities) are absent, the app MUST NOT crash or loop on 404; missing layers SHALL be disabled or labeled "无数据/不确定".

#### Scenario: missing dark-sky assets do not crash
- **WHEN** the public dark-sky/VIIRS assets are not installed
- **THEN** the map and weather flows remain usable and `sampleBortle` nodata is shown as "不确定", never as a trusted B9/SQM

### Requirement: CI on main
CI SHALL run on the `main` branch (plus `workflow_dispatch`) using Node 24, `npm ci`, and `npm run check`.

#### Scenario: CI triggers on main
- **WHEN** a push or dispatch targets `main`
- **THEN** the pipeline installs with Node 24 and runs `npm run check` (lint + typecheck + unit + build)

```
