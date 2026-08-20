# 《逐星》测试方案 V1.0：第一批执行记录

> 分支：`test/quality-foundation-v1-20260820`  
> 基线：`main@18e03cdf82f0e3154664a4e96543f0a45e81444d`  
> 已验证功能 HEAD：`ac55dde8b110073f27d1d2f9ed668cf87275d342`  
> 最终功能验证：GitHub Actions Run `#112`（ID `32363556827`）  
> 状态：**PASS**

## 1. 已实施

1. Vitest 纳入 `tests/contract` 与 `tests/integration`；
2. Open-Meteo 云量契约 Fixture：正常、错位、全空、混入字符串、非法时间；
3. forecast 路由：空/错位/越界坐标、非法模型、真实 `(0,0)`、模型时效、同 key 并发、强刷冷却、stale 回退；
4. data-status 路由：memory/coalesced/refresh-cooldown 响应头；
5. RefreshCoordinator：同 key Promise 合并、key 隔离、Retry-After；
6. 生产服务 API 边界：forecast、AQI、pressure、satellite 的 400 与 no-store；
7. 浏览器故障注入：强制云量刷新 503 时保留旧 Canvas 和降级提示；
8. 键盘与焦点：Dialog 初始焦点、Shift+Tab 循环、Esc 与焦点回归；
9. Firefox Desktop 与 WebKit iPhone 13 核心冒烟；
10. Playwright HTML、trace、video、screenshot 失败产物上传。

## 2. 最终结果

| 检查 | 结果 |
| --- | ---: |
| production dependency audit | PASS |
| ESLint | PASS |
| TypeScript | PASS |
| Vitest | 28 files / 186 tests PASS |
| Next.js production build | PASS |
| live-data smoke | PASS |
| Compose / Nginx / image / container health | PASS |
| Chromium Desktop + Mobile | 54 PASS / 2 SKIP / 0 FAIL |
| Firefox Desktop | 2 PASS |
| WebKit iPhone 13 | 2 PASS |

失败证据由 CI 上传并保留 7 天：

- `playwright-chromium-32363556827`；
- `playwright-cross-browser-32363556827`。

## 3. 测试驱动发现的 Bug

### 3.1 Open-Meteo 云层契约过宽

`validateRawForecast()` 原先只要求数组中出现一个有限数字，未拒绝字符串、Infinity 或其他非法元素。现要求：

```text
数组长度 = 时间轴长度
+ 每项只能为 null 或有限数字
+ 至少一项为有限数字
+ 时间值符合本地 ISO 墙钟格式
```

### 3.2 Playwright 跨浏览器项目被错误合并

首次跨浏览器 CI 使用 `defineConfig(baseConfig, override)`，Playwright 将基础 Chromium 项目和 Firefox/WebKit 项目合并；该 Job 未安装 Chromium，因此失败。改为展开基础配置并显式替换 `projects` 后，Firefox/WebKit 4 项全部通过。

### 3.3 移动端刷新错误被后续缓存请求掩盖

Chromium 移动端故障注入先后两次揭示：

1. 同一上下文/边界会在强刷失败后被非强刷请求重新尝试；
2. 更深层根因是布局稳定阶段已排队的旧 `moveend/zoomend` debounce，闭包持有旧 refresh revision。

最终修复同时加入请求签名去重和人工刷新时取消旧 debounce。Run #112 中桌面/移动端故障注入均通过。

## 4. CI 演进记录

| Run | 结果 | 发现与处理 |
| --- | --- | --- |
| #109 | FAIL | 跨浏览器项目误包含 Chromium；修复配置合并方式 |
| #110 | FAIL | 移动端 503 提示被同边界非强刷请求掩盖；加入尝试签名 |
| #111 | FAIL | 追踪到旧地图 debounce 持有上一 revision；人工刷新时取消旧定时器 |
| #112 | PASS | quality、live-data、container、Chromium、Firefox、WebKit 全部通过 |

上述失败均作为真实问题处理，没有通过删除测试、延长等待或降低断言规避。

## 5. 本阶段明确跳过

- 真机 Safari / Android；
- 阿里云大陆 ECS 出口与正式 TLS；
- k6 与 30 分钟 soak；
- Sentry、Web Vitals；
- axe、像素视觉基线、Lighthouse、覆盖率门槛；
- Bortle/SQM 科学真值校准。

具体原因和后续执行方式以 [`TEST_STATUS.md`](./TEST_STATUS.md) 为准。

## 6. 结论

测试方案 V1.0 第一批可自动执行范围已经完成并通过。该结果证明当前分支在既有 Chromium 全量流程之外，新增的天气契约、路由集成、刷新故障、键盘焦点及 Firefox/WebKit 核心流程均达到合并门禁；它不替代真机、阿里云、压力、长期运行或科学真值验证。
