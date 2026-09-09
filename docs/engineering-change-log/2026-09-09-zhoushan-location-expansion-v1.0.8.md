# 工程修改跟踪：v1.0.8 舟山海岛银河与热门机位扩展

> 基线：`main@21051b7409e34ec5ef578e7b27a2233a08723e90`
> 分支：`codex/zhoushan-location-expansion-20260909`

## 目的

用户反馈星空摄影观测平台的地点偏少，并指出舟山有可拍银河的海岛。本轮在不改评分、天气和 CloudSea 契约的前提下，补充公开资料可核对的舟山/嵊泗热门机位。目录仍是摄影候选入口，不是现场暗空、银河或晚霞概率保证。

## 新增目录与默认精选

- 通用 `catalog.json`：252 条 → 257 条，新增：
  - `finder-253-location` 朱家尖大青山猫跳（猫跳观景平台）；
  - `finder-254-location` 东极岛庙子湖（东翔亭/红色灯塔海岸）；
  - `finder-255-location` 枸杞岛山海奇观（山海奇观/五里碑）；
  - `finder-256-location` 嵊山岛东崖绝壁（东崖绝壁栈道）；
  - `finder-257-location` 花鸟岛前坑顶（前坑顶/观星栈道）。
- `东极岛东福山` 已在 v1.0.7 的 `finder-246-location` 中，本轮不重复添加；庙子湖作为关联机位新增到通用目录。
- `DEFAULT_CANDIDATE_SEEDS`：10 条 → 11 条，新增大青山猫跳；花鸟前坑顶等其余新海岛机位保留在通用目录，并保留 1 个候选加入空间，避免突破既有 12 条候选上限；用户 LocalStorage 候选仍优先保留。
- 全部新增点使用 Bortle 4 作为保守目录参考，不宣称 Bortle/SQM 实测；海拔为公开观景点/地图高程的近似值。

## 来源与核对

- [舟山日报：以观星为支点，撬动舟山文旅新赛道](https://epaper.wifizs.cn/zsrb/2026-08/02/content_99335233.html)：说明朱家尖大青山猫跳平台为滨海观星点，报道 6—10 月银河季；夜间活动和景区开放需以当天公告为准。
- [舟山群岛旅游/北京天文馆活动报道](https://www.sohu.com/a/1053312563_121106994)：核对猫跳观景平台活动位置与预约接驳边界。
- [朱家尖大青山高德 POI](https://www.amap.com/place/B02445IOXS)：核对景区坐标；猫跳海拔采用公开景区资料的观景点高度近似。
- [国务院：我国部分海域海岛标准名称](https://www.gov.cn/xinwen/2018-06/08/5297114/files/c598d7ab3259486b846cb4f0777ce44c.pdf)：核对庙子湖岛标准位置；[东极岛庙子湖地图点](https://nightchina.net/wp-content/plugins/leaflet-maps-marker/leaflet-fullscreen.php?marker=1640)用于机位坐标近似。
- [枸杞乡中心区域至山海奇观道路环评](https://zjjcmspublic.oss-cn-hangzhou-zwynet-d01-a.internet.cloud.zj.gov.cn/jcms_files/jcms1/web2518/site/attach/0/47a1c91a23c34ede86e5bb6690d6ed9a.pdf)：给出山海奇观终点坐标；[山海奇观高德 POI](https://www.amap.com/place/B0FFFO7RM8)交叉核对地图位置。
- [国家发展门户：枸杞岛山海奇观](https://cn.chinagate.cn/environment/2016-09/14/content_39298690_3.htm)：核对制高点、摩崖石刻与海上牧场构图价值；旅游资料提及星空仅作为候选线索，不转写为概率。
- [东崖绝壁高德 POI](https://www.amap.com/place/B024464ZKZ)：核对嵊山岛坐标；[嵊泗旅游报道](https://www.ctnews.com.cn/paper/att/202308/08/227f4377-aaeb-4ab0-93bf-ad9dd811033b.pdf)核对东端绝壁与日出属性。
- [花鸟乡政府简介](https://www.shengsi.gov.cn/art/2025/1/16/art_1228989746_41124867.html)：核对花鸟岛地理位置与前坑顶 236.8m；[前坑顶高德 POI](https://ditu.amap.com/place/B024400337)核对机位坐标；[潮新闻花鸟岛纪行](https://tidenews.com.cn/news.html?id=3040366&source=weixin)说明前坑顶适合观测星空。
- [花鸟岛“星屿星愿”观星设施报道](https://zsstb.zhoushan.gov.cn/art/2025/6/11/art_1228973558_58700364.html)：核对当地正在建设观星业态，不将设施建设等同于暗夜认证。

## 语义与安全边界

- 东极、枸杞、嵊山、花鸟均为离岛/海岛，船期受大风、大雾、台风影响，岛际客运与景区公告必须在出发前复核。
- 庙子湖、枸杞和嵊山有居民区、港口、渔船或民宿照明；花鸟灯塔会产生导航光；朱家尖大青山猫跳存在夜间预约、接驳、清场或关闭时段。均不默认支持整夜拍摄。
- 东崖绝壁朝东，主要推荐日出与海岸前景；大青山猫跳和枸杞山海奇观更适合晚霞/海上牧场，只有公开报道明确支持银河的点位才在描述中保守写入银河候选。
- 坐标来自地图 POI 或公开标准位置，国内互联网地图可能使用 GCJ-02；应用仍按现有坐标/天气链路处理，不宣称现场测量精度。

## 验证与回滚

- 回归覆盖：257 条目录、ID/坐标/海拔/说明唯一性、Bortle 分布、默认 11 条精选、版本一致性、B1–B4 过滤计数及 E2E mock 点位数。
- 计划运行：`npm ci`、`npm run check`、`npm run test:live`、`npm run check:data-sources`、本地 Chromium E2E、CI 五项门禁和公网四页面验收。
- 回滚目标：`21051b7409e34ec5ef578e7b27a2233a08723e90`（v1.0.7 已部署主干）。
