# 星野决策 × 逐星：产品整合交接（2026-08-07）

## 1. 交付结论

本轮已把两个原本割裂的产品整合进同一个 Next.js 应用，并完成用户点名的地图、云层、时间轴、中文化、推荐地点、跨午夜语义、地点增删、日期排序、弹窗定位及双向联动。

- 仓库：`Jovifei/Star_photo_addr`
- 目标分支：`codex/product-integration-final`
- 基线：`origin/main@5d5553b`
- 远端核心整合提交：`ce05b2d feat: 完成双产品联动与观星云图体验`
- 本地开发提交（仅供追溯）：`afb7973`
- PR 目标：`codex/product-integration-final` → `main`

这次没有把 `.agents/`、`.qoder/`、Comet/OpenSpec 技能文件等代理运行残留带入产品提交。

## 2. 当前产品结构

| 路径 | 产品/功能 | 说明 |
| --- | --- | --- |
| `/` | 逐星 | 主地图、三层云量、时间轴、搜索、观星窗口 |
| `/sites` | 推荐观星地点 | 中国推荐观星地点地图、窗口与数据来源 |
| `/planner` | 星野决策 | 多地点多日期决策、地点增删、日期排序 |
| `/viirs` | 兼容入口 | 重定向到 `/sites#data-sources` |
| `/api/forecast` | 预报代理 | 标准化 Open-Meteo 逐小时/气压层数据 |
| `/api/geocode` | 地理编码代理 | 地址/地点搜索 |
| `/healthz` | 健康检查 | 返回 `ok` |

旧 Vite 入口已迁入 `src/features/planner/`，不再保留第二套构建链。删除的 `index.html`、`vite.config.mjs`、`src/main.jsx`、旧 worker/静态预览脚本可从 Git 历史恢复，但不应重新引入主应用。

## 3. 双产品打通协议

三个页面通过 URL 查询参数共享状态：

```text
lat=<纬度>&lng=<经度>&name=<地点名>&elevation=<海拔米>&night=<YYYY-MM-DD>
```

语义约束：

- `night=2026-08-07` 表示 **8 月 7 日 20:00 到 8 月 8 日 05:00**，不是 8 月 7 日凌晨。
- `/` 与 `/sites` 由根布局里的 `ProductStateBridge` 消费 URL 状态。
- `/planner` 自己读取 URL 状态，将联动地点加入决策上下文，但不会自动弹出遮挡内容的详情抽屉。
- 从星野决策跳到逐星时，优先携带当前联动地点；反向跳转也保留日期与地点。
- `/sites` 会在约 0.5° 范围内匹配最近的策划推荐点，无法匹配时仍保留用户地点上下文。

后续修改必须继续使用此协议，不要再新增互不兼容的 localStorage 或路径协议。

## 4. 已完成的用户需求

### 地图与云层

- 地图底图改为无英文注记；配置天地图 Token 时加载中文注记，否则显示内建中文城市标签。
- 基于视口 5×6 网格请求天气，用 IDW 插值绘制覆盖地图的云量面，不再只有一个光秃地图。
- 高云/中云/低云分别使用青、琥珀、紫色，可独立开关，当前值以 0–100% 显示。
- 底部时间轴覆盖 20:00 至次日 05:00，支持拖动与播放/暂停；三层数值随时间同步变化。
- 显示预报采样边界，帮助用户理解云层覆盖范围。

### 推荐地点与决策

- 新增独立 `/sites` 推荐观星地点页及地图标记。
- 星野决策支持添加/减少地点；自定义地点持久化。
- 日期列可升序/降序排列，日期标签包含星期几。
- 推荐候选区域已加宽，桌面和移动布局统一视觉令牌。
- 所有“夜晚”日期按 20:00→次日 05:00 跨午夜解释。

### 交互与可访问性

- “数据来源”改为 Portal 居中弹窗，z-index 足够高，不再被顶部页面挡住。
- 弹窗支持焦点锁定、Esc 关闭、背景滚动锁、可访问名称和安全区适配。
- 修复移动端弹窗溢出、搜索候选被云控件压住、详情恢复按钮被地图截获等实际 E2E 问题。
- 375/768/1024/1440 宽度均完成响应式检查。

### 工程化

- 重建有效的 lockfile v3：约 828 条 `node_modules/` 记录；`npm ci` 已通过。
- `package.json` 已声明 `type: module`，Playwright 配置不再因 `import.meta` 失败。
- E2E 使用 Next standalone production server，不依赖开发服务器。
- Dockerfile 改为 Node 24 多阶段 standalone 构建，Compose 映射 `8080:3000`。
- 清理旧 Vite/worker/静态站点构建链及相关测试。
- `.gitignore` 已排除 Comet、Qoder、OpenSpec、skills-lock 及 dist 备份污染。

## 5. 验证证据

已执行并通过：

```bash
NODE_OPTIONS= npm run check
```

结果：

- ESLint：0 问题
- TypeScript：通过
- Vitest：12 个测试文件，94/94 通过
- Next.js 16.2.1 production build：通过

已执行真实外部数据烟测：

```bash
npm run test:live
```

结果：2 个地点、48 小时 surface 数据、10 个 pressure levels，全部通过。

已用 standalone 构建验证运行时：

- `/healthz` 返回 `ok`
- `/`、`/sites`、`/planner` 均返回 HTTP 200

所有 Playwright 功能场景均在 desktop/mobile 项目中逐项通过，包括：弹窗层级、云层与时间轴、三层开关、跨午夜与排序、地点增删、推荐点、双产品 URL 联动、四档响应式宽度。

当前执行环境无法下载官方 Playwright Chromium，因此使用单进程 Chromium 兼容包逐项运行。该兼容二进制会在连续创建多个 browser context 时退出，所以未用它完成一次“整套串行”的 `npm run test:e2e`；CI 或有官方 Playwright Chromium 的机器仍应再跑一次完整命令。

当前环境也没有 Docker CLI，因此无法执行 `docker build`。standalone 服务器、Dockerfile 结构、Compose 与健康检查已验证；下一轮应在有 Docker 的环境补一次镜像级烟测。

## 6. 数据边界（不能误导用户）

- 当前云图是 Open-Meteo 预报网格的插值可视化，不是卫星实况云图，也不是雷达回波。
- Dark-sky/VIIRS 数据缺失时不生成假值；UI 应继续明确来源与缺口。
- 推荐观星地点是产品策划数据，坐标和描述需在正式上线前按可引用来源人工复核。
- 天地图中文注记需要有效的 `NEXT_PUBLIC_TIANDITU_TOKEN`；没有 Token 时只显示内建中国城市中文标签。

## 7. 下一步（只处理真正剩余项）

优先级顺序：

1. 在标准 CI/开发机执行 `npm ci && NODE_OPTIONS= npm run check && npm run test:e2e`。
2. 在有 Docker 的机器执行镜像构建、`/healthz` 和三个页面的容器烟测。
3. 检查草稿 PR 的 GitHub Actions，修复仅在 CI/部署环境暴露的问题。
4. 确认生产环境天地图 Token、Open-Meteo 缓存/限流策略。
5. 若要升级为“真实卫星云图/光污染图”，先确定有授权的数据源和瓦片协议，再实现，不要把插值预报包装成卫星数据。

不要再做：恢复 Vite 双构建、引入 Comet/OpenSpec 残留、改变 URL 联动参数、把夜晚日期解释回 00:00–23:59、用随机数补数据。
