# 工程修改跟踪：v1.0.13 本地点位搜索修复

## 1. 基本信息

- 日期：2026-09-10
- 基线：`main@1f61690e0cba46c59ff1afd79a3562819108508f`（v1.0.12）
- 工作分支：`codex/search-tai-zi-jian-20260910`
- 版本：v1.0.13
- 范围：地点搜索候选来源和回归测试；不改变评分、地图图层、地点目录内容或天气 Provider。

## 2. 根因证据

- 生产 `GET /api/geocode?q=太子尖&count=8&language=zh` 返回空数组。
- 同接口搜索“杭州”返回 2 条，说明输入框、API 路由和远端城市搜索链路本身可用。
- 本地 `src/data/observingSites/catalog.json` 已有 `finder-232-location / 临安太子尖 / 太子尖驿站 / 浙江`。
- `SearchCombobox` 原先只调用 `/api/geocode`；API 只代理 Open-Meteo，未读取本地目录，因此不在远端 GeoNames 覆盖内的山峰必然显示“无匹配结果”。

## 3. 修复方案

- `src/lib/geocode.ts` 新增本地目录文本匹配：名称、区域和省份统一简体化、去空白并做包含匹配，返回目录的稳定坐标、海拔和省份。
- `GET /api/geocode` 优先返回本地命中结果，并添加 `X-Geocode-Source: curated-observing-sites`；没有本地命中时保持原 Open-Meteo 城市搜索和错误语义。
- 本地点位返回负数内部 ID，避免与远端地理编码 ID 冲突；不修改目录主键或用户候选持久化协议。

## 4. 验证

- RED：新增 `searchCuratedPlaces("太子尖")` 测试在实现前失败（`searchCuratedPlaces is not a function`）。
- GREEN：单元/集成 5 项通过；ESLint、TypeScript、`npm run build` 通过。
- 浏览器 E2E：桌面/移动 2/2 通过；在远端地理编码返回空数组时，输入“太子尖”显示“临安太子尖”和“浙江”。
- 已完成 `npm run check`（53 个 Vitest 文件 / 306 项测试）、完整 E2E（112 passed / 34 skipped / 0 failed）、live smoke 和依赖审计；待分支推送、main 合并、生产部署和公网搜索验收。

## 5. 回滚与边界

- 回滚到 v1.0.12 生产代码发布 `main@1f61690`；只需恢复 `geocode.ts` 与 `/api/geocode` 的本地目录优先逻辑，不触碰快照卷。
- 搜索结果是目录/地理编码候选，不等于实时天气或观测结论；地点是否适合出行仍需查看专题评分、道路、景区和现场预警。
