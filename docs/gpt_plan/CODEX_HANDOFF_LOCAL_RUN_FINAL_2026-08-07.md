# 逐星｜Next.js 本地运行收尾交接与 Codex 执行 Prompt

更新时间：2026-08-07  
仓库：`Jovifei/Star_photo_addr`  
权威分支：`main`  
审计 HEAD：`5d5553b3f6e97dd868cdfd749b34084a82814e8c`  
本阶段唯一目标：**从干净克隆完成安装、验证、启动，并在本机浏览器打开实际 Next.js 页面。暂不部署服务器。**

## 1. 结论先行

最近 3 个提交已经恢复 Next.js 16 主体并修复类型检查与 Vitest 的 `.ts` 解析，但 `main` **还不满足“干净克隆后一键本地运行”**。

当前不能让用户直接照旧 README 执行，原因是：

1. `package.json` 已切到 Next.js 16.2.1 / React 19.2.4，`package-lock.json` 仍是旧 Vite 依赖树；Node 24 下真实执行 `npm ci` 失败。
2. README、`LOCAL_CODEX_START.md`、`scripts/local-preflight.ps1` 与 `playwright.config.js` 仍调用旧 Vite 脚本和 `dist` 目录，但这些脚本已不在 `package.json`。
3. `Dockerfile` 仍用 Node 22 构建并把 `/app/dist/client` 复制到 Nginx；当前 Next.js 配置是 `output: "standalone"`，两者不兼容。
4. `.github/workflows/ci.yml` 只监听 `master`，仓库默认分支是 `main`；HEAD 没有 CI status 或 workflow run。
5. 仓库没有 `public/` 目录，但运行时代码会请求世界暗夜图、VIIRS 图层/数值瓦片、城市候选、行政边界、元数据与 OG 图片；这些请求会 404。
6. 根目录仍混有旧 Vite 应用、旧 Worker、旧测试和 Next.js 新应用；这已经造成过 `.js` 抢先于 `.ts` 的真实故障，必须明确唯一运行入口。

因此，本阶段正确的“打开 HTML”含义是：

```text
npm run dev
→ 浏览器打开 http://127.0.0.1:3000
```

Next.js 含同源 `/api/forecast` 与 `/api/geocode` Route Handlers，**不能把某个 `index.html` 直接双击当作完整应用运行**。

## 2. 已核实的最近提交

| Commit | 已完成 | 审计判断 |
|---|---|---|
| `02e1872` | 恢复 62 个 Next.js 文件；导出 `parseProviderTime`；收窄 `darksky.test` 类型；恢复 Next 脚本 | 源码/类型门禁修复有效；同时引入了与旧 Vite 文件并存的新主线 |
| `5386258` | Vitest 优先解析 `.ts/.tsx`，报告 39/39 | 修复方向正确；39/39 是已有环境结果，干净克隆目前因 lockfile 失败而无法复验 |
| `5d5553b` | 清理临时目录；新增 `.nvmrc=24` 与 `.github` | Node 24 基线正确；CI 分支名配置错误，且 lockfile/public 资源未收口 |

## 3. 本次独立审计证据

### 3.1 干净安装失败

审计环境：Node `v24.14.0`、npm `11.9.0`，基于 `origin/main@5d5553b` 的独立 detached worktree。

执行：

```bash
npm ci
```

结果：失败，npm 明确报告 `package.json` 与 `package-lock.json` 不同步。代表性差异：

- lockfile 缺少 `next@16.2.1`、`eslint-config-next@16.2.1`、Tailwind 4、TypeScript、Base UI、Lucide 等 Next 依赖；
- lockfile 仍记录项目版本 `0.0.0`，而 `package.json` 是 `0.3.1`；
- lockfile 仍锁定 React/React DOM `19.2.0`，而 `package.json` 要求 `19.2.4`。

这意味着当前最基础的 `npm ci` 可复现门禁没有通过。

### 3.2 文档和脚本失配

当前 `package.json` 只有：

```text
dev / build / start / lint / typecheck / check / test
```

但现有文档或配置仍调用以下不存在的脚本：

```text
test:unit / test:e2e / test:live / test:sites / preview / preview:test
```

`playwright.config.js` 仍执行 `npm run build && npm run preview:test`，并假定 Vite 生成 `dist`。这不是当前 Next.js 应用的有效 E2E 启动方式。

### 3.3 静态资源缺失

当前 Git 树没有 `public/`。代码明确引用：

```text
/images/perseids/og.png
/images/perseids/data/world-atlas-2015.webp
/images/perseids/data/vnp46a4/2024/{z}/{x}/{y}.webp
/images/perseids/data/vnp46a4/2024-values/8/{x}/{y}.webp
/images/perseids/tiles-sample/...
/images/perseids/data/cities.json
/images/perseids/data/vnp46a4-2024.json
/images/perseids/data/world-country-boundaries.geojson
/images/perseids/data/china-province-boundaries-wgs84.geojson
/images/perseids/data/china-prefecture-boundaries.index.json
/images/perseids/data/boundaries/prefectures/{adcode}.geojson
```

若备份中没有这些合法资源，不得抓取参考站私有资源、不得用伪数据冒充，也不得把无数据像元展示成真实 Bortle/SQM。应先让页面优雅降级：关闭缺失图层、显示“数据未安装/不确定”，并保证基础 CARTO 地图、地点搜索和天气流程可用。

### 3.4 当前架构事实

- 当前权威应用：Next.js 16 App Router；入口 `src/app/page.tsx`。
- 同源接口：`/api/forecast`、`/api/geocode`，服务端访问 Open-Meteo，无 API Key。
- 本地要求：Node 24（以 `.nvmrc` 为准，不是旧 README 的 Node 22+）。
- 开发端口：Next 默认 `3000`，不是旧 Nginx 的 `8080`。
- 当前页面：`/` 与 `/viirs`；构建报告曾显示 5 routes。
- 参考界面：`https://perseids.giraffetree.cn/`，只作为功能与视觉对照，不授权复制未知许可的资产或数据。

## 4. Codex 本阶段任务边界

### 必须完成（P0）

1. 从最新 `main@5d5553b` 新建 `codex/local-run-finalization`，不得从旧 Vite 分支反向覆盖 Next.js 文件。
2. 让 `package-lock.json` 与 `package.json` 在 Node 24/npm 下完全同步；最终必须从无 `node_modules`、无 `.next` 的干净目录执行 `npm ci` 成功。
3. 统一 npm scripts、Playwright、本地预检、README 与 Next.js 实际入口。
4. 修正 CI 监听 `main`，加入 `workflow_dispatch`，使用 Node 24、`npm ci` 和新的总门禁命令。
5. 查找合法备份中的 `public/images/perseids` 资源并建立清单；能恢复则恢复并记录来源/体积/许可证，不能恢复则实现诚实降级，首页不得持续请求一批确定不存在的资源。
6. 让本地开发服务器启动，并实际在浏览器打开 `/` 和 `/viirs`。
7. 验证地点搜索、地图点击、天气 API、11 个观测夜、定位拒绝路径、缺失暗夜数据降级；检查桌面和手机布局。
8. 重写 README、本地启动入口和交接状态，删除“已通过但当前命令不存在”的陈述。
9. 从最终提交再做一次全新临时克隆复验，证明结果不依赖旧 `node_modules`、旧 `dist` 或旧 `.next`。

### 本阶段不做

- 不部署服务器、Vercel、Docker 主机或域名。
- 不配置生产证书、反向代理、DNS、监控和备份。
- 不把普通卫星夜光直接称为现场 SQM 或真实 Bortle。
- 不以“测试文件存在”“能枚举用例”代替实际运行通过。
- 不使用 `--force`、`--legacy-peer-deps` 掩盖依赖问题，除非有逐项兼容性证据并在报告中解释。
- 不 force push，不重写历史，不直接覆盖用户其他分支。

## 5. 建议的实现顺序

### A. 基线与依赖

```bash
git fetch origin
git switch main
git pull --ff-only
git status --short
git switch -c codex/local-run-finalization
node --version
npm --version
```

Node 必须是 24.x。先审计 `package.json` 中 Next 与遗留 Vite 依赖的实际 import，再正常更新 lockfile。不要手工编辑 lockfile。

候选流程：

```bash
npm install --package-lock-only
rm -rf node_modules .next   # 仅在明确位于本仓库且确认路径后执行；Windows 使用等价安全命令
npm ci
```

更新后确认 `package-lock.json` 根项目版本、Next、React 与 `package.json` 一致。

### B. 统一命令

至少提供并真实验证以下语义：

```text
npm run dev        启动 Next 本地开发服务器
npm run build      Next 生产构建
npm run start      启动已构建的 Next 服务
npm run lint       ESLint
npm run typecheck  TypeScript
npm run test:unit  Vitest
npm run test:e2e   当前 Next 页面 Playwright 测试
npm run test:live  真实 Open-Meteo 冒烟
npm run check      lint + typecheck + unit + build（不得 skip）
```

`npm test` 的语义需在 README 说清楚；建议作为单测入口，完整门禁使用 `npm run check`。

Playwright `webServer` 改为 Next：可使用 `npm run build && npm run start -- -p 4178`，不得再读取 Vite `dist` 或调用缺失的 `preview:test`。

### C. 公共资源与降级

先在本地备份、旧 worktree、合法制品中只读查找完整 `public/images/perseids`。对每类资源记录：来源、许可、大小、是否适合放 Git/Git LFS/对象存储。

若本阶段无法恢复大瓦片：

- 基础 CARTO 地图必须正常显示；
- Bortle/VIIRS 开关默认关闭或禁用，并明确提示数据未安装；
- `sampleBortle` 缺数据时返回 `uncertain`，UI 显示“无数据/不确定”，不能显示为可信 B9；
- 城市候选与行政边界缺失不能阻塞搜索、地图点击和天气；
- 所有缺失资源不得造成未处理异常；
- `/viirs` 必须准确说明当前是模型/接口说明还是已安装数据层。

### D. 本地一键打开

给 Windows 用户提供一个可审计的启动入口，例如 `scripts/start-local.ps1`，以及可选的根目录 `start-local.cmd`：

1. 检查 Node 24 与 npm；
2. 首次缺少依赖时执行 `npm ci`；
3. 启动 `npm run dev`；
4. 等待 `http://127.0.0.1:3000` 返回 200；
5. 调用系统浏览器打开该地址；
6. 失败时保留清晰错误和退出码，不静默吞错。

不要生成假“单文件 HTML”。README 必须明确：双击脚本是为了启动 Next 服务并打开浏览器。

### E. 验收

从干净克隆实际执行：

```bash
npm ci
npm run check
npm run test:e2e
npm run test:live
npm run dev
```

启动后至少验证：

```text
GET /                                                   200
GET /viirs                                              200
GET /api/geocode?q=杭州&count=5&language=zh              200，返回结果数组
GET /api/forecast?latitude=30.2741&longitude=120.1551&days=3
                                                        200，返回天气数据
```

浏览器人工/自动化必须检查：

- 桌面 1440×1000、手机 390×844；
- 首屏无页面级横向滚动、无遮挡；
- 地图基础层可见；
- 搜索“杭州”并选择结果后侧栏打开；
- 11 个观测夜可切换；
- 地图点击可请求天气；
- 定位拒绝显示可理解错误；
- `/viirs` 可打开；
- Console 无未处理异常；
- 已声明为本地必需的资源不存在 404；外部 CARTO/Open-Meteo 网络失败有可理解降级。

## 6. 完成定义

只有同时满足以下条件才可报告本地收尾完成：

- 干净克隆 `npm ci` 成功；
- 单元测试实际全绿，报告实际测试数，不预设一定还是 39；
- lint、typecheck、Next build 全绿且 0 skipped；
- Next 本地服务器实际启动，`/`、`/viirs` 和两个 API 实测通过；
- Playwright 针对当前 Next 页面实际运行，而不是只 `--list`；
- 资源缺失已恢复或诚实降级，没有伪造暗夜数据；
- README、启动脚本、CI 与代码一致；
- 最终再从全新临时克隆复验；
- 未部署服务器。

## 7. 交付报告格式

Codex 完成后必须输出：

```text
BASE_SHA:
FINAL_SHA:
BRANCH:
PACKAGE_LOCK_SYNC: PASS/FAIL
NPM_CI: PASS/FAIL
LINT:
TYPECHECK:
UNIT_TESTS: x/x, skipped x
NEXT_BUILD:
E2E: x/x, skipped x
LIVE_OPEN_METEO:
LOCAL_URL:
ROUTES_CHECKED:
PUBLIC_ASSETS: restored / graceful-degradation / blocked
BROWSER_QA:
CI_CONFIG:
README_UPDATED:
DEPLOYMENT_PERFORMED: NO
REMAINING_BLOCKERS:
COMMIT:
PR:
```

## 8. 可直接复制给本地 Codex 的最终 Prompt

```text
你接手 GitHub 仓库 Jovifei/Star_photo_addr。当前权威基线是 main@5d5553b3f6e97dd868cdfd749b34084a82814e8c；先 git fetch 并确认远端没有更新，如已更新则记录新的 BASE_SHA，以最新 main 为准。新建分支 codex/local-run-finalization。不得从旧 Vite 分支整体覆盖 Next.js，不得 force push，不得部署服务器。

本阶段唯一目标：让用户在 Windows 本机从干净克隆可靠安装、启动 Next.js，并由浏览器打开 http://127.0.0.1:3000；同时把 README、测试门禁和 CI 与真实代码对齐。这里的“打开 HTML”不是直接双击 index.html，因为当前应用包含 Next.js 同源 /api/forecast 和 /api/geocode；必须启动本地服务。

先完整阅读并核对：
1. package.json 与 package-lock.json
2. .nvmrc
3. next.config.ts、vitest.config.ts、playwright.config.js
4. src/app/**、src/components/**、src/lib/**、src/data/**
5. README.md、LOCAL_CODEX_START.md、HANDOFF_CODEX.md
6. scripts/local-preflight.ps1
7. Dockerfile、docker-compose.yml、nginx.conf（只审计并记录，本阶段不部署）
8. .github/workflows/ci.yml
9. docs/PRODUCT_TECH_PLAN.md 与 docs/PERSEIDS_REFERENCE_AUDIT.md

必须先复现并解决以下已知 P0，禁止跳过：

A. 干净安装失败
- package.json 已是 Next.js 16.2.1 / React 19.2.4 / version 0.3.1，但 package-lock.json 仍是旧 Vite / React 19.2.0 / version 0.0.0。
- 在 Node 24 下 npm ci 会报告大量 Missing/Invalid。
- 正常更新 lockfile，不要手改 lockfile，不要用 --force 或 --legacy-peer-deps 掩盖问题。
- 删除本分支测试生成的 node_modules/.next 后重新 npm ci；最终还要从新的临时克隆 npm ci。

B. 命令和文档失配
- 当前文档/配置引用 test:unit、test:e2e、test:live、test:sites、preview、preview:test，但 package.json 中不存在。
- 统一为当前 Next.js 的命令：dev、build、start、lint、typecheck、test:unit、test:e2e、test:live、check。
- check 至少执行 lint + typecheck + unit + Next build，0 skipped。
- Playwright webServer 改为 Next build/start 或 Next dev，不得再依赖 Vite dist/client 或 preview:test。
- 旧 E2E 若针对 Vite 页面，必须重写为当前 Next 页面，不得仅靠 --list 冒充通过。

C. CI 错误
- .github/workflows/ci.yml 当前只监听 master，但默认分支是 main。
- 改为 main，并加入 workflow_dispatch；使用 Node 24、npm ci、npm run check。需要时增加实际 E2E，但不要把外网不稳定测试混成无说明的必过门禁。

D. public 资源缺失
- 当前仓库没有 public/，但代码请求 /images/perseids/og.png、world-atlas-2015.webp、中国 VIIRS 视觉/数值瓦片、cities.json、世界/中国行政边界、prefecture index、vnp46a4 metadata。
- 先只读搜索合法本地备份/旧 worktree/已有制品；记录每类资源的来源、许可证和大小。
- 只有确认合法且完整的资源才能恢复。不得从参考站私自抓取未知许可资产，不得生成伪数据。
- 若大瓦片本阶段无法恢复：基础 CARTO 地图、地点搜索、地图点击、天气和 11 夜切换仍必须可用；缺失 Bortle/VIIRS/候选/边界要禁用或优雅降级并清楚标“数据未安装/无数据/不确定”。sampleBortle 的 nodata 不得在 UI 中冒充可信 B9 或 SQM。
- 页面不得反复请求一批确定不存在的本地资源，也不得出现未处理异常。

E. 本地一键打开
- 新增并验证 Windows 启动入口（建议 scripts/start-local.ps1，可加 start-local.cmd）：检查 Node 24，缺依赖时 npm ci，启动 npm run dev，等待 http://127.0.0.1:3000 返回 200，然后打开系统浏览器；失败必须返回非零退出码并保留错误。
- README 顶部写最短路径，并明确当前端口 3000、Node 24、无需 API Key、不能直接双击 index.html。
- LOCAL_CODEX_START.md、HANDOFF_CODEX.md 与新 Next 基线同步；删除旧 Vite 9/9、Sites Worker、dist、8080 等不再成立的描述。

F. 本地真实验收
- npm ci
- npm run check
- npx playwright install chromium（缺浏览器时）
- npm run test:e2e（实际运行）
- npm run test:live
- npm run dev
- 验证 /、/viirs、/api/geocode?q=杭州&count=5&language=zh、/api/forecast?latitude=30.2741&longitude=120.1551&days=3。
- 桌面 1440×1000 与手机 390×844 检查：首页地图、搜索杭州、选择地点、侧栏、11 夜切换、地图点击、定位拒绝、/viirs、Console、必需本地资源 404。
- 若 CARTO/Open-Meteo 在你的环境无法联网，要精确区分环境阻断与产品失败；不得声称未运行的步骤通过。

G. 最终可复现性
- 完成修改和本工作树验证后提交。
- 从最终提交创建一个全新的临时克隆/工作树，确保其中没有 node_modules、.next、dist，再重新执行 npm ci、npm run check 和最小启动/路由验证。
- 更新 README 和交接文档，写明下一阶段才是服务器部署；本阶段不运行生产部署、不改 DNS、不配置域名。

Git 规则：保护用户已有改动；提交独立、信息清晰的 commit；push codex/local-run-finalization 并创建 Draft PR 到 main。除非已有用户对本次 PR 的明确合并授权，否则不要合并 main。不得 force push、不得改写历史。

完成后按以下格式报告，不要只说“已完成”：
BASE_SHA / FINAL_SHA / BRANCH / PACKAGE_LOCK_SYNC / NPM_CI / LINT / TYPECHECK / UNIT_TESTS（实际 x/x 与 skipped）/ NEXT_BUILD / E2E（实际 x/x）/ LIVE_OPEN_METEO / LOCAL_URL / ROUTES_CHECKED / PUBLIC_ASSETS / BROWSER_QA / CI_CONFIG / README_UPDATED / DEPLOYMENT_PERFORMED=NO / REMAINING_BLOCKERS / COMMIT / PR。

直接执行到可交付状态；只有遇到需要购买许可证、无法取得合法数据资产、需要用户凭据或存在破坏性范围不明时才停下来询问。
```

## 9. 下一阶段（本地收尾通过后再做）

服务器部署阶段再单独处理：

- 把旧 Vite/Nginx Dockerfile 改成 Next.js standalone 多阶段镜像；
- Node 24 运行时、非 root 用户、健康检查、环境变量与缓存策略；
- Nginx/Cloudflare 反代、HTTPS、域名、日志、监控、备份与回滚；
- 大型暗夜瓦片采用 Git LFS、对象存储或瓦片服务，不直接塞入普通 Git；
- 生产环境对 Open-Meteo 限流、缓存、超时与 SLA 做明确设计。

本交接不授权上述部署动作。
