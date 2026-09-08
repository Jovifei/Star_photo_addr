# 工程修改跟踪：v1.0.7 热门摄影地点扩展

> 基线：`main@5900bd8f01a17dddf52dafe1a22d4d382ae02b81`
> 分支：`codex/location-expansion-20260909`

## 目的

用户反馈默认地点和云海选址过少。本轮补充一批公开资料可核对的晚霞、星空和云海摄影候选，并把首页默认精选从 4 个扩展为 10 个。地点目录是候选入口，不是现场概率或暗空实测。

## 新增目录

- 通用 `catalog.json`：242 条 → 252 条，新增东山岛、霞浦东壁、涠洲岛滴水丹屏、东极岛东福山、四姑娘山猫鼻梁、峨眉山金顶、景迈山翁基、神农顶、巴朗山垭口、元阳坝达。
- CloudSea `cloudseaSites.ts`：44 条 → 54 条，新增猫儿山、武夷山天游峰、神农顶、巴朗山、云和梯田、金佛山、瓦屋山、苏宝顶、九华山天台峰、元阳坝达。
- 默认候选：`DEFAULT_CANDIDATE_SEEDS` 4 条 → 10 条；用户已有 LocalStorage 候选不被覆盖。

## 来源与核对

以下来源用于确认“适合该类摄影/景观”的公开描述；坐标采用地图 POI/WGS84 近似点，海拔采用观景点或景区公开范围，不能替代现场测量：

- [福建省政府：东山岛晨昏与金銮湾日落](https://www.fj.gov.cn/zwgk/ztzl/sxzygwzxsgzx/sdjj/wvjj/202604/t20260416_7125221.htm)
- [福建省交通运输厅：霞浦东壁日落与光影专线](https://jtyst.fujian.gov.cn/zwgk/jtyw/mtsy/202608/t20260825_7203990.htm)
- [广西自治区文旅厅：涠洲岛滴水丹屏日落路线](https://wlt.gxzf.gov.cn/ztzl/lsgd/2025gxlyn/lylx/t19735300.shtml)
- [武夷山国家公园：天游峰云海与海拔 408.8m](https://wysgjgy.fujian.gov.cn/yxgy/gyjg/201710/t20171025_5511576.htm)
- [神农架国家公园：神农顶海拔 3106.2m](https://en.snjnationalpark.com/Education/Resources/Geology/202209/t4504384.shtml)
- [卧龙管理局：巴朗山云海与高山草甸](https://www.chinawolong.gov.cn/scwl/c106497/202103/b5130236d9344b839387d4bef54d84bb.shtml)
- [重庆市政府：金佛山金佛晚霞](https://www.cq.gov.cn/zjcq/lszq/stpz/gjslgy/202606/t20260604_15727456.html)
- [国家林草局：瓦屋山云海、日出、佛光、星轨及夜间限制](https://www.forestry.gov.cn/c/www/xwdt/582351.jhtml)
- [洪江市政府：苏宝顶日落、星空、日出与云海](https://www.hjs.gov.cn/hjs/c106462/202211/32da5cf1185a4e5ea31b470a3d7e9484.shtml)
- [九华山风景区：天台峰云海、日出与海拔 1306m](https://www.jiuhuashan.gov.cn/jhsdzgy/News/show/770046.html)
- [红河州政府：元阳哈尼梯田云海与日出摄影](https://www.hh.gov.cn/info/9031/791692.htm)
- [云南文旅：景迈山日出、日落、星空与云海](https://www.ynxc.gov.cn/html/2024/yunnanlunbotu_0209/9761.html)

## 语义与安全边界

- 新增沿海点归入晚霞/海岸摄影，不强行归入高山 pressure 云海或暗夜保护地。
- 高原点保留道路、落石、高反、船期、潮汐和景区开放提示；不承诺夜爬、夜宿或现场可见性。
- Bortle 仅为目录参考筛选/着色；实时天气、pressure、暗空栅格仍按现有数据源门禁执行。
- CloudSea 继续使用既有 6 层完整性、严格多数、逆温仅展示不加分和 Phase 2 未实施契约。

## 验证与回滚

- 回归覆盖：ID/坐标/海拔/字段、252 条通用目录、54 条 CloudSea、默认 10 条精选，以及现有 242→252 计数夹具同步。
- 计划运行：`npm ci`、`npm run check`、`npm run test:live`、本地 Chromium E2E、CI 五项门禁和生产四页面验收。
- 回滚目标：`5900bd8f01a17dddf52dafe1a22d4d382ae02b81`。
