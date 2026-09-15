# 开源借鉴核查（2026-09-15）

本轮没有新增 npm/Python 生产依赖，也没有复制 AGPL/GPL 项目的源码。

| 来源 | 已核对的能力与许可 | 与逐星的关系 | 本轮采用范围 |
|---|---|---|---|
| https://github.com/sindresorhus/p-queue | Promise 并发队列、intervalCap、限流/背压；MIT | 区分同时请求数与时间窗口请求预算，队列失败要显式收口 | 借鉴队列/背压思想，使用本项目小型入口控制器；未宣称已经安装 p-queue 或完成加权滑动窗口预算 |
| https://github.com/open-meteo/open-meteo | 多模式天气服务，可自托管；服务端 AGPLv3，天气数据 CC BY 4.0 | 核查变量能力、模型身份、缓存/导入方式；后续高用量可评估受控数据服务 | 阅读文档与仓库说明；未复制服务端代码，未搭建自托管服务 |
| https://github.com/Unidata/MetPy | Python 气象读取、计算、可视化；BSD-3-Clause；依赖 Pint/Xarray 等 | 后续做带单位的垂直剖面离线交叉验证与校准工具 | 研究候选，未加入当前生产；不能把其计算结果当现场实测 |
| https://github.com/mawinkler/astroweather | Home Assistant 天文条件集成；使用 Met.no/Open-Meteo；GPL-3.0 | 参考地点、时区、更新间隔、天文条件与数据获取层的职责分离 | 仅结构参考；未复制 GPL 源码，未引入混合模型补值 |

## 模型与额度的一手依据

- ICON：https://open-meteo.com/en/docs/dwd-api 。官方说明 visibility 不适用于 ICON Global；区域模式能力不能不加区分地外推到全球。
- GFS：https://open-meteo.com/en/docs/gfs-api 。文档包含 visibility。最终仍以实际响应逐小时完整性为准，不能以变量在文档中存在替代数据验收。
- 计费/额度：https://open-meteo.com/en/pricing 。客户 API 需要对应的 customer endpoint 和授权 key；只往匿名域名追加 key 不是已验证的恢复方案。超过 10 变量等请求按多次调用计算，不能将 HTTP 批次数等同额度成本。

## 先后顺序

当前先恢复模型/字段/健康探针一致性并稳定请求。之后统计真实上游用量，再选择保留轻量队列、引入 p-queue 的严格时间窗口限制，或独立服务做全局预算。没有额度预算前不扩大专题预热，不为“更准”同时抓满 282 点 × 多模型。

Perseids 参考站 https://perseids.giraffetree.cn/ 是用户给定的产品流程参考；本轮未核实其源码仓库与许可，不把网页可访问当成代码可直接复制的授权。
