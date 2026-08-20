# 《逐星》测试方案 V1.0：第一批执行记录

> 分支：`test/quality-foundation-v1-20260820`  
> 基线：`main@18e03cdf82f0e3154664a4e96543f0a45e81444d`  
> 状态：已实现，等待 GitHub Actions 完整验证

## 已实施

1. Vitest 纳入 `tests/contract` 与 `tests/integration`；
2. Open-Meteo 云量契约 Fixture：正常、错位、全空、混入字符串、非法时间；
3. forecast 路由：空/错位/越界坐标、非法模型、真实 `(0,0)`、模型时效、同 key 并发、强刷冷却、stale 回退；
4. data-status 路由：memory/coalesced/refresh-cooldown 响应头；
5. RefreshCoordinator：同 key Promise 合并、key 隔离、Retry-After；
6. 生产服务 API 边界：forecast、AQI、pressure、satellite 的 400 与 no-store；
7. 浏览器故障注入：强制云量刷新 503 时保留旧 Canvas；
8. 键盘与焦点：Dialog 初始焦点、Shift+Tab 循环、Esc 与焦点回归；
9. Firefox Desktop 与 WebKit iPhone 核心冒烟；
10. Playwright HTML、trace、video、screenshot 失败产物上传。

## 发现的运行 Bug

`validateRawForecast()` 原先只要求必需云层数组中至少出现一个有限数字，没有拒绝同一数组里的字符串、Infinity 或其他非法值。异常响应可能通过服务端校验后进入 UI。现已改为：

```text
数组长度 = 时间轴长度
+ 每项只能为 null 或有限数字
+ 至少一项为有限数字
```

同时增加逐小时时间值的 ISO 本地墙钟格式检查。

## 本阶段明确跳过

- 真机 Safari/Android；
- 阿里云大陆 ECS 出口与正式 TLS；
- k6 与 30 分钟 soak；
- Sentry、Web Vitals；
- axe、像素视觉基线、Lighthouse、覆盖率门槛；
- Bortle/SQM 科学真值校准。

跳过原因和后续方式以 [`TEST_STATUS.md`](./TEST_STATUS.md) 为准。

## CI 后回写项

- workflow run 编号；
- unit/contract/integration 数量；
- Chromium desktop/mobile 结果；
- Firefox/WebKit 结果；
- live-data 与 container smoke；
- 失败及修复记录。
