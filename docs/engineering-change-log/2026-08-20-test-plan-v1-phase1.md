# 工程修改跟踪：《逐星》测试方案 V1.0 第一批实施

> 文档编号：`ENG-CHANGE-2026-08-20-TEST-V1-PHASE1`  
> 基线：`main@18e03cdf82f0e3154664a4e96543f0a45e81444d`  
> 分支：`test/quality-foundation-v1-20260820`

## 目标

把测试计划中当前环境可执行的契约、API 集成、刷新故障、键盘焦点、跨浏览器和 CI 诊断能力落地；需要真机、阿里云、商业服务或新依赖的项目保留在待测试文档中。

## 代码与测试变化

- `forecast.ts` 加强必需云层和时间轴运行时校验；
- Vitest 增加 contract/integration 目录；
- package scripts 增加 contract、integration、cross-browser；
- 新增 forecast/data-status 直接路由集成测试；
- 新增 RefreshCoordinator 单元测试；
- 新增 API 生产边界、云量 503、键盘焦点、Firefox/WebKit E2E；
- Playwright 保留失败 trace/video/screenshot 并生成 HTML 报告；
- CI 增加 cross-browser-smoke 和 artifact 上传；
- 更新测试状态、执行记录和跳过边界。

## 发现并修复

Open-Meteo 云量数组混入非法元素时仍可能被接受。本次将数据契约收紧为等长、元素合法且至少有一个有限值，并新增 Fixture 回归。

## 风险边界

- 不修改评分公式、缓存时长、地图数据或科学口径；
- WebKit 自动化不等于 iPhone 真机验收；
- 不在没有授权栅格和现场校准的情况下测试 Bortle/SQM 真值；
- 跨浏览器只运行核心冒烟，不替代 Chromium 全量 E2E。

## 回滚

业务代码改动仅限天气输入校验；其余为测试、CI 与文档。可按提交回滚，不影响快照数据卷。
