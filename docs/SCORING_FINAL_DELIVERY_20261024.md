# 逐星三类摄影评分：正式网页交付

Jovi，本轮工程修复、远端完整阶段接收、合并、部署及正式网页验收已完成。工作目录始终为原始 `E:/project/Star_photo_addr`，原报告保留。

## 1. 当前最终目标

星空、云海、晚霞条件指数使用可信的模型、坐标、单位和时间；缺测/过期不假装可用；页面所示分数与实际聚合一致。正式入口：[今夜观测](https://photo.joviluma.com/?model=gfs)、[高山云海](https://photo.joviluma.com/cloudsea?model=gfs)、[晨晚霞](https://photo.joviluma.com/fireglow?model=gfs)。

## 2. 已完成与可见效果

- 星空：白天和暮光不再因晴天取得高推荐分；保留合法暗夜权重、连续窗口与全夜天气风险；非法 observer 输入暂缓评分，候选缓存按请求坐标绑定。
- 云海：多层云包裹检查、完整目标小时分母、均分与最佳单小时分开、跨日输入隔离；新鲜但部分缺测不误称旧数据；缺席来源与坏采集时间分开。
- 晚霞：按实际太阳升降方向计算晨晚相，覆盖西部晚日落/东部早日出；显示区间与实际分数、地图色阶/图例一致；带秒时间和非法数值防御。
- 来源：严格校验声明单位、数值范围、时间轴、时区和合法网格坐标；批量压力核验上海偏移及目标日 epoch，至少六个合法唯一完整层；旧事实只读降级，不伪装新评分。Next16.4.3，生产依赖审计0漏洞。

当前公开 GFS 太子尖示例：晨间四小时为23/23/23/23，均分23、山顶云中；傍晚为24/23/98，均分48，最佳19:00为98、模式云顶1000m、机位1558m。它说明整段参考与最佳时次的差别，**不是48%或98%的发生概率**。

## 3. 版本、验证与剩余门槛

运行源码：`bce9940ae630823c6e12252af9020ccd73d010cd`。已合并的[PR #57](https://github.com/Jovifei/Star_photo_addr/pull/57)代码合并提交：`864e5507c7b49e4a7235ba2adf175bf503250b58`，树与验收候选相同：`5c52da0919f05bd50b956648fabeabe80a501a88`。后续仅文档提交不改变运行代码；不要把文档tip冒称部署SHA。

- 本地全仓check通过：107文件657项测试、lint、TypeScript和生产构建；完整Chromium290PASS/134适用SKIP，Firefox/WebKit12PASS。
- [精确候选CI](https://github.com/Jovifei/Star_photo_addr/actions/runs/40061516950)五项SUCCESS。原失败测试仅把错误的泛化文案改为明确要求“不发布推荐”；过期、withheld、无旧94分和地图degraded断言都保留。
- 正式HTTPS `/healthz`返回运行SHA；app/worker同镜像且healthy；首页/晚霞/云海三HTML与包体逐字节哈希一致。
- 真实GFS：54个云海地点地面/压力数据均可用，93个窗口出分、15个因条件不足暂缓。独立Python从四份真实供应商响应重建54地点108窗口，均分、峰值、最佳时次、层位与正式接口0差异。
- 星空真实GFS72小时输入回放通过；晚霞282地点来源时间与453个出分窗口的区间已校验。最终晚霞探针保留了较早采集时间并标`stale=true`：重新生成快照不会变成新采集，**不宣称所有上游数据始终新鲜**。
- 正式桌面、移动视口和选点/时段交互已检查；移动视口不等于真机。真机、读屏器及统计预报命中率未验收。

原59个报告文件最终哈希均未变。原数据卷保留，配置及57,389,485字节一致备份已留存并验证；备份SHA256 `5b3e919236f2079d5e4bb21ba6d3495d8036dececcb8d42b7f88755aa8d00619`，回滚镜像`star-photo-addr:rollback-before-bce9940ae630`。发布连接结束时本地回执未收齐，未盲目重跑；随后独立核实服务器完成标记、双服务healthy、正式HTTPS版本和三页面哈希。

## 4. 关键文件与证据

算法/入口：`src/lib/{scoring,hourScore,cloudsea,fireglow,providerWeatherIntegrity,forecastIntegrity,pressure}.ts`及三类snapshot routes。接收审计：`docs/audits/SCORING_PRESSURE_BATCH_IDENTITY_C5_20261024.md`、`SCORING_COMBINED_ACCEPTANCE_20261024.md`；完整实测清单：[交付证据JSON](evidence/SCORING_FINAL_DELIVERY_20261024.json)。

本地原始日志/截图/回算：`reports/scoring-final-delivery-20261024/`，前轮原证据继续保留在`reports/cloudsea-calibration-20261023/`和`reports/cloudsea-release-20261023/`。真实数据包只下载到批准的E盘下载目录；私有配置和数据备份留在服务器私有目录，未上传GitHub。

远端使用同一“逐星”Project的普通ChatGPT，完成完整审查、C1–C5实施、GitHub提交与CI核验；本地接收后独立复核并发布。没有新建Codex Cloud替代。本次Hub新交付事件revision读取仍连接拒绝，未成功上报；待发草案在`reports/scoring-final-delivery-20261024/hub-unsent-final.json`，不自动重试，也不改项目目标/门禁。

## 5. 下一步应该做什么

工程修复已交付。下一项是有独立标签的现场事件回放：需要Jovi两次实拍的地点、有效拍摄时间、当时看到的原预报及独立现场标签，再按地点/季节/提前量做留出验证。固定公开GFS模型输入不冒充实拍；不凭两次模糊描述拟合概率，不自动引入付费源或新架构。

**已验证的是实现、数据处理和显示链路。天气预报仍有模型/地形/时间误差，不能承诺每次现场命中或把条件指数说成已校准概率。**
