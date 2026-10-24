# 2026-10-24 C1–C4 组合候选独立验收合同

## 身份、树及版本

- 项目：Jovifei/Star_photo_addr，工作区身份 Star_photo_addr / workspaceId 19420f082390。
- main 父基线：`da159975f7a32f02fa2b9ed869e4ec729e2553a4`（未经修改）。
- PR #54 固定来源 HEAD：`e76541db0d6e068a49f62240950e376dbc35afb9`，作为本分支父提交。
- PR #55 固定来源 HEAD：`e7d723de50edcc3c654280464769c48b92fe909f`；以下四个文件直接复用其原 Git blob，不重新粘贴可能失真的代码。
- 新隔离分支：`codex/scoring-combined-20261024`，PR 指向 `main` 且保持 Draft。确切最终 HEAD 由 GitHub 分支引用与 CI 一起核验，本文件不在提交内部自指 SHA。

## 组合实施差异（A–D 实际执行）

| 缺陷 | 文件/回归 | 明确行为 |
| --- | --- | --- |
| C1 云海数据跨日期串用 | `src/lib/cloudsea.ts`、`tests/integration/cloudseaPublicSingleRun.test.ts` | 输入48h GFS 原始字段，窗口只挑请求日期的 05–08；22日地面4/4、可评分3/4、压力4/4、均分8/100，非观测真实云海 |
| C2 缺席来源误算过期 | `src/lib/cloudsea.ts`、同上测试 | 缺席来源计覆盖缺失而非创造 null 时间；存在但时间非法的来源继续过期失败关闭；全无来源年龄 Infinity |
| C3 新鲜不完整被误称旧数据 | `src/app/cloudsea/CloudSeaApp.tsx`、`tests/e2e/cloudsea-topic-ia.spec.ts` | `stale=false`+有效指数+partial+refreshError 仍给真实部分覆盖提示而不说「旧数据」；`stale=true` 仍标旧 |
| C4 新快照来源缺席被误称旧快照 | `src/components/SnapshotSourceDisclosure.tsx`、`tests/e2e/cloudsea-topic-ia.spec.ts` | 有新 provenance、来源数组空 → 该地点数据集缺席；缺整套 provenance 旧缓存 → 旧版本没有来源时间；生成时间不得替代原采集 |

原 PR #54 还包括原公开单次起报 JSON、来源/许可说明、独立审核、LOCAL_CODEX_HANDOFF。PR #55 的差异包括 `docs/audits/CLOUDSEA_PARTIAL_FRESH_DISPLAY_C3_20261024.md`。两份更改仅用于评分/来源/显示链及测试，不改变调参权重、不改付费源、不重写缓存或架构。

## 复核来源与证据边界

- Single Runs GFS `run=2026-10-21T00:00Z`、站点 `cs-fuzhishan`（请求29.708/120.952、真实目录山顶861m），供应商网格29.697365/120.9375、模型地形194m。原始 JSON 13092 字节，SHA256 `88208d4c95e68a02cade14fc6a4b63a895979c0ce1f49d6e4cdf4e42c54961b6`，见 `tests/fixtures/public-single-run-gfs-20261021.json` 和来源 manifest。数据是公开模式输入，不是摄影真值、观测发生与否或 calibrated probability；不能把模式起报时刻当下载时刻。
- Open-Meteo 署名与 CC BY 4.0 见 https://open-meteo.com/en/terms；单次起报公开协议见 https://open-meteo.com/en/docs/single-runs-api；气压等位高度是 MSL，不能当山顶实测云底。
- PR #54 GitHub Actions #446 的 Live smoke 校验公开 Open-Meteo 等多个供应商：best_match/GFS 能见度48/48，而 ICON/AIFS 能见度0/48（五地点各48h）；live status OK 不等于每种模型都能出星空评分，更不等于生产站点已可用。缺能见度不可猜值或变0。
- 旧本机 parent 的106文件649测试+Chromium287 PASS/131SKIP+Firefox/WebKit12 PASS只代表 **parent**。各 PR 的 GitHub CI 也分别只代表各自独立 PR 测试合并树；组合后必须重新检查 exact SHA。
- 本轮远端没有本地执行器，未在 Owner 工作区运行 Node、Docker、浏览器和生产命令；只在 GitHub 托管 runner 获取可核验输出。不要将测试中 E2E mock snapshot 或 HTTP 200/健康探针称为正式真数据验证。

## 本地 Codex 接收和门禁

只接收固定组合 SHA，在不覆盖 `E:/project/Star_photo_addr` 的 Owner 未跟踪报告或在用本地分支前提下完成本地精确版本验证。命令依次 `git diff --check`、`npm run test -- tests/integration/cloudseaPublicSingleRun.test.ts`、`npm run check`、`npm run test:e2e`、`npm run test:e2e:cross-browser`、`npm audit --omit=dev --audit-level=high`；核对 GitHub CI 的实际终态（全部 jobs 同一 exact SHA / 对应测试合并树）。

发布前还需核 Linux 镜像原生依赖、isolated image preflight、正式环境配置/数据卷备份与 rollback、部署后 `/healthz` exact SHA 与实际真实天气抓取/来源时间、三个地图及移动 UI 验收。不可用或缺观测时关闭推荐而不造数。科学发生概率拟合等待独立按地点/时间/提前量保存实拍真值与固定起报预测，未收齐不做概率声称。

集成 PR 没有执行 merge/deploy，生产版本无需因本次 code review 改变。
