# 四入口审核、全球气压时序与验收资格阶段（未部署）

授权：`docs/HANDOFF_REMOTE_FULL_STAGE_20261008.md`。实际父基线/main `f167501c0f52270d0a6f14268ab6274ca33265bb`，tree `9a7838b050538067d6e999542315e847e8011f13`；工程基线 `6e534c0da71d5937c9b74a79e536d4089a53de2f`。两者差异只有授权文档和Owner笔记，全部保留。独立分支 `codex/decision-evidence-20261008`。最终head/tree、PR及精确CI终态记录在本阶段PR顶部，避免文档自引用SHA。

## 已实际实施

1. pressure请求使用官方UTC epoch；单点继续 `timezone=auto`，中国云海目录批量保留Shanghai日期边界。`epoch-v1`逐时IANA偏移和 `profilesByEpoch` 区分LA回拨两个1时；旧墙钟查找确定选择早者，春跳不存在小时无剖面。保留 `profiles[wall]` 首小时兼容视图，旧ISO仅stale展示，不升级为fresh。非法日历时间、重复/倒序epoch拒绝。
2. 压力响应保留请求坐标与模型网格坐标，详情立即按当前请求坐标/模型隔离状态；失效请求即使忽略Abort也不能写回。矛盾身份响应拒绝。当前小时少于六完整层或stale时保留原始曲线，暂缓云上/云中/云下关系推导。旧URL仅早重复小时一个选中态。
3. 四入口模型上下文：修复解析/专题发布遗漏model，火烧云和云海使用实际携带的ICON/GFS/AIFS并校验响应模型，不再静默重置。无传入模型时各自默认ICON/GFS保持。BestMatch仍是API/候选批量模型，不新增到主地图三模型控件。云海旧GFS文案改为实际模型；无能见度的ICON仍不借GFS/BestMatch评分。
4. pressure API增加带版本的缓存key与 `cache_only=1`：包括同时传refresh也不会触发供应商，未命中503；保留原采集时间，超TTL只读标stale。未删除旧缓存/卷。旧ISO状态贯穿header/云海/详情，不能凭重新生成快照升级。
5. 火烧云日期请求串行、有界；云海在429/Retry-After后停止当前重试及后续日期。普通单日期错误仍可隔离恢复；已有数据失败后stale，不刷绿。原provider协调冷却门禁保持。
6. 可复用矩阵从28行提升到48行：四模型×五点×surface/pressure + 两专题×四模型。先GET不触发天气的acceptance-capabilities，未知/旧版本整批NOT_RUN且零天气请求；确认契约后真实请求只走cache-only，校验模型/请求坐标、IANA时序、原始来源和字段/完整层计数；HTTP200本身不获资格。`QUALIFIED_INPUT`只是输入契约，`PARTIAL_INPUT`保留缺字段事实，`INVALID_INPUT`明确失败；科学、设备、读屏始终NOT_RUN。429或Retry-After停止全矩阵。
7. 既有CI单次pressure供应商探针扩为五坐标GFS、十压力层、epoch/IANA与逐小时六完整层校验，未增加pressure HTTP请求次数。二十surface行照旧，不把供应商smoke当科学通过。

## 全树/祖先与调用链审核

实际读取main授权/AGENTS/README/最新接力/整合文档、Owner进度与源码、测试、CI。检查563个基线跟踪路径与祖先；`e0573b8`是main祖先，工程源码相对上阶段仅手机日期栏CSS和重试测试时钟两文件变化，均保留。不是从旧功能分支重建。

| 边界 | 实际复核 | 结论/处理 |
|---|---|---|
| 四入口与地点 | NavTabs、ProductStateBridge、useTopicContext、locationIdentity、productRoutes、store与location-transfer | 同名/相同sourceId/canonicalId不绕过坐标矛盾；两牛背山不合并；修复实际model漏传 |
| 来源 | snapshotProvenance、Fireglow/Cloudsea快照route、SourceDisclosure | 来源采集/快照生成/传输分离保持；未知起报/观测null；本阶段未重做已解决项 |
| 时序/缓存 | absoluteForecastTime、forecast/forecastIntegrity、pressure与消费者 | surface epoch/旧缓存降级保持；完成pressure剩余时序，旧ISOstale |
| 降级/计数 | dataPresentation、decisionSummary、observingSites、viewportRecommendations、cloudsea计数 | 完整天气门禁与ICON缺能见度保持；修复当前pressure小时层数门禁 |
| 布局/交互 | 原product-header四列日期、AdaptiveSheet与原地图错误/触摸语义，完整浏览器门禁 | 本阶段不改顶部/地图CSS，不撤回已接受布局；新提示只在详情压力卡 |
| 执行保护 | CI、Docker与check-release-frontend、git diff保护文件 | 原内容一致性门禁未修改；Owner两笔记无diff；无部署/force push/凭据或网络配置操作 |

独立复核采用固定父基线工作树运行相同RED回归、独立干净基线构建、冻结候选第二次完整检查和最终diff复核。执行者仍为同一云端Codex，不冒充另一位人工审查者；本地/Owner后续评审见PR。

## 官方/开源研究

- [Open-Meteo官方forecast OpenAPI](https://github.com/open-meteo/open-meteo/blob/290493ffb9b5ee66fb1336219487a346eb27d191/openapi/forecast.yml#L520)：unixtime是UNIX epoch，官方Writer使用UTC `timeIntervalSince1970`。本VM实际只读代码在该精确SHA；项目AGPL-3.0，仅查契约，没有复制服务端实现或引入依赖。
- [ECMA-402 Intl.DateTimeFormat](https://tc39.es/ecma402/#sec-intl-datetimeformat-constructor)：沿用平台内置IANA格式化和现有absoluteForecastTime。无需另加Temporal/polyfill日期运行时；转换显示偏移不更改UTC瞬间。
- Next16.3.8随安装包 `node_modules/next/dist/docs/.../route.md` 已读，保持NextRequest/NextResponse和force-dynamic；React Compiler规则不放宽，压力十层的小计算交给Compiler，移除失败的手工memo。
- 现有Playwright/axe工具承担云端键盘、焦点、浏览器模拟和严重a11y检查。其结果不升级为TalkBack/VoiceOver或真机通过，不另引入庞大框架。

## 可复现RED/GREEN与实际检查

- pressureAbsoluteTime最初3 FAIL（旧实现拒绝epoch、接受伪造日历），修复后PASS；新增旧ISOstale验证。
- pressureDetailsOwnership在固定main父基线4 FAIL：重复小时错误剖面、换地点失败残留、迟到模型覆盖、矛盾身份；候选4 PASS。
- 二次审核新增“当前小时不足六层仍推导”1 FAIL/4 PASS → 修复5 PASS；旧墙钟重复小时两个选中态1 FAIL/5 PASS → 修复6 PASS。保留所有断言。
- model context解析1 FAIL/7 PASS → 修复8 PASS。
- 基线 `npm ci`701包；纯基线lint/types/91文件516测试PASS，独立干净基线build PASS。初次混入新测试的构建不作为纯基线证据；首个tsx回归未被配置发现也不计RED。
- 候选 `npm run check` 包含lint/typecheck/unit-contract-integration/build；初次业务冻结lint/types/97文件539测试/build全部PASS（aa23beae5b5daa36b43883ee0c81bfb77df45b16）；PR53独立反馈修复后完整check为97文件542测试/build PASS；精确最终CI终态见PR。生产 `npm audit --omit=dev --audit-level=high`实际0漏洞。
- 修复后Chromium完整404用例、Firefox/WebKit12用例和容器门禁在最终PR CI上核对终态；本地早期浏览器执行后主动中断以重新冻结审核修复，不计完整PASS。系统Chromium保留断言，只有VM启动参数差异；不冒充跨浏览器/真机。
- 实际本地服务 `/`、`/fireglow`、`/cloudsea` 内容门禁3/3哈希一致。重建复核曾命中中断遗留的旧VM服务器，首页servedSHA b7d3…/packagedSHA0668…不一致，门禁正确失败；仅停止本任务旧进程后重启冻结候选，能力接口200且三页面重新一致，未降低门禁。保护脚本不变；最终CI亦运行该门禁。
- `node scripts/acceptance-weather-matrix.mjs --base=http://127.0.0.1:3103 --cache-only --date=2026-10-09` 实际48行NOT_RUN，首个surface缓存未命中429/Retry-After60，后续停止。原始JSON：`docs/evidence/CACHE_ONLY_MATRIX_20261008.json`。这不是生产数据或准确率。
- 生产cache-only地址及 `https://api.open-meteo.com/` 只读HEAD实际 `curl: (56) CONNECT tunnel failed, response 403`，代理拒绝；没有绕过/改网络。VM真实供应商和生产矩阵NOT_RUN；最终Hosted CI供应商结果单独列出。
- `adb devices`、`idevice_id -l`实际bash command not found（exit127）。无附接设备，真OnePlus/iOS/TalkBack/VoiceOver NOT_RUN。

## PR53本地独立审查反馈闭环

实际读取[评论6064335323](https://github.com/Jovifei/Star_photo_addr/pull/53#issuecomment-6064335323)，审查对象4e03fae6594e02d789c29e951ba91baf87eb7f6b结论CHANGES_REQUIRED；这是外部独立反馈，不与前述云端自复核混称。

- pressure缓存/coalescing五位舍入：30.123451和30.123452顺序与并发均在原代码复现错误身份（2 FAIL/5 PASS）。key改用完整数值坐标；严格详情身份守卫未改。修复后相邻坐标分别返回、相同坐标仍缓存/合并且只请求一次，相关16项回归PASS。
- Fireglow有效HTTP200携带Retry-After：旧构建桌面/移动首次加载均丢弃score72原始快照（2 FAIL）。现先校验并保存当前快照及原始来源/stale，再用传输冷却停止后续日期；429和不可用回退仍立即停止。新增真实浏览器路由回归核对首次原始事实、三日仅当前日期、降级提示、详情原始sourceFetchedAt与总请求次数。fixture仅验证行为，不作真实天气/科学证明。
- 新增顺序策略unit验证保留同一原始对象；完整npm run check退出0，97文件542项PASS，lint/typecheck/build PASS。移动三日列表分数前含日期，新测试首轮误用纯分数文本断言，按现有完整格式修正，保留数值、来源和次数断言。最终浏览器与精确候选五任务CI终态见PR顶部；旧4e03 CI不作为修正候选验收。
- 完整VM Chromium额外发现既有candidate自动恢复测试1 FAIL：测试锚点在route收到请求，慢浏览器消费响应后才注册61秒定时器，62秒断言会提前。实际trace确认第二请求未发生；在返回503前冻结浏览器时钟，让失败响应和定时器共享同一时刻，保留59秒仅1次/62秒共2次/无refresh/分数恢复全部断言。修复桌面、移动2 PASS；不修改业务冷却时长。中断有失败的VM完整运行，不计完整PASS；最终404 Chromium以精确候选CI为准。
- 独立复核最终diff：未放宽坐标/模型归属、六层/ICON能见度评分门禁，未改来源时间、清旧缓存或重复冷却供应商请求。main/Owner笔记/内容一致性脚本保持。

## 每文件原因与风险

| 文件 | 原因/风险 |
|---|---|
| src/lib/pressure.ts | epoch解析、请求/网格坐标、只读旧ISO；维持中国批量日期，风险为旧消费者兼容 |
| src/lib/pressureIntegrity.ts | browser-safe逐epoch查找，type-only压力导入避免node:fs进入客户端；兼容墙钟早者 |
| src/lib/cloudsea.ts | 同模型且非stale压力门禁，原采集保留；旧ISO不得发布云层关系 |
| src/app/api/pressure-forecast/route.ts | 版本key/cache-only与真实stale header；零供应商只读保证 |
| src/components/LocationDetailCharts.tsx | 请求归属、迟到响应、重复小时、六层门禁；原始曲线保留，不改地图几何 |
| src/lib/productRoutes.ts | 解析现有三可选模型；不扩展主地图模型集合 |
| src/hooks/useTopicContext.ts | 专题URL回写模型，地点/日期逻辑保持 |
| src/app/fireglow/FireglowApp.tsx | 携带/校验模型、日期串行与冷却停止；普通错误恢复保持 |
| src/app/cloudsea/CloudSeaApp.tsx | 选定模型、文案真实、冷却停止；完整覆盖与降级仍逐日期检查 |
| src/lib/topicRequestPolicy.ts | 小型客户端顺序/停止策略；普通失败不阻塞后续正常日期 |
| src/app/api/acceptance-capabilities/route.ts | 静态只读能力声明/运行revision；不访问供应商、不写缓存，防旧服务忽略cache_only |
| tests/integration/acceptanceCapabilitiesRoute.test.ts | 能力接口零fetch与no-store真实handler验证 |
| scripts/acceptance-weather-matrix.mjs | 严格只读入口与日期/URL校验；无供应商刷新 |
| scripts/weather-evidence.mjs | 可复用48行收集/输入资格；不生成科学或设备PASS |
| scripts/live-smoke.mjs | 原单次pressure探针核对真实六层/epoch/IANA；供应商429立即退出 |
| tests/unit/pressureAbsoluteTime.test.ts | LA春/秋、Kathmandu、非法日历与旧ISO回归 |
| tests/unit/pressureDetailsOwnership.test.ts | React真实状态切换/迟到响应/身份/门禁/选中态，不依赖静态源码字符串 |
| tests/unit/productRoutes.test.ts | model漏传RED/GREEN与非法模型拒绝 |
| tests/unit/topicRequestPolicy.test.ts | 串行顺序、429停止、普通错与abort隔离 |
| tests/unit/weatherEvidence.test.ts | 缺能见度、伪造HTTP200、来源/时序/六层与48行冷却 |
| tests/integration/pressureRoute.test.ts | cache-only miss、refresh旁路禁止、原时间/stale不重写 |
| tests/integration/weatherEvidenceCli.test.ts | 执行真正CLI、一次能力读取和48次cache-only天气请求，全部非科学结果 |
| tests/integration/cloudseaRoute.test.ts | 供应商fixture使用实际unixtime请求契约；原评分与覆盖断言保留 |
| tests/e2e/mock-open-meteo.js | pressure原fixture字段保留，仅按供应商新契约编码epoch |
| tests/e2e/data-state-presentation.spec.ts | 失败响应前冻结时钟，消除VM耗时干扰；冷却/仅一次恢复断言保持 |
| tests/e2e/fireglow-data-integrity.spec.ts | HTTP200冷却保留原始事实、来源/stale与桌面/移动请求次数回归 |
| tests/e2e/location-transfer.spec.ts | 两专题请求模型/回链与真实429请求次数；原坐标/日期断言保留 |
| docs/plans/2026-10-08-pressure-and-evidence.md | 实施前问题/文件/验收/风险和研究方案；非仅计划交付 |
| docs/evidence/CACHE_ONLY_MATRIX_20261008.json | VM实际只读执行原始结果，明确local base/NOT_RUN |
| docs/REMOTE_PRESSURE_EVIDENCE_STAGE_20261008.md | 本报告、迁移/风险/真实边界 |
| LOCAL_CODEX_HANDOFF.md | 前置当前精确阶段接收步骤，保留历史记录 |

## 迁移、回滚与剩余门槛

只增加pressure响应字段和版本内存key；老pressure ISO按stale展示，profiles墙钟兼容视图保留，旧surface/topic缓存规则不改、不删。部署不在本轮授权范围。回滚由Owner选择上一精确main/source镜像，仅回退代码/镜像；不删/清任何原卷或提升旧数据评分信任。生产5fbf/1.0.27与378回滚只沿用已记录基线，本轮生产域名被403，不能冒称实时已核对。

仍未闭合：生产真实cache-only完整矩阵；实际OnePlus/iOS、TalkBack/VoiceOver、旋转/200%系统字体与地图触摸；固定候选SHA的长期科学校准（实拍标签、独立探空/台站、误差/缺失/模型分层），禁止用fixtures/供应商HTTP200替代。下一动作是本地接收最终SHA、按下述交接验证回传，由云端继续审核和修复；业务实现没有退回本地。
