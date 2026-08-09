# Codex 继续开发交接：UI/UX Pro Max 与地图 Phase 2

更新时间：2026-08-06
权威基线：GitHub `main`（本轮提交合并后）

## 本轮已经完成

- 再次核对 `main`、`agent/map-observatory`、`codex/local-validation-and-hardening`：旧分支没有尚未吸收的产品代码，不应整体合并。
- 统一全站 Observatory Theme v2：背景、面板、边框、圆角、阴影、导航、按钮、状态、表格、地图、抽屉和手机底栏使用同一套设计令牌。
- 地图候选点名称可编辑；空名称不可保存。
- 按坐标和 ID 双重防重复保存，避免搜索结果被重复写入本地点位。
- 2026 英仙座流星雨入口增加 IMO 来源链接。
- 地图 E2E 增加地名搜索 mock、地图 14 天、改名、保存、防重复，以及定位允许/拒绝路径。
- 增加不依赖 Vite 网络接口枚举的测试预览服务器，支持 SPA fallback。
- 完成光污染数据决策文档：`docs/LIGHT_POLLUTION_DATA_DECISION.md`。
- 重写 README，使功能、数据边界、运行方式和真实状态与代码一致。
- 完成 UI/UX Pro Max 优化：设计系统落盘、44px 触控、skip link、导航/筛选语义、弹层焦点管理、地图键盘点位列表、读屏状态与图表按需加载。
- E2E 增加 375/768/1024/1440 横向溢出、skip link、导航状态与弹层初始焦点检查。

## 本轮验证证据

已真实通过：

```text
npm test
  Vitest: 9/9
  Sites Worker: 4/4
  Vite production build: passed

npm run test:live
  Open-Meteo: 2 locations / 48 surface hours / 10 pressure levels

npx playwright test --list
  30 desktop/mobile tests enumerated

node scripts/serve-preview.mjs
  / and /map: HTTP 200 (SPA fallback passed)
```

E2E 测试被 Playwright Chromium 缺失阻断。已尝试把浏览器安装到工作区，但当前网络把 Playwright CDN 下载响应截断为 0 MiB，反复报：

```text
End of central directory record signature not found
Failed to download Chrome for Testing 151.0.7922.34
```

这不是产品用例失败，不能算作浏览器通过。请在允许下载浏览器的环境执行下方命令补齐。

## 本地继续

```bash
git clone https://github.com/Jovifei/Star_photo_addr.git
cd Star_photo_addr
git switch main
npm ci
npx playwright install chromium
npm test
npm run test:e2e
npm run test:live
```

重点检查 `docs/qa/` 新生成的：

- `*-desktop-dashboard.jpg`
- `*-mobile-dashboard.jpg`（375×812）
- `*-desktop-map-search.jpg`
- `*-mobile-map-search.jpg`

验收分辨率以 `playwright.config.js` 为准：桌面 1440×1000，手机 375×812；响应式用例还会检查 768 与 1024。

## 真实剩余项

### P0：浏览器与部署验收

1. 安装 Playwright Chromium，跑完 `npm run test:e2e` 当前枚举的全部 desktop/mobile 用例。
2. 检查首页、地图搜索、矩阵、点位表和详情抽屉截图；若出现溢出、裁切、对比不足再做小范围 CSS 修复。
3. 在真实浏览器手动允许一次定位权限，确认 HTTPS 部署下定位成功；自动化已覆盖 API 成功/拒绝逻辑，但没有使用真实设备 GPS。
4. 在装有 Docker 的机器运行容器并验证 `/healthz`；当前环境没有 Docker。

### P1：光污染数据层

先阅读 `docs/LIGHT_POLLUTION_DATA_DECISION.md`。必须由产品方确认商业/非商业用途、Earthdata Token、仅中国或全球、以及是否投入天空亮度传播/现场 SQM 校准。确认前：

- 不得把 VNP46A4/EOG 普通卫星夜光辐亮度命名为 SQM 或 Bortle。
- 不得把无数据像元当作“暗”。
- 不得让光污染进入评分。

决策完成后实现同域 `/api/light-pollution/...` 元数据、瓦片和点查询；任何评分变化需升级 `SCORE_MODEL_VERSION` 并补回归测试。

### P1：多模型云量地图

- 后端设计 `/api/cloud-tiles/{model}/{level}/{time}/{z}/{x}/{y}`，浏览器不直接读取 GRIB。
- 模型建议：Best Match、ICON、GFS、AIFS；层级 total/low/mid/high。
- 时间滑块必须显示模型起报、有效时次和无数据状态；地图与点位卡片使用同一有效时次。

### P2：候选点与事件

- 接入道路可达性、地形坡度、灾害预警和行政边界；候选点不能只按黑暗程度排序。
- 建立带活动期、峰值 UTC、ZHR、辐射点、月相、来源 URL 与抓取时间的事件表。
- 对来源有分歧的事件数据保留来源和抓取版本，不展示无来源的伪精确值。

## 可直接交给本地 Codex 的提示词

```text
你接手仓库 Jovifei/Star_photo_addr。以最新 main 为唯一权威基线，新建任务分支，不要整体合并 agent/map-observatory 或 codex/local-validation-and-hardening。

先完整阅读：
1. README.md
2. docs/PRODUCT_TECH_PLAN.md
3. docs/PERSEIDS_REFERENCE_AUDIT.md
4. docs/LIGHT_POLLUTION_DATA_DECISION.md
5. docs/CODEX_HANDOFF_MAP_PHASE2.md
6. docs/UI_UX_PRO_MAX_AUDIT.md
7. design-system/star-photo-planner/MASTER.md

第一目标是完成 P0 真实浏览器验收，不要先扩功能：
- npm ci
- npx playwright install chromium
- npm test
- npm run test:e2e
- npm run test:live
- 检查 docs/qa 中 desktop/mobile 的 dashboard、map-search、matrix、drawer、location-form 截图。
- 对照 Observatory Theme v3 检查：所有页面背景、面板、圆角、边框、按钮、表格、导航、状态色一致；375/768/1024/1440 不出现页面级横向溢出，地图搜索框、快速点位列表、候选点名称输入和底栏不重叠。
- E2E 必须覆盖：进入地图、搜索杭州、选择结果、切换 14 天、编辑名称、保存、防重复、定位允许/拒绝。
- 在装有 Docker 的机器执行 docker compose up --build -d，再验证 /healthz。

只有 P0 全绿后才进入 P1。光污染必须遵守 docs/LIGHT_POLLUTION_DATA_DECISION.md：不能把普通卫星夜光辐亮度伪装成 SQM/Bortle，不能在许可和版本未确认时进入评分。

完成后提交独立分支，给出：commit、实际测试数、截图清单、Docker 结果、仍未解决的外部依赖。直接执行，不要停在方案。
```

## 完成定义

- 当前全部 E2E 用例在 desktop/mobile 全绿，且截图人工检查无明显溢出或层级割裂。
- Docker `/healthz` 实际返回成功。
- 第三方数据均有名称、许可证、版本/年份、分辨率、更新时间和缺失状态。
- 第三方图层失败时，基础天气、地图选点和点位管理仍可使用。
