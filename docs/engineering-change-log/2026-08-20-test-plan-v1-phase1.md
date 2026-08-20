# 工程修改跟踪：《逐星》测试方案 V1.0 第一批实施

> 文档编号：`ENG-CHANGE-2026-08-20-TEST-V1-PHASE1`  
> 基线：`main@18e03cdf82f0e3154664a4e96543f0a45e81444d`  
> 分支：`test/quality-foundation-v1-20260820`  
> 已验证功能 HEAD：`ac55dde8b110073f27d1d2f9ed668cf87275d342`  
> GitHub Actions：Run `#112` / ID `32363556827` / **PASS**

## 1. 目标

把测试计划中当前环境可执行的契约、API 集成、刷新故障、键盘焦点、跨浏览器和 CI 诊断能力落地；需要真机、阿里云、商业服务或新依赖的项目继续保留在待测试文档中。

## 2. 代码与测试变化

- `forecast.ts` 加强必需云层和时间轴运行时校验；
- Vitest 增加 contract/integration 目录；
- package scripts 增加 contract、integration、cross-browser；
- 新增 forecast/data-status 直接路由集成测试；
- 新增 RefreshCoordinator 单元测试；
- 新增生产 API 边界、云量 503、键盘焦点、Firefox/WebKit E2E；
- Playwright 保留失败 trace/video/screenshot 并生成 HTML 报告；
- CI 增加 cross-browser-smoke 和 artifact 上传；
- `CloudLayer` 增加请求签名去重，并在人工刷新时清理旧地图 debounce；
- 更新测试状态、执行记录、跳过边界和精确 CI 数量。

## 3. 发现并修复

### 3.1 云层数据契约错误

Open-Meteo 云量数组混入非法元素时仍可能被接受。数据契约现收紧为等长、元素合法、至少一个有限值及合法时间轴，并新增固定 Fixture 回归。

### 3.2 跨浏览器 CI 配置错误

Playwright 配置对象合并会拼接项目数组，导致 Firefox/WebKit Job 意外执行 Chromium。现改为显式替换项目列表。

### 3.3 移动端刷新竞态

强制刷新失败后，旧地图事件的 debounce 会执行非强刷请求并隐藏错误状态。现取消旧定时器、阻止同签名重复请求，并保留旧 Canvas 和 stale/degraded 提示。

### 3.4 依赖纠偏

首次提交误改 `tw-animate-css` 版本，已恢复为 lockfile 对应的 `^1.4.0`，最终分支没有依赖漂移。

## 4. 最终验证

- audit、lint、TypeScript、production build：PASS；
- Vitest：28 files / 186 tests PASS；
- live-data smoke：PASS；
- Compose、Nginx、production image、`/healthz`：PASS；
- Chromium Desktop/Mobile：54 PASS / 2 SKIP / 0 FAIL；
- Firefox Desktop + WebKit iPhone 13：4 PASS / 0 FAIL。

CI 修复过程为 Run #109～#111，最终 Run #112 全绿。失败没有通过删除测试或弱化断言处理。

## 5. 风险边界

- 不修改评分公式、缓存时长、地图数据或科学口径；
- WebKit 自动化不等于 iPhone 真机验收；
- 不在没有授权栅格和现场校准的情况下测试 Bortle/SQM 真值；
- 跨浏览器只运行核心冒烟，不替代 Chromium 全量 E2E；
- 阿里云出口、TLS、压力、长期运行、性能、视觉基线和外部可观测性仍按 `TEST_STATUS.md` 执行。

## 6. 回滚

业务代码改动限于天气输入校验和云量刷新竞态修复；其余为测试、CI 与文档。可按提交回滚，不影响观测快照数据卷。
