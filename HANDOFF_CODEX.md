# Codex 续作交付单

当前版本不是空壳：实时天气、天文计算、评分、云高、7/14 天切换、点位管理、浏览器缓存、构建和测试均已完成。Codex 应先验证，不要重写界面或更换评分口径。

## 唯一必做（当前环境无法完成）

在装有 Docker 的目标机执行：

```bash
docker compose up --build -d
curl -fsS http://127.0.0.1:8080/healthz
```

然后用桌面和手机浏览器检查首页、14 天切换、对比矩阵、点位页、自定义点位表单、逐小时详情和云层剖面。若浏览器直连 Open‑Meteo 被地区网络或 CORS 阻断，再实施下面的生产增强。

## 生产增强任务

1. 新增同域 `/api/forecast` 代理，不把第三方密钥放前端；Open‑Meteo 作为默认提供商，接口保持现有规范化字段。
2. Redis 缓存键包含提供商、模型时次、经纬度、变量集和预报范围；短临 30–60 分钟、远期 2–3 小时。
3. Postgres 保存 `forecast_snapshot`、`decision_snapshot`、`field_report`、`score_model_version`。
4. 增加定时刷新、超时/重试/熔断、上一版数据回退、更新时间与数据年龄告警。
5. 生产许可要求确定后，可增加 CMA/QWeather 适配器；不要在没有垂直层数据时伪造云底/云顶。
6. 增加登录、关注点位、出发提醒、现场反馈和模型校准面板。

## 可直接粘贴给 Codex 的提示词

```text
你接手目录 star-weather-planner。先完整阅读 README.md、HANDOFF_CODEX.md、父目录的《星空摄影天气决策网页_整体方案与Codex执行提示词.md》和 AGENTS.md。

这是已经可运行的 React/Vite 星空摄影天气决策网页，不要重写现有 UI，不要改变 12 个预置点位，不要把“云海潜力”混进“星空评分”，不要删除 Open-Meteo/Astronomy Engine 署名。先执行 npm ci、npm test、npm run test:live、npm run build；任何失败先定位并修复。

必做：在本机运行 docker compose up --build -d，验证 /healthz 和 SPA 路由回退；用桌面与手机 viewport 完整走查 7/14 天、星空/云海、对比、点位管理、详情抽屉和压力层云高。修复发现的问题并补回归测试。

如准备公网生产，再实现同域天气代理、Redis 缓存、Postgres 预报/决策快照、定时刷新、监控与回退。保持 src/lib/openMeteo.js 对上层的规范化数据契约，评分模型必须版本化并保持可解释。0–72 小时用于决策，4–7 天用于规划，8–14 天只标趋势。云层高度是气压层估算，必须显示区间和置信度，AGL 永不为负。

完成后交付：变更清单、数据流图、全部测试结果、Docker 验证结果、桌面/手机截图、仍存在的风险和部署步骤。不要声称未实际执行的测试已通过。
```
