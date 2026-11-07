# 逐星 Star_photo_addr：独立 Agent 全面审核请求

日期：2026-10-04（北京时间）  
委托人：Jovi  
任务性质：独立审核，覆盖代码、生产页面、真实数据链路、部署、测试与文档。**本次只审核，不修改业务代码、不合并、不部署。**

## 可直接发送给审核 Agent 的请求

请独立审核本项目当前主线和线上部署，核查它是否达到项目目标、历史计划和交接文档的要求。作者此前多次声称已修复，但用户仍遇到数据不足、页面布局不一致和不合理的日期选择交互，因此不能把作者的自测或交付说明直接当作通过证据。

请检查下列地址、源码、文档、测试以及实际生产页面，主动复现失败场景，寻找遗漏的根因和回归。区分供应商缺字段、额度/限流、缓存失效、客户端状态不恢复、模型混用、布局缺陷与验收不足。请输出可复现、可定位、按优先级排序的详细审核报告及修复建议；未经 Jovi 后续明确授权，不执行修复、合并或部署。遇到缺少权限、历史日志或真实设备时，明确记录 BLOCKED/NOT_RUN，不能猜测通过。

## 1. 地址与环境

| 对象 | 地址 / 标识 | 用途 |
|---|---|---|
| GitHub 仓库 | https://github.com/Jovifei/Star_photo_addr | 阅读主线、PR、提交、CI、计划与交付文档 |
| 本地主目录 | `E:\project\Star_photo_addr` | Jovi 必须保持同步的原目录，目标分支 main |
| 生产网站 | https://photo.joviluma.com/ | 浏览器实际验收入口 |
| 版本身份接口 | https://photo.joviluma.com/healthz | 仅验证版本/buildRevision，不能证明天气通过 |
| 今夜观测 | https://photo.joviluma.com/ | 候选卡片、七天表、地图、详情、逐小时预报 |
| 暗夜选址 | https://photo.joviluma.com/sites | 长期暗空、地点、缺失和许可语义 |
| 火烧云 | https://photo.joviluma.com/fireglow | 晨晚霞、日期、地图、排行、详情 |
| 云海 | https://photo.joviluma.com/cloudsea | 晨晚时相、日期、天气/地形证据 |
| 远端 ChatGPT Project | https://chatgpt.com/g/g-p-6a758ed08fcc8191b7e6184c19225bc1/project | 项目上下文；聊天说法不是执行证据 |
| 原远端 ChatGPT 聊天 | https://chatgpt.com/g/g-p-6a758ed08fcc8191b7e6184c19225bc1-zhu-xing/c/6aa81b66-e3c4-83e8-af60-474976cb7e75 | 历史计划、交接、讨论；已有达到长度上限的记录 |
| 已配置 C2C 连接器端点 | https://c2c-star-photo-addr.joviluma.com/mcp | 使用已有授权绑定；不要新建连接器或扩大权限 |

### 生产运维地址（仅交给已有授权的审核 Agent）

- 阿里云 ECS：`120.55.64.11`；已有 SSH 运维身份：`root@120.55.64.11`，SSH 22。
- 服务器工程目录：`/opt/star-photo`。
- 主机内部网站地址：`http://127.0.0.1:3100`；应用容器内部端口 3000。
- 应用容器：`star-photo-star-weather-1`；worker：`star-photo-star-weather-worker-1`。
- 原命名卷：`star-photo_observing-snapshots`；容器目录：`/app/data/snapshots`。
- 当前记录镜像：`star-photo-addr:deploy-4e867ecf2aa0`；回滚：`star-photo-addr:rollback-before-4e867ecf2aa0`。
- Compose：`docker-compose.yml` 和 `docker-compose.aliyun.yml`。
- 服务器约 1.8GiB 内存。历史服务器端编译曾导致 OOM；只读审核不可重跑生产构建或触发部署。
- 本地私有运维说明：`docs-private/REMOTE_DEPLOYMENT_PRIVATE_GUIDE.md（本地保留，不入库）`。仅在已有权限下读取，不能把环境值、私钥、Token 或完整配置抄进报告。

**本文件包含运维地址，采用 PRIVATE 文件名，保持本地交接；不自动提交公开仓库或镜像到知识库。它不包含凭据，也不授予新的账户访问权限。无现有访问权限时，请列出阻碍，禁止索取或引入凭据。**

## 2. 审核基线：开始时重新核对

以下是交付记录，不是要求审核者接受的结论：

- 本地 main 文档 tip：`48f5562648e5dde086b387fc4065f4679f927c57`。
- 记录中的生产版本：`v1.0.27`。
- 记录中的生产 buildRevision：`4e867ecf2aa03e945de535ddb3e6066e8f3ae898`。
- 缓存修复合并 commit：`ee7269f7964603b342411354d0f36ee100654d70`。
- 主线比运行 commit 多出合并/文档记录；应逐文件核查产品源码、脚本、依赖与运行 commit 是否一致，不能仅比较短 SHA 就判为过期或一致。
- 请记录审核时实际的本地分支/dirty 状态、main、origin/main、运行 buildRevision、镜像身份，以及检查时间（北京时间与 UTC）。
- 任何与上述基线的差异都要先解释，再继续审核。若基线已经更新，以实际值为准并保留本文件基线作为历史。

相关提交/审核范围：

- PR41/43：历史功能整合、Best Match 候选评分与云图模型分离、天气原始事实与缺失状态。
- PR44/45/46：四入口同等地位、统一导航、直接日期选择、紧凑工具栏。
- PR47：https://github.com/Jovifei/Star_photo_addr/pull/47 ：完整浏览器旧契约迁移。
- PR48：https://github.com/Jovifei/Star_photo_addr/pull/48 ：跨午夜请求 past_days=1 与缓存覆盖范围迁移。
- PR50：https://github.com/Jovifei/Star_photo_addr/pull/50 ：失败后一次有界恢复；手动失败后的恢复不得携带强制刷新标记；shadcn 生成工具归入开发依赖。
- PR51：https://github.com/Jovifei/Star_photo_addr/pull/51 ：大批次固定长度缓存文件名、旧短名兼容。
- 不只审核这些 PR 的 diff：还应沿调用链检查整合后的行为、跨功能交互和遗漏场景。

## 3. 阅读顺序与证据权威

1. 当前 `AGENTS.md`、`tasks/lessons.md`、`tasks/todo.md`。
2. `LOCAL_CODEX_HANDOFF.md` 的最后几节；全文含历史版本，注意先后关系。
3. `docs/README.md`、`README.md`、`docs/product/WORKSPACE_ARCHITECTURE.md`。
4. `docs/project-tracking/`、`docs/testing/` 中当前状态、计划、门禁和未覆盖项。
5. `docs/engineering-change-log/2026-10-01-weather-header-repair.md`。
6. `docs/engineering-change-log/2026-10-02-branch-consolidation.md`、`2026-10-02-full-chromium-contract-closure.md`。
7. `docs/history/OVERNIGHT_COVERAGE_DEPLOYMENT_20261003.md`。
8. `docs/engineering-change-log/2026-10-04-candidate-recovery.md`、`docs/artifacts/candidate-recovery-v1.0.27.jpg`。
9. 按需查本项目 Obsidian 映射：`E:\AI_Tools\Obsidian\data\notes-personal\codex_memory\03-项目记忆\star_photo_addr`，重点为当前进度、关键决策及工程文档。笔记是历史线索，必须与源码和生产核对。

源码、真实运行和可复现证据优先；旧文档、截图、聊天、作者结论均可能过时。检查文档内部是否存在旧的 PENDING 与后续已完成回执并存、许可状态模糊、计划落后或缺少可执行验收标准。

## 4. 必审 A：显示与交互

四个主要入口“今夜观测、暗夜选址、火烧云、云海”地位相同。请独立判断实际界面的美观、密度、可理解性，不把无溢出等同于体验合格。

- 四入口标题、字体、导航、页头高度、选中态和信息层级是否一致；切换火烧云/云海是否仍突然放大。
- 日期、时间、晨/晚时相必须在顶部直接选择；是否还有先点“调整”再弹层、遮地图、强制展开大面板的流程。
- 桌面选项是否按内容宽度，是否再次被 width:100%/1fr 拉成大面积选项；手机是否自然换行、具有触摸尺寸且不机械让每组独占一行。
- 当前时间、评价夜晚、候选比较日期、地图时次、预测/实况、播放轴之间能否理解；独立排序按钮是否被误认为全局日期切换。
- 三栏宽度、窄屏抽屉、弹层、滚动条、地图手势、逐小时区、虚拟键盘、横屏、文字放大、悬浮控件遮挡和焦点恢复。
- 无数据/部分可用/缺字段/过期/冷却/刷新失败/实际恢复是否精确可见；“使用最近成功数据”是否在没有成功数据或时间未知时误导用户。
- 原始天气已可用但评分被暂缓时，云量/降水/风/抓取时间是否仍可见；月相、暗夜时长等可独立计算的事实是否被不必要地一起隐藏。
- 键盘操作、焦点、对比度、缩放和触摸交互。检查窗口，不只截顶部。

建议尺寸：320、390、768、1024、1440、1920、3840px；至少含手机横屏、短高度和200%文字场景。真实手机不可用则明确 NOT_RUN。每项问题提供视口、步骤、截图和对应元素/源码定位。

优先代码入口：`src/components/ProductHeader.tsx`、`CandidateList.tsx`、`StarWindowTable.tsx`、`src/app/globals.css`、`src/app/mobile-map-first.css`、`src/app/fireglow/`、`src/app/cloudsea/`；详情与地图相关组件按实际引用定位。

## 5. 必审 B：真实数据全链路

沿“供应商 → 服务端解析/模型能力 → 缓存/快照 → 浏览器请求协调 → store → 候选卡片/七天表/所选地点/地图/详情”逐层追踪。

| 情景 | 必须核查的行为 |
|---|---|
| 正常冷启动 | 所选点及整批候选真正返回并显示；原始字段、模型、时间与评分一致 |
| 首次503/超时/网络失败 | 不无限加载；错误真实；不能丢失仍合格的同地点原始事实或继续推荐过期评分 |
| 客户端冷却结束 | 自动恢复是否仅一次、等待正确、成功清错误、失败停止；不能只测原始请求成功 |
| 429长冷却/每日限额 | Retry-After传递、持久化、跨请求/模型/进程一致；不得由手动或自动刷新绕过 |
| 手动刷新后失败 | 自动恢复必须为普通请求；检查 refreshRevision 与 force 标记的关系 |
| 第二次恢复失败 | 无请求风暴；用户知道何时/如何再恢复，不能永久卡死却只写稍后重试 |
| 数据保持打开超过10分钟/6小时 | 是否自动变为过期、评分失效后能恢复；选中点和候选批次的刷新机制是否不同 |
| 后台再回前台/断网再联网 | 定时器、可见性、旧请求回写、时间推进、跨日范围和缓存是否正确 |
| 多处组件同时挂载 | 相同/重叠批次是否重复请求；去重、排队、并发、取消和重试是否一致 |
| 切地点/模型/日期/删加候选 | 不串用坐标、ID、模型、天数或失败状态；旧响应不能覆盖新选择 |
| 午夜及清晨边界 | previous-night定义、05点/07点规则、时区、past_days与forecast_days一致；核查测试是不是迁就实现 |
| 未来第7夜/模型最大范围 | 必需小时和字段真实完整；不足就是不足，不能用零/别地点/别模型补齐 |
| 1/6/11/17/64地点缓存 | 文件名及临时后缀有界、原子写、读写失败可诊断；数量、顺序、模型、源时间一致 |
| 重启/多进程 | 真正从磁盘读回整批；worker/app协调，不依赖热内存；记录缓存命中类别 |
| 旧缓存迁移 | 旧短文件名、旧覆盖范围、损坏/未来/缺时间记录正确处理；mtime不冒充来源时间 |
| stale/缺必需字段 | 原始事实与合法评分分开，未知与真实0分分开；不能借用BestMatch字段冒充ICON |
| 四个模块 | 分别核查有效地点数、有效评分数、缺失原因、来源模型/时次与页面；一个模块通过不代表另外三个 |

重点问：为何所选地点用ICON、候选用BestMatch？用户能否理解这种独立数据身份？ICON缺能见度导致右侧暂缓评分的设计是否合理、是否有明确的同模型/独立模型选择方案？把必需字段改成可选必须提供依据，不能为了显示分数降低真实性。

检查 `sourceFetchedAt`、`fetchedAt`、`providerRunAt`、时次、地点/模型身份、`stale`、字段缺失计数、有效小时、评分模式、推荐门槛、置信度和数值单位。来源时间不是有效时次，也不是浏览器接收时间。条件指数不是经校准的概率，过往模型时次不是实测。

优先代码：`src/hooks/useCandidateForecasts.ts`、`src/lib/candidateForecastClient.ts`、`forecastClient.ts`、`store.tsx`、`forecast.ts`、`forecastIntegrity.ts`、`candidateNightEvidence.ts`、`src/app/api/forecast/route.ts`；再追 `stargazingFinderWeather.ts`、`pressure.ts`、`observingSnapshotStore.ts`、`fireglow.ts`、`cloudsea.ts` 和 `scripts/observing-snapshot-worker*.mjs`。

## 6. 必审 C：测试、部署及经验是否足够

作者记录的证据，全部需要独立核验：

- PR50头 `d6785fd426eaffb8f98362325f33dfc390301b05`，CI `37174401726` 五job成功，Chromium230通过/122适用性跳过。
- PR51头 `4e867ecf2aa03e945de535ddb3e6066e8f3ae898`，CI `37175774737` 成功。
- 本地72文件420测试、lint/typecheck/build通过；缓存定向23项，包括64地点路由重启。
- 交付时真实页面12显示地点/84数字评分单元；这不是固定期望值，也不代表84项出行推荐或未来天气准确。
- 17地点原始批次被写入69字符hash文件名；来源 `2026-10-04T04:17:56.820Z`。
- 一个192MB上限、network=none、原快照卷只读的冷容器读取，返回HTTP200、cache-only-disk、stale=false、17地点及同一来源时间；临时容器已删除。
- 最初用户截图那次请求的原始失败原因未从现存日志还原，不能把它写成已证实429。

请审查：420项测试是不是覆盖真正故障而不是复制实现？122项跳过是否合理，有没有藏掉失败？是否把单点成功、mock、健康、部署切换、source-equivalence或旧CI冒充最终生产通过？64地点测试是否真的丢弃内存并检查文件？真实数据是否只是恰逢供应商恢复，尚未证明旧页面恢复？

定向测试入口：`tests/unit/forecastClient.test.ts`、`candidateForecastClient.test.ts`、`candidateNightEvidence.test.ts`、`tests/integration/forecastRoute.test.ts`、`forecastDiskIntegrity.test.ts`、`tests/e2e/data-state-presentation.spec.ts`、`forecast-integrity-p0.spec.ts`、`workspace-data-refresh.spec.ts`及页头/日期/移动布局测试。文件名若更新，以实际源码为准。

部署应查：main/远端/运行产品差异，镜像revision，app/worker健康与重启次数，卷是否保留，代理缓存/静态资源与旧标签页版本，发布与回滚步骤，内存/磁盘及配额预算。不得只据容器healthy判天气恢复。审核旧文档的部署命令是否仍会在低内存生产机上构建，是否有危险或过时的操作建议。

请判断已有计划是否可执行、与当前技术路线一致，是否遗漏数据可用性/SLO/监测/字段能力/缓存和供应商预算。可参考开源项目或工具，但提供原始项目链接、许可证、维护状态、适配成本、具体解决的问题，不能只罗列热门名称或无依据要求重写。

## 7. 执行边界

- 先记录原目录dirty状态；保护Owner文件，源码检查/本地测试使用隔离worktree，禁止reset、clean、stash、丢弃或覆盖未提交工作。
- 本次只审核。不要提交修复、合并PR、重启生产服务、更改部署或删卷/缓存/回滚镜像；只可产生审核报告和测试证据。
- 先读取服务端供应商冷却标记与缓存。冷却未结束不强制请求、不清缓存；优先cache_only和已有原始响应。
- 真实请求有界，避免全站多模型/多日期探测耗尽配额；明确记录请求数量、模型、范围和时间。故障注入与耗额测试放本地，不能针对生产造故障。
- 不购买额度，不引入凭据，不修改VPN/DNS/代理或生产网络。
- 获得已有授权时才能只读访问运维环境；拿不到权限或证据时明确BLOCKED，不要求把密钥粘贴到聊天。
- 不向已满的旧ChatGPT聊天反复发送；不未经Jovi明确决定新开聊天；审核Agent不得把建议伪称已执行。

## 8. 审核交付格式

建议文件：`docs/INDEPENDENT_AGENT_AUDIT_REPORT_20261004.md`；涉及私有运维细节的附件使用PRIVATE后缀并保持本地。不要把秘密或完整生产日志写进报告。

报告至少包含：

1. **独立结论**：PASS / CHANGES_REQUIRED / BLOCKED / PARTIAL；分别列显示、数据、缓存、部署、测试、文档与路线。
2. **身份与时间**：准确仓库/工作树/分支/SHA/线上版本、审查时间、实际权限与测试环境。
3. **P0/P1/P2问题清单**：标题、影响、用户场景、地址/文件:行号、复现步骤、期望/实际、证据、根因可信度、最小修复建议与回归验收标准。
4. **实验矩阵**：每个场景的PASS/FAIL/BLOCKED/NOT_RUN/SKIPPED，跳过理由、请求量；源码判断与mock/真实供应商/真实生产/真实手机分别标注。
5. **关键截图与数据摘要**：至少四入口桌面/手机、日期交互、真实批量成功、失败/过期/恢复。只摘必要非敏感字段。
6. **作者结论复核**：哪些确认、哪些夸大/不足、哪些因环境或供应商变化无法重现；不强行以找bug数衡量审核。
7. **上线/整改判断**：哪些必须立即修复、是否确需回滚或暂缓某项推荐、哪些可以进入下一阶段；只给建议，不自行执行。
8. **下一阶段建议**：优先级、依赖、可执行任务、验证方式及开源参考；说明与既有计划的差异及需要Jovi决定的事项。

没有源码/真实运行证据的问题写为待证假设；没有执行的验证不记PASS。审核必须独立于作者的乐观结论，也不能为了否定作者而忽略已有可核对证据。
