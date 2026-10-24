# 云海算法与数据校准审查 — 2026-10-23

## 结论与当前权限

当前分数是未经实拍概率校准的条件指数。既有测试通过不能排除计算结构缺陷；已用当前源码和epoch-v1合成输入复现94误判、31窗口平均及缺测1/4仍98。三项修复和回归已获Jovi明确授权，现已在本地完成；不部署，不调整经验权重来宣称概率已校准。两次用户实拍尚缺地点/时刻，CASE_REPLAY_BLOCKED；独立实拍校准尚未完成。

## 当前版本核验

| 层次 | 本次核验 |
| --- | --- |
| 原目录 | E:/project/Star_photo_addr，codex/data-boundaries-20261012@f40b84588d2e3d1480e2a1f80a32309075a77eaf |
| GitHub main | cd54bc4a02ae06503e45f6a3a88c04ba9cfeed10，10月9日文档交付 |
| GitHub修复分支 | cc64cde6bb922e8f295ad961eec1c356a69f45e9，10月13日；原目录另有后续本地提交 |
| 正式站点 | health实际200，v1.0.27 / 7a2202ce4b24b2e3ac956ef70e6e9f9f8d97e3a3 |
| 云海核心 | cloudsea.ts、cloudLayers.ts、pressureIntegrity.ts、pressure.ts在审查基线与生产源码无差异；10月12日快照route有数据完整性修复候选 |

普通Git TLS初次失败，以Windows原生TLS完成fetch与服务端ref核对。没有切分支、覆盖Owner未跟踪reports或改变生产。Obsidian项目进度仍记录10月7日，未当成当前版本证据。

## 复现实验

证据：reports/cloudsea-calibration-20261023/synthetic-counterexamples.json。合成机制验证，不是用户实拍还原。压力层使用显式epoch，不依赖旧ISO路径。

| 输入/场景 | 原算法输出 | 判定 |
| --- | --- | --- |
| 机位2200m；云层500–1000m及2000–3000m；低云90%、RH90%、风2.5m/s、雨0.5mm/h | 94/100，云上 | 明确结构缺陷：只选最低deck，忽略包裹机位的第二层 |
| 四小时指数98、8、8、8 | 窗口31，最佳05:00 | 平均条件和“出现过一次”是不同目标；不能将31理解为发生概率 |
| 四目标小时，仅一小时地面关键字段完整 | 98，窗口1/1 | 缺测从分母消失，不能让单小时代表完整窗口 |
| 仅低云由24%变为25%，其余不变 | 16变91 | 经验阈值不连续；后续用实况定标，本批不盲目改权重 |
| 雨30mm/h，其余有利 | 89 | 降水惩罚饱和，摄影条件目标与云海发生需分开定义 |
| 排除地下层后仅4层、仅1有云层 | 98，云层置信低 | 垂直证据稀疏、单层零厚度及云边界不确定性需后续建模 |

定位：cloudsea.ts:266–298选择低层deck；309–432按层位打分；457–589窗口筛选/平均/peak；cloudLayers.ts:17–64从压力面推导云层；pressureIntegrity.ts:12–17完整层数计数。MSL云高和机位MSL比较本身未发现直接AGL/MSL混用。

原测试5文件44项PASS（本轮实际执行，日志在reports/cloudsea-calibration-20261023/focused-tests.log），但没有覆盖上述反例。修复验收将另记RED/GREEN，不把原PASS算作新修复通过。

## 历史追溯与数据能力实测

- 只读查询昨日2026-10-22、gfs云海缓存：429 cache-only-miss，未refresh或触发供应商。源码快照仅内存Map，TTL30分钟，降级缓存上限6小时；未发现云海预测输入长期留存。不能假装恢复了用户昨日看到的分数。
- NOAA Himawari9公开桶根目录及10月22日文件目录实际HTTP200；列出AHI-L1b-FLDK/2026/10/22/0000/HS_H09_20261022_0000_B01_FLDK_R10_S0110.DAT.bz2，3,630,908字节，仅核查元数据，未下载影像。B01原始通道不是云顶/雾判识成品。
- NOAA IGRA站目录实际HTTP200，260,950字节，下载至E:/Claude_allow/Download/igra2-station-list-20261023.txt；240条中国前缀记录，89条结束年份2026，不代表89个站此刻在线。附近探空只能验证区域温湿/逆温结构，不能替代机位是否看见云海。
- Open-Meteo Single Runs实际HTTP200：公开目录示例上虞覆卮山，gfs_seamless、UTC起报2026-10-21T00:00，地面及10压力层，48小时、13,092字节。原始文件E:/Claude_allow/Download/starphoto-single-run-example-20261021-gfs.json，SHA256 88208d4c95e68a02cade14fc6a4b63a895979c0ce1f49d6e4cdf4e42c54961b6。
- 该样例机位861m、供应商地形194m，差667m；审查基线公式（修复前）对22日晨间算8/100。没有该点实拍标签，不能说8分对错，也不能猜它是用户地点。样例仅证明固定起报数据可读取并能接入当前解析链。

## 可借鉴的公开项目与数据

| 来源 | 适用用途 | 明确限制 |
| --- | --- | --- |
| [FogPy](https://github.com/pytroll/fogpy) | 雾/低层层云判识研究，GPL-3.0 | 基于卫星算法，不能直接视为中国山地云海概率模型；AHI通道/地形/许可需核对 |
| [Satpy](https://satpy.readthedocs.io/en/stable/) | 葵花AHI多通道读取、配准、投影；当前仓库Apache-2.0 | 是处理工具，不自带机位云海预测真值 |
| [MetPy LCL](https://unidata.github.io/MetPy/latest/api/generated/metpy.calc.lcl.html) | 物理计算对照、气块热力学，BSD-3-Clause | LCL不是所有云的实际云底，更不能从一个LCL猜出云顶 |
| [Himawari公开数据](https://registry.opendata.aws/noaa-himawari/) | 东亚实况多光谱及历史核验；无AWS账户可读 | 原始L1需处理，多层遮挡会隐藏低云；署名来源，按区域时段取数 |
| [IGRA探空](https://www.ncei.noaa.gov/products/weather-balloon/integrated-global-radiosonde-archive) | 温湿、位势高度、风与逆温核验 | 距机位有距离，放球时间不一定是拍摄时刻 |
| [Single Runs](https://open-meteo.com/en/docs/single-runs-api) / [Previous Runs](https://open-meteo.com/en/docs/previous-runs-api) | 固定起报与提前量回测；本次已验证Single Runs取样 | 起报UTC不等于公众获得时间，必须排除事后泄漏；正式接入核对使用额度/条件 |
| [ERA5压力层](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-pressure-levels?tab=overview) | 历史环境和剖面交叉检查 | 再分析不是当时发布的预测，也不是机位实测；下载账户/访问条件需执行时确认 |
| [NJIAS HCFD](https://essd.copernicus.org/articles/16/1747/2024/) | 东亚云顶/云型等历史研究辅助标签 | 论文公开数据主要2016–2022，不能当成2026年10月22日实况；整库TB级，不全量下载 |

Open-Meteo当前文档列示全球ICON约11km、GFS地面约13km、压力变量约25km；中国峡谷/山脊与模式地形存在代表性差异。来源：[官方历史预报模型表](https://open-meteo.com/en/docs/historical-forecast-api)。当前分数未表达这些误差，不能凭两例重新调权重就称准确。

## 已授权的最小修复

1. cloudsea.ts内检查所有已推导deck是否包裹机位，保持最低低层deck识别，不因其在脚下而忽略第二层云中风险；不改共享云层算法权重。
2. coverage记录expectedHours/surfaceValidHours/scoreableHours/pressureHours，分母是去重目标小时；四小时窗口不足3个可评分时不发布窗口均分。缺测保留原始可用字段与已知单小时事实。
3. 新窗口明确peakScore与peakTime，窗口mean不悄改为max；列表/移动摘要/详情标清“窗口平均”和“最佳时次”，覆盖不足不显示成低概率。
4. 单元与路由/展示回归验证两层云、缺3小时、98/8/8/8、全缺、unknown压力、旧响应无新字段等。只改云海算法/数据结构/呈现与对应测试；不部署。

主要文件：src/lib/cloudsea.ts、src/app/cloudsea/CloudSeaApp.tsx、CloudSeaSiteDetail.tsx及必要小型云海呈现组件；tests/unit/cloudsea*.test.ts和必要云海集成/浏览器回归。保持原分支已有改动及其他产品不受影响。

## 后续真正的校准

- 先分别定义“该时段发生云海”“机位在云上且能看见”“摄影画面质量”；不要把三者合成一个百分数。
- 对每次预测保存不可变发布/抓取时间、起报批次（未知保持null）、坐标/机位海拔/模式地形、有效时刻、模型、算法版本、逐小时输入及缺失掩码；同一天后续更新不可覆盖早期预测。存储需有容量上限，不动旧缓存和备份。
- 两次用户事件先登记为用户报告，需补地点、拍摄时间、查看预报时间/模型和观测状态。高分那次“很多云”尚不能直接标成无云海；低分那次先记自述出现云海。不能将合成反例作为实拍样本。
- 用固定起报、相应提前量数据重算，再与同刻卫星/附近探空/经确认实拍对照；相邻小时/同一次天气事件成组切分训练和独立验证，按站点、季节、提前量统计误报、漏报及覆盖率。
- 先检验指数与事件是否有排序能力；标签足够后再评估概率映射（如正则逻辑校准/等渗），用独立样本的Brier、可靠性分箱与置信区间验收。当前没有训练/拟合或宣称新命中率。

状态：IMPLEMENTATION_AUTHORIZED；FIELD_CASE_REPLAY与PROBABILITY_CALIBRATION尚未完成。Hub revision本次WinError10061，未上报，不自动重试。业务修复验证结果追加于本文，工程测试与科学校准分别记账。

## 授权修复结果

同一组epoch-v1输入，分别加载Git基线f40b845和当前工作区公式运行（未切换文件/分支）：

| 场景 | 修复前 | 修复后 |
| --- | --- | --- |
| 第二层云包裹2200m机位 | 94，云上 | 21，云中；使用2000–3000m包裹层 |
| 仅一小时有利 | 平均31，未独立输出峰值 | 平均仍31，另列05:00峰值98；不改变指标定义 |
| 四小时仅一小时有效 | 均分98，1/1 | 均分null，覆盖1/4；保留单小时峰值98及层位 |

结果：reports/cloudsea-calibration-20261023/before-after.json。合成反例只证明这三项机制修复，不证明用户实拍命中率。

独立复核还发现并关闭两条呈现链遗漏：无均分窗口在三日窗口选择时丢失峰值/日期；地图Popup仍混用平均分与最佳层位。现在窗口均分优先，无均分时保留最佳已知小时及对应日期；未知均分不参与分数排行或色面插值。移动/桌面详情、排行、弹框分别标明平均/最佳/覆盖；旧响应缺新字段时显示覆盖未知，不造数字。

### 验证边界

- 完整Vitest：103文件602项PASS；包含多层云、低云偏少但机位被包裹、缺测、重复小时、三日选择及SSR展示回归。
- 改动源码ESLint PASS；独立复核最终无阻断发现；git diff --check PASS。
- 四个云海浏览器套件在本地Next dev + 离线供应商夹具运行：16PASS、14设备适用跳过、0FAIL，含日期请求顺序/第三日、地图弹框、窗口平均/峰值、1/4覆盖和移动无横溢。截图文件名带fixture，黑色底图为离线占位，不能当作真实天气/影像证据。
- 初轮新增浏览器用例错误复用了仅手机有的搜索框，已按桌面支持的带身份链接进入；未知SVG点位中心被邻近点/地图截获的多余点击检查移除，关键数据选择由单元、三日日期和详情回归验证，Popup的均分/峰值通过真实点击验证。原失败日志/上下文保留，未延长时限或force-click。
- canonical npm run lint/typecheck失败于原有Owner reports/closeout-20261013诊断文件。npm run build实际完成优化代码编译，但同样被这些文件的类型错误阻断，整体不是PASS。
- 辅助类型检查仅在内存排除原错误日志列出的6份Owner文件，严格检查其余346文件0错误。未修改tsconfig/ESLint规则，未删除或搬走Owner材料；辅助结果不冒充canonical通过。
- 未提交/推送本轮修改，未部署；正式站点仍为7a2202c。原分支及Owner未跟踪报告保留。

后续实拍概率校准仍需要现场事件标签及固定起报对照；本轮没有更改经验权重、安装卫星处理依赖、下载整库或训练概率映射。已准备field-event-intake.csv，未知地点/时间保持空值，不猜用户机位。
