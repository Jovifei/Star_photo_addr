# 工程修改跟踪：v1.0.12 统一控件与专题评分门槛

## 1. 基本信息

- 日期：2026-09-10
- 基线：`main@a66ad049dfd69a87b0f97b5a5870679163260427`（v1.0.11）
- 候选分支：`codex/unified-score-filters-20260910`（已合并）
- main 合并提交：`d64009276db0dbc55cc1963afbc31587703fbc18`
- 版本：v1.0.12
- 范围：首屏筛选控件、主页默认图层、火烧云/云海排行显示和配套测试/文档；不改天气 Provider、评分算法、地点目录或快照协议。

## 2. 用户问题与决策

1. 顶部参数需要一行统一呈现，顺序固定为“评分时间 → B1–B4 暗空参考 → 推荐门槛 → 仅显示推荐地点”。
2. B1–B4 必须同时说明含义和对应推荐分数：B1 极暗 ≥85、B2 自然暗夜 ≥70、B3 乡村夜空 ≥55、B4 乡村/郊区过渡 ≥50。命令栏点击档位时单选该档并同步门槛；地图低频目录面板仍保留组合筛选。
3. 首页默认先回答“未来云况 + 光污染参考”，因此使用 `forecast-cloud` + `combined`；卫星实况和高时序面板只能由用户主动选择。旧的持久化卫星状态在无显式 URL 时迁回默认组合。
4. 火烧云和云海排行各自提供 0–100 分滑块；滑块是评分门槛而非展示数量，列表保留 `score >= threshold` 的地点。`null`、NaN 或数据不足不算达标；地图仍保留未知点位的灰色/虚线语义。

## 3. 实现摘要

- 新增 `src/lib/scoreThreshold.ts` 纯函数和 `src/components/ScoreThresholdControl.tsx` 共用控件。
- 火烧云、云海侧栏接入独立门槛状态、计数、空状态和 0/60/100 测试。
- 顶部 `RecommendationQuickControls`、`BortleFilterBar`、`MapSearchCard` 与工作台 CSS 统一顺序、边框、高度和桌面/窄屏布局。
- 默认云图状态、状态桥接和时间轴自动展开逻辑同步调整；无显式 URL 时避免旧实况偏好把首屏拉成高面板。
- 更新 v1.0.12 package/lock、根与 docs Changelog、应用内版本记录、项目 tracking/testing、制造与交付流程文档及 lessons。

## 4. 验证记录

### 4.1 先行专项

- ESLint：PASS。
- TypeScript：PASS。
- `npm run test:unit -- scoreThreshold.test.ts versionConsistency.test.ts`：52 个测试文件 / 304 项通过。
- `npm run build`：PASS。
- 专题评分 E2E：火烧云、云海桌面/移动 0/60/100 和 null 数据用例通过。
- 顶部控件 E2E：顺序、Bortle 文案、门槛联动、默认云图和无横向溢出通过。
- 几何抽查：1280×900 与 1440×900 下搜索/定位/四组顶部参数均在同一行；四组参数共享同一顶部坐标和渲染高度，文档级 `scrollWidth` 等于视口宽度。

### 4.2 回归修正

- 兼容入口测试把两个合法小时矩阵用未限定选择器断言，改为断言首个单夜矩阵。
- `/sites` 命令栏 Bortle 已是单选预设，旧测试的 257/220 组合数量改为 B4=29、B1=37，并断言 ≥50/≥85 联动。
- 火烧云未知快照现在按门槛 fail-closed 显示空状态；详情布局测试补充一个有分数的脱敏点位，强刷测试断言新的空状态。

### 4.3 发布前待记录

- [x] 完整 `npm run test:e2e`：144 实例，110 passed / 34 skipped / 0 failed。
- [x] `npm run test:live`（真实 Open-Meteo、NASA GIBS、NOAA、VIIRS）和 `npm audit --omit=dev --audit-level=high`（0 vulnerabilities）。
- [x] 分支推送、main 合并：`codex/unified-score-filters-20260910` → `main@d64009276db0`。
- [ ] 生产 app/worker、`/healthz`、`/api/data-status` 和公网 `check:data-sources`。
- [ ] Obsidian `sync-project-docs.ps1 -DryRun` 结果；项目未映射时保留 `NO_PROJECT_MEMORY`，不创建 Vault 项目。

## 5. 未覆盖边界与回滚

- iPhone/Android 真机、200% 缩放、高对比/色觉、压力/长稳、授权 Bortle/SQM 栅格和现场科学校准仍按测试台账保持 MANUAL/BLOCKED/DEFERRED。
- 回滚到上一已部署主线 SHA `a66ad049dfd69a87b0f97b5a5870679163260427`，用同一 Compose 流程重建；不删除 `observing-snapshots` 命名卷。
