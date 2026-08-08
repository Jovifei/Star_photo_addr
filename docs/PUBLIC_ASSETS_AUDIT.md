# public/images/perseids 资源审计与降级决策

审计时间：2026-08-07
审计范围：任务 4.1 / 4.2 / 4.3（`openspec/changes/local-run-finalization/tasks.md`）
审计方式：**只读**。未从任何外部站点下载资源，未新增二进制文件。

## 1. 检索范围与结果（4.1）

| 检索位置 | 命令 | 结果 |
|---|---|---|
| 工作区 `public/` | `ls public` | **目录不存在** |
| git 索引 | `git ls-files public` | 空 |
| git worktree | `git worktree list` | 仅当前一个，无旧 worktree |
| 全量 git 历史 | `git log --all --diff-filter=A --name-only -- 'public/*'` | 命中 1 个备份提交 |
| 构建制品 | `.next/` `dist/` `out/` | 无 `images/perseids` 静态资源 |

唯一命中：提交 `ce451ab`（`backup: Next.js perseids-clone rewrite + star-weather port (pre origin/main sync)`），
可达分支 `remotes/origin/feature/nextjs-perseids-clone`。当前分支
`feature/20260807/local-run-finalization` **不包含**该提交，源码被移植而 `public/` 未被移植。

## 2. 资源清单：来源 / 许可 / 大小 / 决定

`ce451ab` 中共 15 个文件，合计约 3.24 MB。

| 资源 | 大小 (B) | 来源 | 许可状态 | 决定 |
|---|---:|---|---|---|
| `data/world-atlas-2015.webp` | 230,894 | Falchi et al. New World Atlas 2015 派生栅格 | **未确认**。镜像同时存在 CC BY-NC 4.0 与「联系作者确认」两种说明；商业使用前须书面确认 | ❌ 不恢复 |
| `world-atlas-2015.webp`（根目录副本） | 230,894 | 同上（重复文件） | 同上 | ❌ 不恢复 |
| `data/world-atlas-2015-values.webp` | 590,532 | 同上，数值编码版 | 同上；且编码未公开 | ❌ 不恢复（代码亦未引用） |
| `data/vnp46a4-2024.json` | 11,655 | NASA VNP46A4 C002，DOI `10.5067/VIIRS/VNP46A4.002` + 自撰 Garstang–Cinzano 模型元数据 | NASA 源数据可追溯，但内含 `external-display-2025` 对齐参数，系对**第三方 2025 展示成果**的拟合 | ❌ 不恢复（数值已内联至 `src/data/viirsMeta.ts`，无需运行时拉取） |
| `data/vnp46a4-samples-2024.json` | 219,125 | 同上，采样点集 | 同上 | ❌ 不恢复（代码未引用） |
| `tiles-sample/vnp46a4-2024-8-210-97.webp` | 2,534 | VNP46A4 派生瓦片，**单块** z8 瓦片 | 同上 | ❌ 不恢复（见 §3 局部数据陷阱） |
| `tiles-sample/vnp46a4-2024-values-8-210-97.webp` | 14,698 | 同上，数值瓦片，**单块** | 同上 | ❌ 不恢复（同上） |
| `tiles-sample/carto-dark-4-13-6.png` | 6,918 | CARTO dark_all 底图瓦片缓存 | CARTO/OSM 条款不允许离线再分发瓦片缓存 | ❌ 不恢复 |
| `data/cities.json` | 145,755 | 370 行「市域暗夜候选点」，`kind: "modeled"` | 由上述未授权模型派生；`bortle` 字段即建模值 | ❌ 不恢复（见 §3） |
| `data/china-province-boundaries-wgs84.geojson` | 424,303 | 阿里云 DataV 行政边界，GCJ-02 转 WGS84 | 无审图号；中国行政边界属测绘成果 | ❌ 不恢复（见 §4 合规） |
| `data/china-prefecture-boundaries.index.json` | 5,347 | 同上（索引，`source` 字段自述 DataV） | 同上 | ❌ 不恢复 |
| `data/china-country-outline-wgs84.geojson` | 138,003 | 同上 | 同上 | ❌ 不恢复（代码未引用） |
| `data/world-country-boundaries.geojson` | 94,193 | 世界国界，来源未记录 | 未确认；且含中国国界画法 | ❌ 不恢复（见 §4） |
| `og.png` | 1,014,640 | 社交分享图，疑似取自参考站 `perseids.giraffetree.cn` | 无授权记录 | ❌ 不恢复，并**移除代码引用** |
| `data/viirs-page.html` | 17,214 | 参考站页面抓取副本 | 无授权记录 | ❌ 不恢复（代码未引用） |

**结论：无一类资源同时满足「许可明确」与「完整」，因此本轮恢复 0 个文件，全部走降级路径。**

## 3. 从未存在的路径（真正的 404 风暴来源）

以下路径被源码引用，但**在任何提交中都不存在**，是 4.3 的主要问题：

| 引用位置 | 路径模板 | 后果 |
|---|---|---|
| `viirsMeta.VIIRS_WEB_LAYER.tiles` → `ViirsTileLayer` | `/images/perseids/data/vnp46a4/2024/{z}/{x}/{y}.webp` | `bortleEnabled` 默认 `true`，Leaflet 每次平移/缩放请求整屏瓦片 → **持续 404 风暴** |
| `constants.VIIRS_VALUE_BASE` → `darksky` | `/images/perseids/data/vnp46a4/2024-values/8/{x}/{y}.webp` | 每次点击地图 2 次 404 |
| `BoundaryLayers.PREFECTURE_BASE` | `/images/perseids/data/boundaries/prefectures/{adcode}.geojson` | 索引有 300+ 条目，zoom≥6 时**并发 300+ 次 404** |

「局部数据陷阱」：`tiles-sample` 只有 `8/210/97` 一块瓦片（覆盖浙北一隅）。若恢复它作为兜底，
则**仅该地块**能采到值、其余全国返回 nodata，用户无法区分「真暗」与「无数据」——正是
`docs/LIGHT_POLLUTION_DATA_DECISION.md` 所禁止的「看似精确、实际不可审计」。故不恢复。

## 4. 合规约束（中国地图数据）

依据 `geo-map-compliance-guard`：

- 中国国界、台湾、南海诸岛画法须符合国家标准，禁止错绘错标。
- 恢复来源不可考、无审图号的省级/地级边界 GeoJSON，并叠加在境外底图上渲染，构成错绘风险。
- 因此边界图层**默认关闭**，且不随仓库分发边界数据。

**遗留风险（超出本组范围，已上报）**：当前底图为 Leaflet + CARTO(OSM 派生) 境外瓦片，
不在合规白名单（腾讯地图 / 高德 / 百度 / 天地图）内。更换地图引擎属架构变更，本组未改动。

## 5. 已实施的降级（4.2 / 4.3）

统一开关：`src/lib/assets.ts`。四组资源默认全部 `false`，**不发起任何请求**。

| 资源组 | 环境变量 | 默认 | 缺失时行为 |
|---|---|---|---|
| VIIRS 瓦片 | `NEXT_PUBLIC_ASSET_VIIRS_TILES` | 关 | `ViirsTileLayer` 不挂载；`darksky` 直接返回 `layer-unavailable`，零网络请求 |
| World Atlas | `NEXT_PUBLIC_ASSET_WORLD_ATLAS` | 关 | `WorldAtlasOverlay` 不挂载 |
| 候选点位 | `NEXT_PUBLIC_ASSET_CITY_CANDIDATES` | 关 | 侧栏显示「暂无候选点位数据」，不再无限「正在加载…」 |
| 行政边界 | `NEXT_PUBLIC_ASSET_BOUNDARIES` | 关 | `BoundaryLayers` 不发请求 |

关键修正：`sampleBortle` 的 nodata **不再冒充 B9**。

- `classifyBortle(null)` 由「返回 B9」改为**返回 `null`**；
- `DarkSkySample.bortle` / `bortleName` 类型放宽为可空，新增 `status` 判别字段
  （`ok` / `nodata` / `unsupported-region` / `layer-unavailable`）；
- UI 显示「无数据」并给出原因，不显示任何 B 级或 mpsas 数字。

## 6. 后续若获得授权

把合法资源放到 `public/images/perseids/` 下（目录结构见 §3 路径模板），
再按需开启对应 `NEXT_PUBLIC_ASSET_*=1`。代码无需改动。
每类资源须同时补充 `dataset_id`、版本、观测年份、许可 URL 与校验和，
遵循 `docs/LIGHT_POLLUTION_DATA_DECISION.md` §1 原始数据层要求。
