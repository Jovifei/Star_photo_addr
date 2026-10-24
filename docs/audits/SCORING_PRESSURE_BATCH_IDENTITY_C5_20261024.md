# 逐星 C5 · 云海压力批量响应身份守门（2026-10-24）

## 结论和身份

工作区 Star_photo_addr / workspaceId 19420f082390；只读本机 main 的精确基线 da159975f7a32f02fa2b9ed869e4ec729e2553a4。此独立修复分支 codex/scoring-pressure-identity-20261024 由 C1–C4 组合 PR #56 HEAD c6b0e00fc95cd41ba67895ebe0fffe47fb70f85c 派生。不修改 main、不部署、不触碰 Owner 工作区的未跟踪 reports。

## 根因、反例及最小修复

src/lib/pressure.ts 中 buildPressureForecastBatchUrl 请求 timezone=Asia/Shanghai、utc_offset_seconds 预期28800、timeformat=unixtime、start_date=end_date=目标本地日期。原 fetchPressureForecastBatch 没有检查响应时区、原始UTC偏移、供应商返回网格坐标和解析后 epoch 对应的目标日期。它按响应数组 index 直接标记为压力来源可用，即使来源不属于所选日或者时区不匹配。

修复仅限批量入口：拒绝错误 Asia/Shanghai 身份、错误偏移、非有限或越界纬经度，以及 epoch-v1 与请求本地日期不一致；按站点隔离错误，其他合法数据继续保留。通用 parsePressureForecast 单点解析器不变，仍支持 Los Angeles DST 重复时次、Kathmandu 非整点时区等；旧 ISO 只按 stale 保留事实，不把旧来源提升为新评分。供应商模式网格中心与请求点允许有空间偏移，不能要求精确相等。官方定义：https://open-meteo.com/en/docs/gfs-api

### 确切 RED → GREEN 证据

| 运行 | HEAD | GitHub Actions quality |
| --- | --- | --- |
| #452 | a1c872b0ade58f546fe4042f67de4eede8f0f00a | RED：107 文件657项，651 PASS / 6 FAIL，均为新增身份反例 |
| #453 | 0af93f0c6b3e876f6f019ff3a01c38cf6b900de7 | 656 PASS / 1 FAIL；新增6项已绿，原 hourly 损坏夹具同时缺身份导致断言错误 |
| #454 | 5eb35095b7294eff5454bb26c1bd9e6b01b525bd | quality PASS、live-data-smoke PASS；已把原测试改为合法身份但 hourly:null，保持原断言 |

链接：#452 https://github.com/Jovifei/Star_photo_addr/actions/runs/40058818486；#453 https://github.com/Jovifei/Star_photo_addr/actions/runs/40058947061；#454 https://github.com/Jovifei/Star_photo_addr/actions/runs/40059043697 。

六项 RED 分别为固定时区错设UTC、偏移错误0、纬度91、经度181、合法绝对epoch却来自次日、以及 CloudSea 路由误把全站错时区压力响应报告为 available。两类测试 tests/unit/pressure.test.ts 与 tests/integration/cloudseaRoute.test.ts 保留原断言并增加回归。

原 C1–C4 正确性合同不改：公开 GFS Single Runs 固定起报模型预测（非实拍标签）13,092 字节、SHA256 88208d4c95e68a02cade14fc6a4b63a895979c0ce1f49d6e4cdf4e42c54961b6；2026-10-22 上海05–08时段地面4/4、可评分3/4、压力4/4，云海条件指数均分8/100。固定起报不是摄影云海概率。

## 门禁与风险边界

- 上述状态属于 GitHub-hosted runner，不是 E 盘本地 npm/Playwright/Docker 验证。提交本审计文档后产生的新 HEAD 必须重新核其 CI 终态，不能借用旧 SHA 的通过记录。
- GitHub live provider 合同通过不等于正式部署数据可用：原抽样 GFS/BestMatch 能见度48/48、ICON/AIFS 0/48，后者仍不得产出伪造天空评分。
- CI 容器启动、前端静态 SHA/包体一致或 /healthz 200 不代表正式 HTTPS 已取得真实天气。生产 Linux 镜像隔离预检、配置/卷备份、worker与回滚、三入口真实天气/来源与手机验收仍 NOT_RUN。
- 供应商返回网格位置仅验证合法坐标范围；合法但跨地点调换顺序的风险仍依赖提供商顺序合同，本阶段不发明任意距离阈值去误拒粗分辨率网格。若有实际错位证据，下一阶段以固定模型响应矩阵及保留原坐标回执另行界定。
- Jovi 两次实拍独立标签/精确有效时间/当时起报资料未齐，统计命中率与科学概率校准仍 NOT_VERIFIED。
- 不修改付费源、调参权重、模型、缓存策略或历史报告；不合并main、不部署。

## 本地 Codex 接收及继续路线

接收唯一后继 PR #57（包括从 PR #56 继承的 C1–C4 和本次 C5），以 GitHub 实际 HEAD 为固定 SHA；先保留 E:/project/Star_photo_addr Owner 未提交文件、未跟踪报告，绝不 reset/clean。核真实 Git SHA、Git Tree、公开预报输入原始 SHA256。运行 git diff --check；npm run test -- tests/unit/pressure.test.ts tests/unit/pressureAbsoluteTime.test.ts tests/integration/cloudseaRoute.test.ts tests/integration/cloudseaPublicSingleRun.test.ts；npm run check；npm run test:e2e；npm run test:e2e:cross-browser；npm audit --omit=dev --audit-level=high。逐项保留日志、exit code和运行平台。

CI全绿后仍需新镜像隔离预检、真实产品HTTPS每一数据层有效期/单位/时间、移动端显示、配置卷备份及可回滚；生产开关只在真实门禁关闭后由本地执行。之后另做多模型多起报固定输入与有独立观测标签的留出验证；不能以模型条件指数冒称经过校准的发生概率。
