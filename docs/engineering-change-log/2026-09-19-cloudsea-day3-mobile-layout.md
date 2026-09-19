# 云海后日数据与移动详情布局修复测试报告

日期：2026-09-19  
范围：云海今日/明日/后日/三日总览、压力层数据、详情卡片移动布局。  
生产状态：报告生成时尚未部署；生产仍为旧 SHA `3334e0c08f9a`。

## 根因与修复

1. 生产基线的详情卡片是受限高度 Flex 列的可收缩子项，垂直剖面卡片又使用 `overflow: hidden`，内容增长后会被压缩、裁切并与下一节形成视觉叠压。待部署响应式提交已把详情卡片设为不可收缩，本轮补上严格几何回归。
2. 页面原来并发请求三天，每天再并发压力批次，易触发上游限流；降级结果还会作为 30 分钟新鲜缓存，后日因此持续显示无数据。
3. 页面没有模型选择器却隐式固定 `icon`。真实对照中，后日 `icon` 与 `aifs` 为 `0/54`，`best_match` 因部分坐标自动选模不完整为 `36/54`，显式 `gfs` 为 `54/54`。云海现明确使用并标记 GFS。

## 逐项数据验证

| 数据/位置 | 自动化检查 | 结果 |
| --- | --- | --- |
| 54 个云海地点 | 响应必须包含目录中的每个稳定 ID | PASS |
| 晨间、傍晚 | 每个地点两个窗口，共 108 个窗口/日期 | PASS |
| 条件指数 | `score`、`conditionLevel`、`conditionLabel` | PASS |
| 兼容字段 | `probabilityLevel`、`probabilityLabel` | PASS |
| 垂直关系 | `cloudPosition`、`positionLabel`、`cloudBaseM`、`cloudTopM`、`altitudeDiffM` | PASS |
| 云量 | `lowCloud`、`midCloud`、`highCloud` | PASS |
| 地面条件 | `humidity`、`windSpeed` | PASS |
| 峰值时次 | `peakTime`、`pressureTime`、`pressureStatus`、`pressureConfidence` | PASS |
| 逆温证据 | `inversion.status` 及可选层高/温差/强度 | PASS |
| 解释文案 | `summary` | PASS |
| 缺失语义 | 压力层不足时保持 null/数据不足，不使用启发式云底伪造 | PASS |
| 降级缓存 | partial/unavailable 不进入新鲜缓存，下一请求会重新拉取 | PASS |
| 限流/卡死 | 429/5xx 退避；单批次 12 秒超时后用新信号重试 | PASS |

## 日期与真实上游

页面按钮现在显示“今日/明日/后日 + 月日 + 星期”，三日总览显示首尾日期。三日请求按日期串行，浏览器测试确认最大日期请求并发为 1。

本机生产构建直连 Open-Meteo GFS 的验证结果：

| 日期 | HTTP | 模型 | 压力地点 | 失败地点 | 结论 |
| --- | ---: | --- | ---: | ---: | --- |
| 2026-09-19 | 200 | gfs | 54/54 | 0 | PASS |
| 2026-09-20 | 200 | gfs | 54/54 | 0 | PASS |
| 2026-09-21 | 200 | gfs | 54/54 | 0 | PASS |

说明：完成两轮本地完整浏览器回归后再次直连时，本机出口触发了 Open-Meteo 小时配额保护，后日返回 `0/54`、HTTP 200 degraded；该次结果按 BLOCKED 记录，不覆盖此前同一最终构建逻辑下的 GFS `54/54` 成功证据。代码保持 `no-store`/fail-closed，未把限流响应写成 PASS；部署后的 ECS 独立出口必须重新核验。

## 布局与遮挡验证

严格检查每个详情主卡片与子卡片：`scrollHeight <= clientHeight`、`scrollWidth <= clientWidth`，相邻主卡片边界不相交。覆盖 320×568、375×812、390×844、430×932、577×1231、768×1024、844×390 横屏和 1280×900；截图中的长“未检测到明确逆温”文案也纳入夹具。

结果：全部 PASS。项目源码没有截图右侧蓝色圆形悬浮按钮对应的组件或脚本，该按钮属于浏览器/宿主注入层；站内布局自身没有固定控件遮盖详情内容。

## 完整门禁

- `npm run check`：PASS；ESLint、TypeScript、59 个测试文件、346 项测试、Next 生产构建全部通过。
- Chromium E2E：PASS；125 passed、41 skipped、0 failed。skip 为项目条件分流，不是失败。
- Firefox + WebKit：PASS；4/4。
- 云海日期/自动重试定向 E2E：PASS。
- 云海详情八尺寸几何回归：PASS。
- 最终本机实时重试：BLOCKED；Open-Meteo 小时配额保护导致后日 `0/54`，不是应用缓存或渲染失败。

## 发布门槛

代码与本地/真实上游门禁通过。提交、推送、部署后仍需核对 exact SHA、app/worker healthy、公网 `/healthz`、公网三天云海接口和网页/手机实机显示；这些在部署完成前不标记为生产 PASS。
