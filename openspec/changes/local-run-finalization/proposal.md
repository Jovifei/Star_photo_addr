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
