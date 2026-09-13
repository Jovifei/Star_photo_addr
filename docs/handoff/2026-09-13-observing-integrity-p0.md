# 逐星：观星 94 分事故 P0 第一阶段交接

状态：`REMOTE_P0_CONTAINMENT_COMMITTED_LOCAL_VALIDATION_REQUIRED`

这不是生产验收通过声明。当前分支未合并 main、未部署、未重启 ECS、未删除快照，应用版本未升级。

## 1. 基线与证据

- 仓库：`Jovifei/Star_photo_addr`
- 持续开发分支：`codex/data-source-integrity-audit-20260913`
- 原审计提交：`3e1e13200bbf4a01ef09b8b90a431fb371f37c87`
- 原 main：`7afa8392243e144f8c86633be0c06e0f49c570e5`
- 本轮源代码提交：
  - `066346007efab1298a781892302b048702635cb3`：缓存年龄、原始时间与推荐数据门槛。
  - `189d699ba328781172a4ca6f2357370790f90459`：候选请求共享、并发限制与评分显示语义。
- 原审计报告：`docs/engineering-change-log/2026-09-13-production-data-source-audit-v1.0.14.md`，保持不改。
- 报告里的生产请求次数、磁盘文件年龄、模型分歧、现场经历是上一位 Agent/用户提供的证据；本轮核对了对应远端实现，没有重新登录服务器复现这些数字。
- 审计记录的生产身份为 v1.0.14 / 39338495db0d；它不是上述 main 的相同 SHA。须在发布前核实提交关系和实际构建身份，不推断它们完全一致。

## 2. 评审结论：认同与限定

认同：旧 forecast 磁盘回退无年龄门槛；stale 快照携带高分；两个候选组件监听 forecastCache 并重复发请求；地图未使用分层云；候选/详情取独立最佳三小时；旧表格还用模糊地名/近邻借用地图评分。均有源码依据。

限定：不能将该证据视为当晚云况偏差的唯一因果证明；还缺原始发布批次、浏览时刻、实际到场时刻和现场云量标签。总云量本来是覆盖率，不应把低中高云相加；增加分层字段不能纠正整个模型都报晴的情形。API key 不是准确率开关，也不能替代并发治理。Best Match/多个模型不自动构成相互独立的真值。健康探针通过只代表所探测请求成功。

官方字段口径纠正：Forecast API 返回的 elevation 默认来自90米DEM并用于统计降尺度；只有指定 elevation=nan 才使用平均网格海拔。因此报告中的1402m不能未经核对就称为原生模式地形海拔。展示时区分 provider elevation / elevationSource / request elevation / native model elevation（未知则null）；不要直接为消除差异把所有请求改为 elevation=nan。参考 Forecast API 文档的 elevation 响应定义。

## 3. 已实现（准确边界）

### 3.1 原始抓取时间与磁盘回退

新增 `src/lib/forecastIntegrity.ts`。时间必须有显式 UTC/offset，缺失、非法或超过容许时钟偏差的未来时间拒绝。采用 envelope/单地点较老的 fetchedAt，不能使用文件 mtime、客户端收到时间、快照重算时间替代。

`/api/forecast` 磁盘回退：最多 6 小时，配置只能缩短不能延至数天。验证模型、地点数量、时间和基本结构。6 小时以内且上游失败只返回显式 stale 原始天气；它仍不能参与推荐。超龄/坏文件返回错误，不删除文件。写盘改为临时文件 + rename。

### 3.2 观星快照高分保护

新快照附带 `integrityVersion=weather-integrity-v2` 和 `sourceFetchedAt`。旧版无标记评分缓存不会直接复用，新建快照也不能借 generatedAt 把旧源数据洗新。失效快照在读取、生成、写入、取单点和 stale 标记处撤销 `score/band/confidence/bestWindow`；raw cloud 可保留供诊断。

当请求覆盖的站点记录缺失/stale/error 时，暂时保守撤销整批推荐，避免现有全局 stale 表达掩盖问题。后续可改为逐站点质量状态，但必须先让 UI 明确表达覆盖率，不能直接撤掉保护。

### 3.3 数据门槛和分层云

地图和夜间评估共享云量、降水量、风速、阵风、能见度、天气代码完整性门槛；夜间模型另外要求温度、湿度、露点。缺失不是零。没有降水概率的模式允许依赖真实降水量，但不把页面概率补成 0。

用于评分的保守云量取 `max(total,low,mid,high)`；这是工程保护规则，不是新的气象实测总云量，也不是经校准的事件概率。原始 `.cloud` 仍是 provider 总云量。云量 >=50 的不推荐门槛是本轮明确采用的保守策略，并非由现场样本拟合的科学阈值。

地图返回分层字段、有效评分云量、scoreTime/scoreBasis、modelAgreement=not-checked 等附加 JSON 信息。单模型不再固定 high confidence 或进入 priority。**这些新增字段的全站可见展示尚未完成。**

### 3.4 夜间连续窗口

`evaluateNight` 拒绝 stale/超龄/关键字段缺失数据。有效夜间样本不得重复，至少七个。评分用连续且无阻断的三小时窗口，不拼接不连续的最好三小时；无三小时窗口不能得到 go。窗口标签说明是连续小时采样，避免两端 HH:mm 与 duration 表达矛盾。

评分模型标识变为 `star-v1.1-integrity`，包版本暂未改。置信度最多 medium（远期 trend），不能将字段齐全解释成准确率高。

**地图天气分和详情含天文分仍未数值统一。**本次统一的是数据门槛，不是全套公式。应保留这一未完成项，不能在发布总结写“评分全部统一”。

### 3.5 候选重复请求

新增 `candidateForecastClient.ts` + `useCandidateForecasts.ts`：以模型/规范化坐标/有效天数共享 Promise，候选并发最多 2，队列及缓存有上限；429/失败冷却 60 秒，无自动无限重试。同一人工刷新 revision 合并。

CandidateList 与 StarWindowTable 都消费该请求层，加载 effect 不再由每次 forecastCache 写入重触发；候选不再固定 ICON，改读所选模型。模型切换卸载后旧回包不写入新视图。失败时旧的同模型候选缓存标 stale，不继续亮高分。

表格移除模糊地名/近邻快照分数 fallback，防止“请求失败却拿另一模型/另一地点的分数”。未知值显示数据不足，不进入金银铜名次。候选文案区分整晚窗口与当前时次，删除仅凭85+分显示的“强烈推荐”。

**这个队列只覆盖两处候选视图。**`store.tsx` 选点/刷新、地图网格、观察快照等其他链路的全局请求治理尚未完成；不能宣称全站请求风暴已经完全消除。

## 4. 验证真实记录

当前执行环境：Node 22.16.0；没有完整仓库依赖、不能访问 npm/GitHub Git 传输网络。项目要求 Node24。

已执行 TypeScript transpile 语法检查（包含本轮源文件和测试文件），以及 31 项 Node assert 隔离检查，0 失败。覆盖：6小时边界/7天磁盘数据、缺失和未来时间、模型与数量、stale94撤销、旧版本缓存、旧source+新generated、分层61%不推荐、缺层、缺批次、连续窗口、30次重复调用只请求1次、并发<=2、刷新revision与429冷却。

隔离检查使用替代 astronomy/nighttime/catalog；没有验证真实天文计算、Next路由、React effect 或生产浏览器。**它不是 `npm run check`、Vitest 全量、Playwright 或 GitHub CI 通过证明。**

新增待在本地真实运行：
- `tests/unit/forecastIntegrityP0.test.ts`
- `tests/unit/candidateForecastClient.test.ts`
- `tests/integration/forecastDiskIntegrity.test.ts`（真实临时文件 + route，上游故障注入）

更新现有 scoring 与 darkskyTrust 测试：原有结构/窗口/Bortle独立性断言保留；合成数据使用明确的新鲜抓取时间；Bortle独立性增加 non-null 断言，避免 null==null 伪通过。

## 5. 本地 Agent 第一阶段：接收与验证

1. `git status --short`，保护用户未提交工作。脏工作区优先新 worktree，禁止 reset --hard / clean -fd。
2. `git fetch origin`，读取该分支最新 HEAD；确认包含交接消息中的最终提交。远端前进时审核新增差异，不回退别人提交。
3. 继续使用该 audit 分支或基于它的新隔离 worktree，不从旧 main 重新实现、不重复 cherry-pick。
4. Node24 + `npm ci`。
5. 先运行三份新增测试，再 `npm run check`。
6. 若旧 fixtures 缺 fetchedAt/layer/metadata/version 导致失败，补充合成fixture合法证据；不要修改生产门槛为了恢复旧94断言。旧 snapshot JSON 必须明确 v2 + sourceFetchedAt，另保留无标记拒绝测试。
7. 必须新增挂载两组件的真实 React/Playwright 回归：冷启动、不同模型、删加候选、强刷、先失败再恢复。单个同模型/坐标/天数候选 key 只能有一次 in-flight；冷却内重复渲染不得再打429。不要用“整个页面总请求必须<=2”替代候选并发断言。
8. 记录第一个真实失败、原因和最小修复。任何未执行的测试必须标 NOT_RUN，而不是 PASS。

## 6. 本地 Agent 第二阶段：发布前阻断项

这轮必须补全或明确阻断发布，不得只看到 green unit 就直接部署：

A. 选中地点的 store 数据入口传播顶层metadata/HTTP stale、原始fetch时间与模型身份；不能在200-stale时 dispatch成功并清掉过期状态，不能在模型切换失败时显示另一模型缓存。候选共享请求层可复用，但注意 AbortController 不能误杀其他消费者。

B. 统一同一地点、同一模型、同一时次、同一输入的核心天气/天文小时评分；地图选中时次分与候选整晚最佳窗口分允许不同，但 scoreBasis/scoreTime/aggregation 必须可见，不能互作fallback。当前这两个数值模型尚未统一，先定契约再改，保持导出接口兼容并补相等性测试。不要为了让旧高分保留而删门槛。

C. 全局请求去重/批次覆盖：除了候选，测 store、cloudGrid、observing snapshot、worker 同时运行的实际 Network。给 server/provider 请求合理并发预算与负缓存，尊重429/Retry-After，不仅给前端加sleep。严格校验批量返回数组与原time轴长度、顺序、地点数量和坐标映射；不能先过滤time再用旧索引读取其他数组。让 worker 预热首页实际消费模型、观测夜和时次族；不能简单给282点乘4模型来扩大配额问题。

D. cloudGrid 不得用 Date.now 洗新 sourceFetchedAt；UI、摘要、图例、候选、详情在 stale/missing 下都需显示来源质量。页面一直打开、跨模型切换、客户端缓存变老也要测试，不仅测试重载页面。

E. 补全生产数据身份卡：请求坐标、实际模式坐标、模式海拔与机位差、模型名、所选预报有效时次、应用抓取时间、缺失字段、是否多模型核验。provider运行/发布时间未取得时返回null并注明未提供，不能把fetchedAt冒充运行时间。尤其不得继续把默认DEM elevation字段直接宣称为原生模式网格平均海拔。

## 7. 后续非本次已完成项

- 多模型分歧：建议优先对用户选中地点/少量候选按需核验，时间/模型run/空间网格可比后展示差异；没有核验就 not-checked，不能给“模型一致”标签。不自动取平均当真值。
- GIBS frameAge与catalogAge分开；产品NRT延迟阈值按产品特性确定，不能所有图层（含年度夜光）统一按小时过期。
- NOAA Kp UTC解析、AQI/pressure/geocode健康、批量覆盖率：独立缓存的运维探针，避免每位访问者触发全模型全点探测。
- 282点目录逐条来源尚未补齐，只能 unknown/unverified，不得编造 sourceUrl/verifiedAt。
- 30–90天准确率复盘需要“当时已发布的预报run + 提前量 + 现场/卫星证据”。Historical Forecast/Previous Runs不同产品不能混作同一issued forecast，禁止看到了后来的分析场再当先验命中率。

官方核对入口：
- https://open-meteo.com/en/docs
- https://open-meteo.com/en/docs/historical-forecast-api
- https://open-meteo.com/en/docs/previous-runs-api
- https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/

## 8. 合并与部署门禁

目前代码未获得可部署批准。先完成本地验证和上述发布前阻断项，形成范围明确的修复，不开展目录/视觉/云海Phase2重构。

待 npm check、相关E2E、完整CI（quality/live-data/container/Chromium/cross-browser）都有真实结果后再提交PR；未通过不得强制合并或绕分支保护。不要在本聊天环境反复查询CI空等。

发布版本由当时实际main决定（v1.0.14基础上通常是下一patch）；统一包/锁文件/页头/healthz来源。部署前保存实际旧buildRevision与回滚镜像，按已有私有部署指南保护env、卷和其他项目。旧缓存不直接清空：本修复会拒绝旧评分格式；先串行预热需要的核心键，防止冷缓存浪涌。

上线后四工作区检查，特别验证“stale=true +旧94”无法成为正常推荐，HTTP错误不是假0分，所有未知值清楚可见。一次普通页面加载应无无界重复候选请求，无自身制造的429。多模型气象本身可能仍偏差，因此只能说明数据完整性修复，不能承诺现场无云。

## 9. 回传模板与停止条件

回传：分支/原始审计SHA/实施SHA/最终main及部署SHA；改动文件；新增测试和全量测试实际数量；每个CI job/run；四页面桌面移动截图；请求去重计数、模型切换/429/过期文件/旧schema/缺层故障注入；provider/stale/time metadata；尚未完成项。

分开结论：`CODE_VALIDATION`、`DEPLOYMENT_VALIDATION`、`FORECAST_ACCURACY_NOT_YET_CALIBRATED`。通过前两项不代表预报准确率已校准。

完成上述限定阶段即总结；阻断时保留同分支已验证提交与日志并明确需要的帮助，不再用“继续修复”无限扩任务。
