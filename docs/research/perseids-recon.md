# Perseids 逐星站点侦察报告

**目标:** https://perseids.giraffetree.cn/  
**项目:** 在 Next.js 16 中复刻该天文观测地图站点。  
**侦察日期:** 2026-08-07  
**工具:** Playwright + Chromium + curl + 源码静态分析。

## 1. 概览

"逐星｜全球英仙座流星雨观测地图" 是一个单页应用（Vite/VINEXT + React 构建），**不是 Next.js 原生站点**。核心功能：

- 基于 Leaflet 的深色世界地图，叠加 2015 World Atlas 全球暗夜参考层和中国 2024 VIIRS 增强层。
- 地点搜索（腾讯位置服务 + Open-Meteo Geocoding）。
- 任意地点点击取样，读取 Bortle 等级（客户端从本地 WebP tile 采样）。
- 当地时区下 2026 英仙座流星雨 8 月 7–17 日每晚 20:00–05:00 的天气窗口。
- Open-Meteo 未来云图（ICON/GFS/AIFS），使用自定义 `om://` 协议瓦片。

Bortle 计算**完全在客户端完成**，站点没有私有后端 API，所有暗夜数据都是 `/data/` 下的静态资源。

## 2. 页面结构与区块

```
<main class="app-shell no-weather-timeline details-closed">
  <header class="topbar">
    品牌：逐星 · PERSEIDS OBSERVATORY · WORLD
    事件状态：当地夜间 20:00—次日 05:00 · 倒计时
    <button class="source-button">数据依据与局限</button>
  </header>
  <div class="workspace">
    <section class="map-stage">
      .tencent-map-root > .map-canvas   (Leaflet 地图)
      .map-view-actions                  (边界图例 + 中国/全球/取样中心按钮)
      .map-setup                         (加载遮罩：正在展开全球暗夜地图…)
      .map-headline                      (PERSEIDS · 2026 / 英仙座流星雨 / 8月12日夜—13日黎明)
      .map-search-card                   (搜索框 + 我的位置)
      .cloud-control                     (未来云图开关 + 模型/云层/时间滑块)
      .bortle-control                    (波特尔开关 + B1–B9 条 + ? 帮助浮层)
      .map-legend                        (点击地图任意位置…提示)
    </section>
    <div class="detail-overlay-host">
      <aside id="observation-details" class="side-panel">观测地详情 / 候选点列表</aside>
      <button class="detail-restore">观测详情 未选 展开</button>
    </div>
  </div>
</main>
```

### 主要区块说明

| 区块 | 作用 | 关键 DOM |
|------|------|----------|
| 顶部栏 | 品牌、事件倒计时、数据来源入口 | `.topbar` |
| 地图区 | Leaflet + CARTO 暗色底图 + 暗夜叠加层 + 行政边界 | `.map-stage`, `.map-canvas` |
| 地图标题 | 活动名称与峰值日期 | `.map-headline` |
| 搜索卡 | 地点搜索 + 我的位置 | `.map-search-card` |
| 未来云图 | 预报模型切换、云层类型、预报时间滑块 | `.cloud-control` |
| 波特尔图层 | Bortle 等级开关、B1–B9 色带、帮助浮层 | `.bortle-control` |
| 观测详情 | 选中地点的暗夜、天气、月光、流星活动、候选点排名 | `.side-panel`, `.detail-restore` |

### 路由

| 路由 | 说明 |
|------|------|
| `/` | 主地图页 |
| `/viirs` | 与 `/` 返回同一 SPA shell；`#bortle` 锚点用于渲染「公开公式、参数与验证方法」参考页（客户端路由）。 |

## 3. 设计 Token

### 3.1 颜色（来自 `getComputedStyle`）

| Token | 值 | 用途 |
|-------|-----|------|
| 背景 `--bg` | `#02070b` | 页面主背景、地图暗色基底 |
| 主文字 `--text` | `#e7e7e0` | 主要文字 |
| 次要文字 `--muted` | `#91a4ab` | 次级/辅助说明文字 |
| 金色 `--amber` | `#d4b273` | 品牌、装饰、按钮高亮 |
| 青色 `--green` | `#79cfe2` | 选中点标记、交互强调 |
| 青色柔和 `--green-soft` | `#b0e6ef` | 悬停/高亮 |
| 红色 `--red` | `#cb7768` | 警告/错误 |
| 面板 `--panel` | `#061118d1` | 玻璃态面板背景 |
| 次面板 `--panel-2` | `#0c1e27b8` | 次要面板 |
| 边框 `--line` | `#a5cdd829` (~16% alpha) | 面板、按钮边框 |
| 强边框 `--line-strong` | `#97d3e152` (~32% alpha) | 强调边框 |

### 3.2 Bortle 等级色带

| 等级 | 颜色 | 名称 |
|------|------|------|
| B1 | `#000000` | 极佳暗空 |
| B2 | `#222222` | 典型暗空 |
| B3 | `#143072` | 乡村天空 |
| B4 | `#105715` | 乡村—郊区过渡 |
| B5 | `#FD9650` | 郊区天空 |
| B6 | `#FC5A49` | 明亮郊区天空 |
| B7 | `#FC998A` | 郊区—城市过渡 |
| B8 | `#A0A0A0` | 城市天空 |
| B9 | `#F2F2F2` | 城市中心天空 |

### 3.3 字体

| 用途 | 字体栈 |
|------|--------|
| 正文/UI | `"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif` |
| 标题/品牌 | `"Songti SC", STSong, "Noto Serif CJK SC", Georgia, serif` |
| 代码/数据 | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace` |

无外部 Web 字体文件；全部使用系统字体。

### 3.4 尺寸与圆角

| 元素 | 字号 | 圆角 | 备注 |
|------|------|------|------|
| body | 14px / 行高 21px | — | 基准 |
| 品牌名 `.brand-block strong` | 22px | — | 字距 4.84px，宋体 |
| 地图标题 h1 | 38px | — | 字距 3.04px，宋体 |
| 搜索框 | 14px | 6px | 高度约 40px，右 padding 34px |
| 按钮/小按钮 | 9–11px | 6–7px | 边框 rgba 金色/青色 |
| 面板 | 14px | 10px | 半透明深色 + 模糊 |
| 品牌徽标 | 14px | 50% | 金色圆圈 + 发光 |

### 3.5 阴影/光效

- 品牌徽标：`rgba(212,178,115,0.16) 0 0 28px, rgba(212,178,115,0.1) 0 0 16px inset`
- 面板：`rgba(230,247,250,0.07) 0 1px 0 inset, rgba(0,0,0,0.3) 0 16px 44px`
- 详情浮层：`rgba(0,0,0,0.34) 0 18px 48px, rgba(230,247,250,0.07) 0 1px 0 inset`
- 整体风格：深色玻璃拟态 + 低饱和青/金点缀。

## 4. 资产清单

下载位置: `D:\work\star-weather-planner\public\images\perseids\`

| 原始 URL | 本地路径 | 用途 |
|----------|----------|------|
| `https://perseids.giraffetree.cn/og.png` | `public/images/perseids/og.png` | OpenGraph/Twitter 分享图 (1200×630) |
| `https://perseids.giraffetree.cn/data/world-atlas-2015.webp` | `public/images/perseids/data/world-atlas-2015.webp` | 全球 2015 World Atlas 暗夜参考层（视觉叠加） |
| `https://perseids.giraffetree.cn/data/world-atlas-2015-values.webp` | `public/images/perseids/data/world-atlas-2015-values.webp` | 全球参考层数值图 |
| `https://perseids.giraffetree.cn/data/vnp46a4/2024/{z}/{x}/{y}.webp?model=...&style=...` | 样例：`public/images/perseids/tiles-sample/vnp46a4-2024-8-210-97.webp` | 中国 2024 VIIRS 增强层（视觉瓦片，bounds lat[3,55] lng[72,136]，maxNativeZoom 8） |
| `https://perseids.giraffetree.cn/data/vnp46a4/2024-values/{z}/{x}/{y}.webp?model=...` | 样例：`public/images/perseids/tiles-sample/vnp46a4-2024-values-8-210-97.webp` | VIIRS 数值采样瓦片（客户端读取像素算 Bortle） |
| `https://perseids.giraffetree.cn/data/vnp46a4-2024.json` | `public/images/perseids/data/vnp46a4-2024.json` | VIIRS 模型元数据、校准参数、颜色分级 |
| `https://perseids.giraffetree.cn/data/vnp46a4-samples-2024.json` | `public/images/perseids/data/vnp46a4-samples-2024.json` | 370 个城市候选点的预计算 Bortle 样本 |
| `https://perseids.giraffetree.cn/data/cities.json` | `public/images/perseids/data/cities.json` | 370 个中国暗夜候选点（界面展示 34 个精选） |
| `https://perseids.giraffetree.cn/data/world-country-boundaries.geojson` | `public/images/perseids/data/world-country-boundaries.geojson` | 世界国界 GeoJSON |
| `https://perseids.giraffetree.cn/data/china-country-outline-wgs84.geojson` | `public/images/perseids/data/china-country-outline-wgs84.geojson` | 中国国界轮廓 GeoJSON |
| `https://perseids.giraffetree.cn/data/china-province-boundaries-wgs84.geojson` | `public/images/perseids/data/china-province-boundaries-wgs84.geojson` | 中国省界 GeoJSON（含省会标签） |
| `https://perseids.giraffetree.cn/data/china-prefecture-boundaries.index.json` | `public/images/perseids/data/china-prefecture-boundaries.index.json` | 中国地级市边界瓦片/索引列表 |
| `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` | 样例：`public/images/perseids/tiles-sample/carto-dark-4-13-6.png` | CARTO 深色底图瓦片 |

**未作为独立文件下载的视觉元素：**

- 品牌徽标是 Unicode `✦` + 圆形 CSS，无图片 logo。
- 搜索图标 `⌕`、定位图标 `⌾`、云图图标 `☁` 均为 Unicode 字符。
- 云层数据为 Open-Meteo `.om` 二进制瓦片，按需动态下载；仅 URL 模板已记录。

## 5. 交互清单

| 交互 | 行为 | 依赖 |
|------|------|------|
| 地点搜索 | 在搜索框输入 ≥2 字符后 280ms 防抖；同时调用腾讯地点建议（中文）和 Open-Meteo Geocoding（全球）| `apis.map.qq.com/ws/place/v1/suggestion`, `geocoding-api.open-meteo.com/v1/search` |
| 我的位置 | 调用 `navigator.geolocation`；成功后以该坐标创建取样点 | 浏览器 Geolocation API |
| 点击地图 | 在点击处创建取样点，读取当地暗夜 + 天气 | 本地 VIIRS tile / World Atlas tile |
| Bortle 开关 | 切换全球 2015 参考层与中国 2024 增强层显示 | `/data/world-atlas-2015.webp`, `/data/vnp46a4/2024/...webp` |
| Bortle ? 帮助 | 弹出浮层，说明数据来源与局限，链接 `/viirs#bortle` | 静态文本 |
| 未来云图开关 | 需先选择观测地点和日期；开启后加载 Open-Meteo OM 瓦片 | `map-tiles.open-meteo.com/data_spatial/{model}/...` |
| 云图模型切换 | ICON（默认，推荐，约 11km，7.5 天）、GFS、AIFS | Open-Meteo 元数据 |
| 云层类型切换 | 总云 / 低云 / 中云 / 高云 | 同上 |
| 预报时间滑块 | 拖动选择未来时间点；显示当地时间 | `Intl.DateTimeFormat` 时区转换 |
| 候选点列表 | 展示 34 个中国精选点；点击后选中并定位 | `/data/cities.json` |
| 观测详情展开/收起 | 右侧抽屉；`detail-restore` 按钮触发 | CSS transform |
| 中国视图 / 全球视图 / 取样中心 | 地图快速定位按钮 | Leaflet `flyTo` |
| 倒计时 | 距 2026-08-13T12:00:00Z 的剩余天数，每分钟刷新 | `Date` |
| 当地夜间时间 | 20:00–次日 05:00，按选中地点时区 | `Intl.DateTimeFormat` |

## 6. 外部 API 与端点

### 6.1 实时数据

| 端点 | 用途 | 备注 |
|------|------|------|
| `https://api.open-meteo.com/v1/forecast` | 逐点天气预报（温度、云量、降水、风速等） | 按当地时区请求 20:00–05:00 窗口 |
| `https://geocoding-api.open-meteo.com/v1/search` | 全球地名搜索 | `name`, `count`, `language=zh`, `format=json` |
| `https://apis.map.qq.com/ws/place/v1/suggestion` | 中文地名搜索/联想 | 暴露 KEY: `RFFBZ-VKBWI-KDFG3-53RB6-Z5WUZ-WVFUO` |
| `https://map-tiles.open-meteo.com/data_spatial/{model}/latest.json` | 云图元数据（可用时间序列） | `{model}`: `dwd_icon`, `gfs`, `aifs` |
| `https://map-tiles.open-meteo.com/data_spatial/{model}/{date}/{time}Z/{validDate}T{validTime}.om` | 云图二进制瓦片 | `.om` 格式（Open-Meteo 自定义），通过 Leaflet 自定义 `om://` 协议加载 |
| `https://aa.usno.navy.mil/calculated/moon/phases` | 月相数据 | 计算月光照度 |
| `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` | 深色地图底图 | Leaflet tileLayer |

### 6.2 静态参考

| 端点 | 用途 |
|------|------|
| `https://imo.net/files/meteor-shower/cal2026.pdf` | IMO 2026 流星雨日历（峰值时间来源） |
| `https://www.dutch-meteor-society.nl/DMS/Meteor%20stream%20activity%20I.pdf` | Jenniskens 年度活动曲线（ZHR 剖面来源） |
| `https://www.windy.com/-Clouds-clouds?clouds,lat,lng,7` | 「在 Windy 查看」外部链接 |
| `https://maps.open-meteo.com/` / `https://open-meteo.com/en/docs` | Open-Meteo 归属链接 |

## 7. 截图产出

保存在 `D:\work\star-weather-planner\docs\design-references\`：

- `perseids-desktop.png` — 1440×900 viewport，地图与全部控件已加载
- `perseids-desktop-full.png` — 1440 宽度整页滚动截图
- `perseids-mobile.png` — 390×844 移动端
- `perseids-state-search.png` — 搜索框输入「北京」并显示候选
- `perseids-state-bortle-help.png` — Bortle 帮助浮层展开
- `perseids-state-cloud.png` — 未来云图面板展开并加载（首次运行捕获）
- `perseids-state-locate.png` — 点击「我的位置」后，以北京坐标为中心定位

## 8. 不确定性与重建注意事项

1. **云层协议 `.om`**：Open-Meteo 瓦片是自定义二进制格式，复刻时若无法解析，需用 Open-Meteo 提供的库或改用其 PNG/WebP 云层瓦片方案。
2. **Bortle 像素采样算法**：虽然 tile 和公式常量已下载，但 `vnp46a4/2024-values/{z}/{x}/{y}.webp` 像素 → mpsas → Bortle 的完整转换函数需要额外反推（核心逻辑在 `bortle-model-qpdrSLyu.js` 中）。
3. **腾讯 API KEY 暴露**：真实站点在 JS 中硬编码了腾讯位置服务 KEY。复刻时应使用自己的 KEY 并通过环境变量/服务端代理管理。
4. **地图性能**：首屏需要加载 200–400KB+ 的边界 GeoJSON 和 World Atlas overlay，低性能设备可能需要加载占位。
5. **路由 `/viirs`**：当前服务器对 `/viirs` 返回与 `/` 完全相同的 HTML shell，内容由客户端 JS 根据 `location.hash` 渲染。复刻为 Next.js 时可做成真实 `/viirs` 页面或保持 SPA fallback。
6. **WebP tiles 路径参数**：`model=garstang-cinzano-zsb-2024-v2.0&style=soft-bands-no-outline-v2` 是当前样式；后续若目标站点更新，tile 样式可能变化。
7. **未来云图启用条件**：侦察发现，必须先选择地点和日期，云图开关才会从 `disabled` 变为可用。交互状态设计时要体现这一点。
