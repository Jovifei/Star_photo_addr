# 504px现网复核与修复要求

现网版本378161f；本地授权分支53432cf基础，Owner笔记保留。此记录为2026-10-07实际网页与缓存响应核查，非fixtures、非整站验收。

## 布局实测

右侧实际视口504×1244，无整页横向溢出。首页地图560px、数据摘要95px、half正文368px且内容1285px，正文overflow:auto；内部滚到scrollTop916时page.scrollY仍0。进入full后才提供完整逐小时/候选内容。仅能滚动不能证明核心数据首屏可见。

火烧云/云海共用同样95px摘要，未选点时下方大块空白；full火烧云包含235个可列点位，正文scrollHeight14139px。云海牛背山full正文4729px、clientHeight834px。需缩短摘要、前置气象事实、一个竖屏文档滚动，长排行分页/渐进展开。工具弹层内部滚动与非模态数据区分开。

## 数据分开判定

- 首页LA ICON：原始抓取2026-10-07T06:52:40.346Z，云量0%、降水0.0mm、风3.8m/s；缺能见度。缺评分输入应暂缓评分，不能隐藏月相/暗夜/银河等独立事实。当前默认仍显示Shanghai Oct7T14，point-local clock缺陷未上线修复。
- Fireglow当前缓存：dateOct7/modelICON/stale=false/generatedAt2026-10-07T06:46:54.88Z。雅安牛背山晚霞score14、低云90%、中云75%、高云0%、最佳19:00。页面有实际数据，不是全部断链。
- Cloudsea缓存：dateOct7/modelGFS/stale=false/generatedAt2026-10-07T06:56:44.714Z；surface54/54、pressure54/54。牛背山晨间score8、湿度92%、风3.7m/s，低云0%所以正确不显示无意义云底/云顶；傍晚云底3150m、云顶5850m、山顶在云层内。
- 两专题响应没有顶层sourceFetchedAt/fetchedAt。generatedAt是派生快照生成时间，不能自动作为原始供应商抓取时间或预测准确率证据。需逐数据链保留原始来源时间与模型身份，核对缺失/过期/部分覆盖。
- 检查前服务器未见weather-quota-cooldown-v1.json；本轮未强制刷新、删缓存或改网络。

## 点位身份阻塞

同名牛背山：fireglow finder-147-location29.782/102.582/3666m；cloudsea cs-niubeishan29.742/102.325/3660m；default候选niubeishan29.761/102.617/3660m。前两者约25km。未提供逐点坐标系/来源精度，不能猜哪个正确或称已确认坐标系转换。

NavTabs fireglow/cloudsea裸路径，不携带当前点位；两页本地selectedId/pickedPoint并非共享点位上下文。需传递canonical point identity/原始坐标/机位/来源，未确认的冲突点明确位置待核验，禁止按名称替换或把另一点的山顶海拔拼接到天气建议。

雅安市政府与四川省政府公开资料确认牛背山位于荥经与泸定交界，但本轮未获得足以确认精确山顶坐标的权威依据。参考 https://www.yaan.gov.cn/mob/article.aspx?id=329181b0-67df-4d86-8beb-89ef26566daa 与 https://www.sc.gov.cn/10462/10464/11716/11718/2015/12/29/10363667.shtml 。不能据此直接修改经纬度。

## 执行顺序

1. 修复T1显式clock ownership与候选日期交接回归（T1_REVIEW_CHANGES_REQUIRED_20261007.md）。
2. 手机紧凑密度、单滚动、A1独立天文/气象事实；保留评分可信门禁与模型分离。
3. 跨入口共享点位及目录冲突追踪，原始供应商时间继承。
4. 本地精确SHA定向/完整/浏览器和真机验收，再按备份回滚条件发布新候选。实际建议不能假称远端代码已执行；DraftPR49不等于交付。
