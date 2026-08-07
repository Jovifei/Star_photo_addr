---
change: local-run-finalization
design-doc: openspec/changes/local-run-finalization/design.md
base-ref: 5d5553b3f6e97dd868cdfd749b34084a82814e8c
---

# 实现计划：local-run-finalization

## 目标（一句话）
让 Next.js 16 应用在 Windows 上「干净克隆 → `npm ci` → `npm run dev` → http://127.0.0.1:3000」一站式跑通，并把 README / Playwright / CI 对齐真实代码，缺失 `public/` 资源时优雅降级，全部以真实验收为准，**不部署任何服务器**。

## 权威来源
- 交接文档：`docs/gpt_plan/CODEX_HANDOFF_LOCAL_RUN_FINAL_2026-08-07.md`
- OpenSpec 变更：`openspec/changes/local-run-finalization/`（proposal / design / tasks / spec）
- 当前基线：`main` @ `5d5553b`（base-ref 用于 verify 阶段测量提交范围）

## 执行分组（直接对应 `tasks.md` 1–7）

### 组 1 · 依赖与 lockfile 同步
- **1.1** 审计 `package.json` 中 Next 与遗留 Vite/Worker 依赖的实际 import，确认无悬空引用（重点关注根目录并存的旧 Vite 应用与 `.js` 抢先 `.ts` 隐患）。
- **1.2** Node 24 下用 `npm install --package-lock-only` 重新生成 `package-lock.json`（**禁止** `--force` / `--legacy-peer-deps`）。
- **1.3** 删除本分支测试生成的 `node_modules`/`.next` 后 `npm ci` 成功，确认根项目版本 / Next / React 与 `package.json` 一致。

### 组 2 · 命令与脚本统一
- **2.1** `package.json` 补齐 `test:unit`(vitest run)、`test:e2e`(playwright)、`test:live`(Open-Meteo 冒烟)、`check`(lint+typecheck+test:unit+build)。
- **2.2** 重写 `playwright.config.js` 的 `webServer` 为 Next `build`+`start`（端口 4178），E2E 针对当前 Next 页面，移除对 Vite `dist`/`preview:test` 的依赖。
- **2.3** 重写 `scripts/local-preflight.ps1` 到 Next 命令。
- **2.4** 同步 `README.md` / `LOCAL_CODEX_START.md` / `HANDOFF_CODEX.md` 到真实入口（端口 3000、Node 24、无需 API Key、不能双击 index.html）。

### 组 3 · CI 修正
- **3.1** `.github/workflows/ci.yml` 改为监听 `main`、加入 `workflow_dispatch`，使用 Node 24 + `npm ci` + `npm run check`。

### 组 4 · 公共资源与降级
- **4.1** 只读搜索合法本地备份 / 旧 worktree / 已有制品中的 `public/images/perseids`，为每类资源记录来源 / 许可 / 大小。
- **4.2** 恢复合法且完整的资源；对缺失资源实现优雅降级（Bortle / VIIRS / 候选 / 边界默认禁用或显示「无数据 / 不确定」），`sampleBortle` 的 nodata 不冒充可信 B9/SQM。
- **4.3** 确保缺失资源不会造成反复 404 请求或未处理异常。

### 组 5 · 本地一键启动
- **5.1** 新增并验证 `scripts/start-local.ps1`（检查 Node 24 → 缺依赖则 `npm ci` → `npm run dev` → 等待 200 → 打开浏览器 → 失败时非零退出并保留错误）。
- **5.2**（可选）新增 `start-local.cmd`。

### 组 6 · 真实验收
- **6.1** `npm run check`（lint / typecheck / unit / build）全绿且 0 skipped。
- **6.2** `npm run test:e2e` 真实运行（非 `--list`）。
- **6.3** `npm run test:live` Open-Meteo 冒烟。
- **6.4** `npm run dev`；验证 `GET /`、`GET /viirs`、`GET /api/geocode?q=杭州&count=5&language=zh`、`GET /api/forecast?latitude=30.2741&longitude=120.1551&days=3` 均 200。
- **6.5** 浏览器 QA：桌面 1440×1000 与手机 390×844 检查首屏地图、搜索杭州、选择地点侧栏、11 夜切换、地图点击请求天气、定位拒绝、打开 `/viirs`、Console 无未处理异常、必需本地资源无 404。
- **6.6** 从最终提交创建全新临时克隆，确认无 `node_modules`/`.next`/`dist` 后重新 `npm ci` + `npm run check` + 最小路由验证。

### 组 7 · 文档与收尾
- **7.1** 重写交接 / README 使其与现状一致，删除旧 Vite 9/9、Sites Worker、`dist`、8080 等不再成立的描述。
- **7.2** 提交独立清晰 commit；push 分支并开 Draft PR 到 `main`（**无用户明确合并授权不得擅自合并 main**）；不 force push、不重写历史。

## 验收标准（交接文档报告格式）
| 项 | 期望 |
|----|------|
| PACKAGE_LOCK_SYNC | YES（Node 24，无 --force） |
| NPM_CI | PASS |
| LINT / TYPECHECK / UNIT_TESTS / NEXT_BUILD | PASS |
| E2E | PASS（真实运行，非 --list） |
| LIVE_OPEN_METEO | PASS |
| LOCAL_URL | http://127.0.0.1:3000 |
| ROUTES_CHECKED | `/`、`/viirs`、`/api/geocode`、`/api/forecast` |
| PUBLIC_ASSETS | restore-or-degrade |
| BROWSER_QA | PASS（桌面 + 手机，无未处理异常 / 无必需 404） |
| CI_CONFIG | `main` + `workflow_dispatch` |
| README_UPDATED | YES |
| DEPLOYMENT_PERFORMED | NO |
| COMMIT / PR | 创建 |

## 风险与约定
- **不部署服务器**；**不 force push**；**不擅自合并 main**（须用户授权）。
- 每个 task 验收后单独 `git commit`，不积攒；提交信息说明变更原因。
- 构建需 `NODE_OPTIONS=--max-old-space-size=4096`（本沙箱默认 2GB 会 OOM）。
- 遗留 Vite `.js` 与 `.ts` 同名文件：通过 vitest `resolve.extensions` 顺序（`.ts` 先于 `.js`）规避抢先；清理决策见组 1.1 / 7.1，不阻塞主流程。
- 真实外部依赖 Open-Meteo（无 Key）；`test:live` 与浏览器 QA 需要网络可达。
