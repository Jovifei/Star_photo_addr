# v1.0.19 移动端与数据完整性发布候选

> 记录日期：2026-09-23。此记录描述发布前候选验证；公网部署状态须以部署后 `/healthz`、数据源检查和页面验收为准。

## 用户问题与修复

- 手机/平板保持纵向文档滚动；地图手势、瓦片重试和详情抽屉按视口分离；桌面详情不再错误声明为 modal，手机抽屉保留 modal 焦点语义。
- 云海快照同时核验 surface 晨/昏评分窗口和 pressure 目录覆盖；摘要缺失、计数不自洽或目录总数不符时显示降级、响应 no-store，不能覆盖完整 fresh cache。
- 火烧云按所选日期集记录逐日失败（即使该日没有旧快照），并按所选晨/昏阶段判断评分可用性；日期与时段不完整时，地图、排行和详情明确提示。
- 地点深链的海拔缺失/空白保持 null，显式 `elevation=0` 不变成未知。
- 评分缺失与真实 0 继续使用不同展示语义；CloudSea coverage 和版本记录均有回归门禁。

## 独立复审闭环

对比基线 `main@3334e0c08f9ab2e481277628ce4ee875e2f1039e` 与候选提交/工作树后，先后修复云海 surface 覆盖与客户端摘要 fail-closed、火烧云三日冷启动失败与阶段评分、空海拔深链、宽屏非模态语义、coverage 总数校验、版本记录缺页，并补充对应红绿测试和历史 changelog 条目。

## 本地候选门禁

- `npm run check`：PASS，Node 24、ESLint、TypeScript、63 个 Vitest 文件 / 368 项测试、Next production build。
- `npm run test:e2e`：PASS，Chromium 230 项，163 passed / 67 个项目/设备适用性 skip / 0 failed。
- `npm run test:e2e:cross-browser`：PASS，Firefox desktop + WebKit mobile，4/4。
- `npm run test:live`：PASS，Open-Meteo 四模型、pressure、geocode、AQI、NASA GIBS、NOAA Kp、VIIRS。
- `npm audit --omit=dev --audit-level=high`：PASS，0 vulnerabilities。
- 第二轮独立复审：未发现所列项目仍有未解决缺陷。

## 发布边界

- 使用 release 分支 `codex/mobile-data-integrity-v1.0.19-20260923`；发布授权为 patch `v1.0.19`。
- 发布前公网基线实测为 v1.0.18 / `349db7b`，主要数据源状态为 available；这不代表 v1.0.19 已上线。
- GitHub PR/CI、main 合并、ECS 部署、生产 app/worker 健康、`check:data-sources` 和页面 smoke 仍需逐项执行并保留证据。
- 不以本地测试替代 iPhone/Android 实机、Safari 底栏/软键盘或人工验收。
