# 三类摄影评分与数据来源加固接力

Jovi已授权本轮修复、完整验证、提交、部署和正式网页验收；工作目录为原始 `E:/project/Star_photo_addr`。不删除原报告，不重置或清理Owner工作。此文覆盖接力所需五点，历史过程见原报告，不重复复盘。

## 目标与已完成

目标是让星空、云海、晚霞条件指数使用正确地点、模型、单位、有效时间及完整性门槛，显示与计算同一口径；工程门禁全过后按精确提交发布并检查真实网页。

已证实并修复的实现问题：

- 云海：检查包裹山顶的所有云层，避免只看最低层；覆盖率按完整目标小时计，窗口不足不发布均分；均分和最佳单小时分分开显示，缺均分仍保留可用事实。原同输入反例94云上→21云中、31均分/98峰值、1/4覆盖不再伪装1/1。
- 星空：晴天白昼的原85分不再成为星空推荐。太阳高度≥−12°最高39，−18°至−12°最高69，并明确天文阻断；完整暗夜原权重保留。窗口外暮光不否决合法暗夜窗口，全夜天气风险仍保留。候选缓存与请求坐标绑定。
- 晚霞：全天按实际太阳升降方向分晨晚相，不再限北京时间15–20/4–9；赛里木湖夏季23:00样本恢复。实际72分显示60–80而非80–88；页面、标记、图例和连续色场共用分段。带秒时间正常解析，非法日期/数值不出分。
- 来源：上游逐字段声明单位与数值范围必须通过校验，时间单位匹配epoch/ISO；固定北京时间的产品核验时区身份；压力层只统计合法、唯一完整层。新源校验版本为 `open-meteo-hourly-v1`；旧已评分缓存不能冒充本轮新计算，文件保留。
- 发布基础：reports从源码扫描与运行包追踪排除，176个原产品源码仍接受检查；没有忽略源码错误。Next/ESLint升级16.4.3，两个大包从官方npm下载并验证SHA-512，生产audit0。原59个报告文件截至本次核对均字节/哈希不变。

天文边界参考[USNO](https://aa.usno.navy.mil/faq/RST_defs)，来源单位及高度基准参考[Open-Meteo官方文档](https://open-meteo.com/en/docs)。39/69封顶是保守产品门槛，不是拟合得到的概率；云层和太阳光照权重仍为条件指数。模式地形与真实山顶存在差异，压力高度是海拔MSL，不能当实测云底。

## 发布前验证状态

原样完整 `npm run check` 退出0：lint、TypeScript、106文件649测试、Next16.4.3生产构建全部通过；最新production audit0。完整离线Chromium287PASS/131适用SKIP/0FAIL，Firefox/WebKit12PASS，均有退出0回执。最后非法observer输入防御在完整浏览器之后补入，已通过RED/GREEN及完整check；精确提交的托管CI和新镜像隔离验收仍为发布前门禁。原报告59文件哈希一致。

首次全仓与浏览器失败日志完整保留。旧raw事实保持只读stale，禁止用于推荐；模拟接口补请求坐标以遵守真实接口合同，不放松产品门禁。低分标签对比度修复；地图测试点击真实选中SVG点，未延长时限或跳过失败断言。新截图只写本次测试输出目录，原截图不覆盖。

生产仍是7a2202c，尚未提交/部署本轮候选。真实实拍两案例仍缺地点、精确有效时刻及当时保存预报，不声称已完成科学概率校准。工程验证证明代码执行规则及输入合同，不能保证天气每次命中；后续须保存固定起报输入与独立观测标签，按地点/季节/提前量留出验证，不能用事后更新预报替代。

## 关键文件与证据

算法：`src/lib/hourScore.ts`、`scoring.ts`、`candidateNightEvidence.ts`、`cloudsea.ts`、`cloudseaWindowSelection.ts`、`fireglow.ts`、`fireglowOverlay.ts`。

来源：`providerWeatherIntegrity.ts`、`forecast.ts`、`forecastIntegrity.ts`、`stargazingFinderWeather.ts`、`pressure.ts`、`pressureIntegrity.ts`及三类snapshot/forecast routes。界面：`StarWindowTable.tsx`、`CloudSeaApp.tsx`、`CloudSeaSiteDetail.tsx`、`CloudSeaWindowEvidence.tsx`、`FireglowApp.tsx`。

回归在tests/unit、tests/integration、tests/e2e对应文件；原始证据保留于 `reports/cloudsea-calibration-20261023/`、`reports/cloudsea-release-20261023/`。先前报告 `CLOUDSEA_CALIBRATION_AUDIT_20261023.md` 保留，不覆盖为新结论。

## 下一步执行

1. 收束新门槛与旧事实只读合同，原样完整check、生产audit、完整生产包离线Chromium及跨浏览器；独立复核最后差异。
2. 核对远端ref/原报告哈希，只提交明确代码、测试和接力文档；安全合入main，记录精确SHA。
3. 精确SHA和当前公开配置本地构建；Linux原生库版本匹配，隔离镜像预检；配置/原卷备份及回滚就绪后切换app和worker。
4. 正式HTTPS实际版本、三类真实数据与可回算值、桌面/手机页面验收。429停止扩展请求，保留未运行标签，不强刷或编造观测。

Hub本次revision仍连接拒绝，旧失败草案保留，未成功上报，不自动重试。该状态不改变项目目标或发布权限。普通ChatGPT安全连接已通过校验；仅保留确认死亡的本项目旧运行记录并恢复本项目连接，没有停止其他项目进程或更改公开地址。原普通网页会话已恢复；完整阶段合同见 `docs/HANDOFF_SCORING_FULL_STAGE_20261024.md`。
