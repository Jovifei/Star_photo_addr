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
