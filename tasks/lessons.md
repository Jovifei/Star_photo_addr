# Lessons

- 2026-09-29: Codex with ChatGPT 的每一轮必须完整走完“远端审查 → 本地修复/测试/推送 → 远端复审 → 下一阶段 PLAN”，不能在远端首次给出方案或本地首次通过后停下。P4 仍要拆成有限包逐轮关闭，下一包只能在上一包 DONE 后启动。
- 2026-09-29: 地图工作台的 E2E 在 lazy map layers 仍改变布局时，直接点击检查器 tab 可能一直等待元素稳定；先切换检查器再等待地图层，或明确等待稳定状态，避免用 force-click 掩盖真实遮挡问题。

- 2026-09-23: 页面变紧凑后，平板完整文档可能只比视口高50–57px。手势测试先量scrollHeight−innerHeight，再验证实际可滚动距离与页头位移；不要硬要求80px或为了测试人为增加页面留白。保留真实touch事件，不用scrollTo代替手势验证。

- 2026-09-23: 抽屉外框不溢出不等于内部参数可读。`.mobile-map-panel-pane` 隐式 auto 列被长摘要/表格撑到约747px，手机正文横向溢出382px。Linux上测 pane.scrollWidth 多22px，经失败截图定位为 `star-window-table-wrap` 有意横向滚动的数据表；回归应测 pane/card 边界，而非把二维表内部 scrollWidth 当作整栏溢出。滚动体 clientWidth 也会受原生纵向滚动条影响。

- 2026-09-23: 手机页面“可滚动且不溢出”不代表信息层级合理。必须记录首屏 header 高度和地图起点，检查路由 CSS 的 nth-child/grid-row 是否覆盖共享收起态；48px 触控区域不要求巨大实心胶囊和大字。长期模型说明可折叠，实时数据错误必须保持可见。

- 2026-09-23: Playwright 全量矩阵 230 项在 CI 单 worker 串行跑时，job 的 `timeout-minutes` 必须按完整 E2E 耗时预留余量；平台的 `The operation was canceled`/`conclusion=cancelled` 不等同断言失败。先核对 job 超时、测试启动/结束时间和已完成用例数，再调 E2E job budget；不能缩小测试范围或把取消报告为 PASS。
- 2026-09-23: 海拔未知不能用数字 `0` 充当 sentinel；它会把未知显示成海平面，也会覆盖真实 0m。仅保留上游明确值或无歧义的精确目录名称，不能从描述标签的子串或邻近坐标借用另一个点位海拔；UI 保持“海拔待核验”。Playwright 使用 standalone 时先重建当前源码，旧 `.next/standalone` 测试结果不能代表工作树。
- 2026-09-23: 多日/多阶段预测不能只用“至少一天/一个时段有评分”判定整个视图可用；每个活动日期的缺失、地面与压力覆盖，以及当前所选晨/昏阶段都要分别审计并把降级贯穿地图、排行、详情。URL 数值参数需区分缺失、空白与显式 0；surface 覆盖摘要缺失按未知降级，不能按完整数据处理。`aria-modal=true` 只在背景确实不可操作、焦点受限的紧凑模态态设置，宽屏非模态详情不得伪报。
- 2026-09-22: 不把“有错误提示”当成错误恢复已完成；必须验证成功→失败→恢复，按图层/瓦片隔离状态。Leaflet 内的重试按钮须阻止事件冒泡到选点逻辑。
- 2026-09-22: 截图路径先重新测试可读性；本轮八张原图均可读，不能沿用旧“缺失截图”结论。字号验证必须测量倍数，快捷键执行成功不是200%证据；截图文件名须绑定当前实际视口。

- 2026-09-21: Width and overlap assertions alone miss unusable mobile scrolling. Verify an actual vertical gesture moves the document and header out of view, measure first-screen map area, and inspect screenshots. Avoid a locked 100vh app shell plus permanently expanded filters on phone/tablet. Record browser emulation separately from physical-device evidence.

- 2026-09-20: 同一日期在导航按钮和详情标题可以有不同展示密度；日期格式调整后，E2E 必须分别断言紧凑按钮（如 `今日 · 9.20 周日`）与完整标题（如 `9月20日 周日`），不能用一个 helper 混用。空评分快照测试也必须跟随 fail-closed 语义，断言可恢复错误而不是正常阈值空排行。

- 2026-09-20: 火烧云上游空快照不能只在 API 层 fail-closed；前端错误态也必须与“真实有数据但阈值过滤为空”分离，不能继续渲染 `暂无达到 ≥0 分`，否则用户仍会误以为评分为 0。

- 2026-09-19: 云海按日期并发请求时，不能把 pressure 不可用的 200 响应当作完整 fresh snapshot；否则后日会长期显示“数据不足”，即使上游稍后恢复也不会自动重试。日期选择必须同时验证真实请求覆盖、降级缓存 TTL 和页面日期标签。

- 2026-09-13: 数据质量标签必须由“实际可用且身份匹配的输入”决定；“暂无有效预报/缺少抓取时间”不能因为 stale=false 就显示可用，来源、时间和质量需要同一条 fail-closed 判定。
- 2026-09-13: Worker 不能把 HTTP 200 当作 fresh；必须核验快照 stale、完整性版本和非空 sourceFetchedAt，stale 时跳过专题预热并退避。ECS 低内存发布先用本地 standalone + 旧镜像轻量复制，避免远端 Next 编译触发全局 OOM。
- 2026-09-13: 观星分不能只证明上游 HTTP 200；必须同时绑定当前时次、模型、实际网格坐标、分层云字段、provider/应用时间和 stale 状态。页面评分、候选排行、详情和地图必须共用同一条评分链；上游限流或超龄 fallback 时要 fail-closed，不能继续显示高分。
- 2026-09-10: 省级地点扩充必须先建立“省份—来源—机位—坐标—夜间安全”核对表，再写入目录；旅游热度或景区白天观景证据不能直接升级为可整夜进入、暗空真值或实时推荐保证，近似坐标必须在说明和文档中显式标注。
- 2026-09-10: 地点搜索不能只依赖远端地理编码；网红山峰/观星机位可能只存在本地目录，搜索入口应先匹配目录名称、区域和省份，再回退到远端城市结果，并为本地点位保留稳定坐标/海拔语义。
- 2026-09-10: 专题排行的“滑到 60/100”必须解释为分数门槛 `score >= threshold`，不是展示数量；过滤应作用于火烧云和云海列表，并保留 null/数据不足地点的 fail-closed 语义。
- 2026-09-10: 主页默认图层要从用户决策链路出发：默认云量预报 + 光污染参考，卫星实况及其 24 小时时间轴只能由用户主动选择；状态初始化、URL bridge 和默认 E2E 必须一起对齐。
- 2026-09-10: 顶部筛选控件需按“评分时间 → 暗空参考 → 推荐门槛 → 推荐开关”组织，相关边框和高度统一；B1–B4 若带推荐分数，点击档位必须同步门槛，不能继续显示无分数的独立筛选。
- 2026-09-09: 首屏命令栏若被控件的默认最小宽度挤成两行，就违背了“搜索短、参数同一行”的验收；桌面端必须先固定较短搜索宽度并计算 B1–B4/时次/门槛三组的总最小宽度，再用 1280 与 1440 实测同排，只有窄屏断点才允许堆叠。
- 2026-09-09: 用户明确要求把必要筛选参数直接放在顶部状态栏时，不能用“评分设置”二级折叠面板替代；验收必须区分“首屏直接可调的 B1–B4、评分时间、推荐门槛”与低频详细面板，并按用户指定顺序检查默认可见性。
- 2026-08-30: 浏览器本地偏好读取必须先区分 key 缺失与数值 0；`Number(localStorage.getItem(...))` 会把缺失值变成 0 并错误触发最小宽度。新的选点交互不应被旧的面板折叠偏好压制；桌面绝对定位控件也必须在移动断点恢复到网格流中，避免遮住当前时次。
- 2026-08-30: 模态框返回焦点必须先捕获打开前的触发元素，再移动焦点到弹窗首项；`autoFocus` 可能先于 effect 运行并丢失这个返回点。WebKit 的入口、循环和 Escape 返回需要一起重复验证。
- 2026-08-30: 模态框焦点循环不能依赖 document 冒泡阶段的 `document.activeElement`；WebKit 可能在监听器运行前更新它。应在对话框捕获阶段按 `event.target` 判断首尾边界，并用真实 WebKit CI 验证 Shift+Tab/Tab 循环。
- 2026-08-30: 接续中断的实施计划时，先以当前分支差异、提交拓扑和现有测试为事实，不从旧功能分支重建；跨浏览器失败要先区分“浏览器二进制未安装”和产品代码失败，并在完整门禁后再推送 PR。

- 2026-08-26: 用户要求合并多个分支时，先以当前 main 的树和提交拓扑为唯一基线；已 squash 到 main 的 PR 分支不能再次原样合并。功能缺口要在当前基线上用行为测试补齐，发布前再核对唯一主线和远端 HEAD。
- 2026-08-26: 地图半径筛选不能把“半径内无点”呈现为空白；对稀疏区域保留严格半径结果，并明确标记最近点兜底，至少补齐 3 个、最多 8 个，关闭后必须恢复基础点位池。

- 2026-08-13: 地图点击或地理搜索的地点可能没有海拔；天文引擎不能接收 `null`。计算边界应使用海平面作为几何兜底，但不能把未知海拔写回地点显示或评分来源。

- 2026-08-12: A cloned Leaflet route needs a real browser screenshot after CSS changes; a descendant selector can miss the same MapContainer element and leave Leaflet's default gray background in place. Verify the computed background and use a same-element scoped rule before accepting a dark map.
- 2026-08-12: Keep a public-site clone on an isolated route when the repository already has an authored product homepage; route isolation preserves the existing product contract and makes visual regression evidence attributable.

- When asked to merge work into the latest branch, verify both tree content and commit topology. Do not create a publication branch from an older base merely because a squash produces the latest tree; that leaves a parallel history line.
- Before publishing a consolidated branch, show the intended surviving ref, whether old refs will remain or be deleted, and the expected post-push graph. Treat branch preservation and branch consolidation as different requirements.
- For map-first interfaces, a dense time-series panel must not be an unconstrained absolute overlay: keep the primary canvas in its own viewport, progressively disclose the detail panel, and give only the panel a bounded vertical scroll region.
- For a live weather homepage, the default night must follow the current local time; fixed astronomical-event dates belong in auxiliary event context and must never become the primary cloud timeline.
- When a visual defect is reported, verify computed geometry and inherited typography in the running browser before changing CSS; DOM source alone cannot distinguish repeated content from line-height overlap.
- Forecast interpolation and satellite imagery must have separate visual semantics: never use additive, point-based forecast heatmaps that can be mistaken for observed satellite clouds.
- A side-panel rail can be geometrically aligned while still being non-functional: acceptance must perform a trusted pointer drag or keyboard resize and assert the panel's actual rendered width and persisted value changed.
- A shared API is not a shared product state: when two routes maintain separate model, location, time and cache state, cross-route navigation must be tested as a state round-trip.
- A side-panel visual alignment is not enough: the acceptance check must drag from the real rail in both directions, compare rendered width and `aria-valuenow`, then reload and verify the persisted width. Synthetic drag helpers may emit a double-click, so drag completion must be protected from accidental reset.
- Forecast controls and timeline cards must read the same selected-location hour. A restored location without a single-point forecast silently falls back to a grid average and makes the UI contradict itself; localStorage hydration needs an explicit forecast fetch.
- E2E planner assertions must use a valid encoded deep link and current semantic shell selectors. A malformed `name=...?...` URL or a stale class assertion can look like an application failure even when the live route is correct; retain the manual route check when the browser reports an intermittent load page.
- 2026-08-09: A matrix showing `—` in every parameter row must be traced through the selected location, ISO time, and forecast hydration before changing null rendering; vertical and horizontal scroll are separate acceptance behaviors and both need browser checks.
- 2026-08-09: A browser cannot load `localhost:3100` when no dev/container process is listening; always verify the port and `/healthz` app identity first. Keep 3000 reserved for the existing local service and use `scripts/start-local.cmd` or `start-local.ps1 -Port 3100` to start the app.
- 2026-08-09: Planner detail drawers can receive a valid location with no valid active hour; any display helper used after async pressure loading must be null-safe, and the empty state must render a marker instead of throwing during render.
- 2026-08-09: Navigation links are part of the hydrated DOM contract; never build first-render hrefs from a clock-dependent store snapshot. Use a deterministic server/client snapshot, then restore browser state after hydration.
- 2026-08-09: A selected point forecast is invalid when its model metadata differs from the active cloud model. Clear stale point data, pass the model through sampling, and discard late responses before updating the shared store.
- 2026-08-09: A planner detail drawer is not resizeable merely because its parent is right-aligned; acceptance must drag its actual left edge, assert rendered width and aria-valuenow, then reload and verify persistence.
- 2026-08-09: E2E weather fixtures must share the acceptance date and time domain with the product's tonight state; a stale fixture start can make a valid matrix selection look broken by triggering the timeline reset guard.
- 2026-08-09: Data-source status must separate required, optional, and unavailable-by-license capabilities; a missing optional map token is configuration guidance, while missing dark-sky assets must remain an explicit no-data state.
- 2026-08-09: A right-edge restore control must be tested together with top-right map controls; when their hit areas overlap, reserve a layout gap instead of relying on z-index or force-clicking tests.
- 2026-08-10: A 1/3/5/7-day selector is not linked merely because it renders more cards. Acceptance must assert the chart dataset/category count changes, the active night changes the single-night chart key, and the selected night/hour propagates to the shared cross-product URL state.
- 2026-08-10: An inbound deep-link location is only the initial selection, not permanent authority. After the user selects another planner location, cross-product links must prefer the current detail; selecting a no-data night must also clear the previous forecast ISO time.

- 2026-08-12: A public-site clone is not complete when the shell only has demo markers. Import the verified location and boundary snapshots first, then assert the exact Bortle-filter counts and stable IDs across map, detail, review, and export.
- 2026-08-12: Never leave a full weather description as a permanent tooltip on every dense map marker. Keep permanent labels to the target site's compact name label and move rating, source, and risk detail to hover/click/detail surfaces; always review a real screenshot after marker fan-out.
- 2026-08-12: A refresh button must reach the cache boundary. Passing a changing query parameter to a route is insufficient if the server cache key ignores it; thread an explicit force-refresh flag through route, client, and fetcher, then verify a real API response.
- 2026-08-12: Dynamic local dates must also be used by E2E assertions. A stale `2026-08-09` expectation failed correctly on the current `2026-08-12` Shanghai date; update the test to compute the runtime date instead of weakening the product's tonight-first behavior.
- 2026-08-12: For wide data exports, an “Excel” button should include the actual hourly fields and status semantics, not only a summary CSV. An Excel-compatible HTML workbook with full hourly columns is a useful dependency-free fallback when no XLSX library is installed.
- 2026-08-12: Dense map labels must never permanently expose per-location rain/cloud/rating prose. The map is for spatial orientation; move weather detail to the selected-location panel and keep the permanent label name-only.
- 2026-08-12: “只显示地点”也包括地点旁的风险徽标；如果用户要看牵牛岗、太子尖等名称，地图常驻层只保留名称和非文字定位点，警告与天气解释必须进入详情面板。
- 2026-08-12: “Complete clone” needs an explicit audit, not a blanket claim. Compare the live target's controls and states, mark intentional exclusions separately, and expose the remaining fidelity gaps in a reviewable route such as `/integration-plan`.
- 2026-08-13: A mobile matrix click can expose a time-domain race that desktop timing hides. Keep the E2E forecast fixture anchored to the runtime Asia/Shanghai date and do not let the forecast first-frame guard overwrite a valid selected night-hour ISO time.
- 2026-08-13: A Playwright web server wrapper must not spawn a second long-lived Node process on Windows. Run the Next standalone server inside the wrapper process so Playwright can terminate it and the full-suite exit code remains authoritative.
- 2026-08-13: A Docker worker built from the Web image inherits its HTTP healthcheck unless Compose overrides it. Give background workers a process-appropriate healthcheck and verify both services become healthy, not merely that the worker printed one successful refresh.
- 2026-08-13: Cross-page shortlist acceptance should select a marker that is actually inside the current map viewport, then assert the selected location name survives navigation. DOM order and Leaflet-generated accessibility attributes are not stable proxies for a user's clickable map point.
- 2026-08-13: GIBS time dimensions are identified by an OWS child element, not necessarily a `name="time"` attribute. Expand only the published ISO ranges and preserve gaps; subtracting fixed intervals from the latest timestamp fabricates observations.
- 2026-08-13: Recommendation validity must be gated by the field that drives the score. Wind or precipitation availability cannot make a night scoreable when most cloud-cover samples are missing.
- 2026-08-13: A location-only forecast cache can silently cross model boundaries. Every consumer must verify metadata.model or use a model-qualified key before displaying or scoring cached data.
- 2026-08-13: 全国地图在 200+ 个点位上不能使用永久 Leaflet Tooltip；即使 Tooltip 文本只有名称，也会形成白色气泡墙。默认只显示小型评分点，选中点才显示名称，评分档位必须连接真实过滤状态。
- 2026-08-13: “无法刷新”必须同时核对浏览器目标端口和 `/healthz` 应用身份；3100 正常而 3190 无监听时，先修复启动入口或提示用户，不要把连接失败归因于组件渲染。

- 2026-08-13: 评分门槛的数量不能只绑定整晚快照；地图时间滑窗必须传递完整 ISO 时次，使用独立缓存键和 focusScores，并在请求切换期间拒绝沿用上一时次的颜色与数量。
- 2026-08-13: 多个组件同时请求同一时次时，AbortError 或旧请求失败可能晚于新请求返回；加载/降级状态必须绑定请求代次（时次、模型、夜晚），不能只看最后一次响应是否曾失败。
- 2026-09-14: 跨午夜 E2E 天气夹具必须按 `currentNightKey` 锚定，而不是按公历当天 00:00；上海时间 00:00–05:00 仍属于前一晚 20:00–05:00，遗漏前四小时会把完整分层云样本误判为“数据不足”。
- 2026-09-19: 详情抽屉“能滚动”和卡片高度大于 44px不能证明数据完整可见；受限高度的 Flex 列会默认收缩子卡片，配合 `overflow: hidden` 造成内容裁切和后续区块视觉叠压。验收必须逐卡片断言 `scrollHeight <= clientHeight`、水平无溢出及相邻边界不相交，并覆盖用户截图对应宽度和长文案。
- 2026-09-24: 响应式验收不能只按宽度覆盖手机/桌面；宽而矮的横屏窗口可能继续套用桌面多行页头，把地图挤到首屏下方。需要单独覆盖真实短高视口（如 1653×413），同时量测页头/地图可视高度、日期完整性、焦点可见性和溢出；压缩视觉 chrome 时仍保持触控目标至少 48px、控制文字清晰可读，不能把“更小”误当成“更好”。
- 2026-09-24: 版本号调整必须同步 `package.json`、lockfile 根版本、根 `CHANGELOG.md` 和 `ChangelogModal` 当前条目；版本一致性测试应保留为发布门禁，不因版本 bump 的首次失败而放宽。
- 2026-09-24: `ChangelogModal` 首条版本项使用动态 `APP_VERSION_LABEL`；发布时必须把上一版本从“当前项”转为静态历史项。版本历史 E2E 应从 package version 读取当前徽标，并断言至少当前版和最近历史版本，避免下次升版后过期名称超时或上一版从 UI 消失。
- 2026-09-26: 手机地图页不能只靠改小字体改善布局。根因是页头品牌/四栏目/筛选抢占地图首屏、旧共享控制器主动关闭单指拖动和双指缩放，且抽屉用全屏模态遮住地图。修复应先确立“顶部搜索日期两行、地图为主、常驻三态底部数据面板、底部紧凑四入口”的区域所有权；地图与面板手势分离，保留按钮替代拖动，逐入口验证实际中心/缩放变化。E2E截图必须在当前源码重新 build 后运行，不能把旧 standalone 画面当新方案验收；`backdrop-filter` 会把 fixed 子导航约束在页头内，应去除或移出层叠上下文。
- 2026-09-26: 地图底部面板拖动后立即收起再触屏点空白处，浏览器发出 pointerdown/up 却可能抑制那次合成 click；只用 Leaflet `useMapEvents.click` 或原生 DOM click 都会让首击无响应。专题空白选点应在触屏 pointerup（位移≤8px）直接处理，并对随后同位置的合成 click 去重；排除点位、选点标记和地图控件。回归必须覆盖“拖面板→收起→立即点地图”，而不仅是新开页面单击。
- 2026-09-26: 固定 48px 的手机定位/筛选按钮若还塞“定位/筛选+”文本，200%文字放大会让相邻按钮的文字跨格截获点击，即使页面 scrollWidth 为零也不代表可操作。紧凑栏改为 SVG 图标＋完整 aria-label，避免靠裁掉文本伪装无溢出；200%压力测试须实际点击每个目标，而非只测外框。
- 2026-09-26: 来源说明从桌面页头移入手机数据面板后，WebKit 关闭弹窗未必把焦点还给新的触发按钮；仅依赖通用弹窗记录的 previousFocus 不够。新入口应持有自身按钮 ref，关闭后在下一帧显式 `focus({preventScroll:true})`，跨浏览器验证键盘出口和滚动位置。
- 2026-09-27: 三日模式若用首日日期标题展示“三日最佳”分数，数值真实也会把日期归属说错。专题排行行必须标分数实际取自的日子，标题写出覆盖区间；火烧云按该站点/当前晨昏阶段的最佳快照日定位，云海使用排行项随分数一起保存的 dateKey。
- 2026-09-27: 把专题详情放入共享手机面板后，必须同步取消详情卡原有的 `height:100%`、内部 overflow-y 和滑入动画；否则详情与面板各抢一份纵向手势。用实际 `.fireglow-site-detail/.cloudsea-site-detail` 与各自 scroll-content 类名定向覆盖，并验证详情到排行是一条连续滚动区。状态按钮跨 peek/half/full 消失时要把焦点交给仍存在的面板控制按钮。
- 2026-09-27: 多平台字体度量在 320 CSS px 时可比桌面宽数像素；云海详情卡的固有 flex 最小宽度会让卡片横向超出 2–7px。窄屏摘要列应换行、指标网格用 `minmax(0,1fr)`、卡片子项显式 `min-width:0` 并允许长中文回流；以 CI Linux Chromium 的 `scrollWidth <= clientWidth` 断言验收，不能只凭本机 Windows 截图。
- 2026-09-27: CI 的实时天气探针同时请求四个 Open-Meteo 模型和压力层，触发上游 `HTTP 429 · Too many concurrent requests`；本地单次通过不能证明 CI 探针稳定。探针应串行核验各必需来源，对 429 延长指数退避，持续失败仍让门禁失败；发布以当前提交的完整 CI 结果为准。
- 2026-09-27: 首页静态预渲染会把构建时的时次写入 HTML，而 `StoreProvider` 在服务端与浏览器分别于模块加载时调用当前时钟；跨小时打开公网后首次水合内容不同，React 报 #418，CI 在构建后立即测试容易漏检。首屏时间必须由服务端序列化给客户端作为同一初始快照，挂载后再同步真实当前时次；回归用浏览器时钟跨小时/跨日验证，并单列真实公网与夹具测试。
- 2026-09-27: 版本历史测试虽然从 `package.json` 读取当前版本，却把第 2 条历史卡写死为 v1.0.20；v1.0.22 正确新增 v1.0.21 历史卡后 CI 反而失败。测试应按当前语义版本推导相邻补丁版本，再只检查必要的更早历史项存在；发布前同步检查 Modal 真实卡片顺序。

- 2026-09-30: Jovi reported unusable weather after release and unequal product headers. Release acceptance must verify actual usable weather and all four desktop/mobile rendered headers; HTTP 200/build/test fixtures cannot substitute for production data or visual acceptance. If a required data check fails, resolve and report it before claiming completed deployment.
- 2026-10-01: When a candidate score is withheld, keep valid same-model raw weather and `sourceFetchedAt` visible with a precise missing-field reason; do not collapse this into a blank “数据不足” card. Verify the target candidate path end to end: provider cooldown/cache, source timestamp, stale flag, required night fields, score count, and rendered page. Provider health or a fixture alone is not candidate-data acceptance.
- 2026-10-02: A passing candidate-card test or live sample from nearby catalog points does not verify the screenshot's `StarWindowTable` or user-saved coordinates. Bind production acceptance to the deployed build and exact selected/candidate coordinates; use cache-only reads while cooldown status is unknown, and require same-model freshness, source time, required fields, valid scores, and rendered table before submission.
- 2026-10-02: Candidate batch failures with no same-model cache must remain distinguishable from missing scoring fields. Preserve the sanitized server reason and `Retry-After` in the table, keep scores withheld, and never add an automatic provider retry just to replace “数据不足”.

- 2026-10-02: Jovi 明确要求原目录 main 跟随远端；保护 Owner dirty 应先 ZIP/补丁备份并用本地保护分支保存，再安全 fast-forward 原目录。隔离分支集成后必须再次同步原目录 main，不能把“已保护”当成允许长期落后。旧分支按实际功能迁移或补丁等价性归并，不能整树覆盖新功能；最终 merge SHA 测试通过才可部署。

- 2026-10-02: 合并前浏览器门禁必须覆盖原存储地点恢复。hydration effect 的 loading dispatch 会触发自身依赖重跑，不能用 cleanup cancelled 标记丢弃自身请求；响应归属用 request/model/location guards 验证，并用延迟响应组件回归测试证明加载最终结束。

- 2026-10-02：浏览器接口成功但页面更新迟到时，先区分 Store 完成与 DOM commit，再用 CPU profile 找瓶颈。本轮 localDateKey 重复创建 Intl.DateTimeFormat 占用约11.9秒；按时区有界复用后原失败场景1.7/2.0秒通过。不得靠延长等待冒充修复。


- 2026-10-02 Jovi纠正：高频日期/时段选择必须直接常驻顶部，不用调整按钮隐藏选项再弹出覆盖地图的界面。统一Header高度不能靠隐藏核心操作实现；使用正常文档流顶部工具栏，手机两行，实测未点击前即可选择和不会遮挡地图。


- 2026-10-02 Jovi再次纠正：日期选择不是大面积卡片。桌面必须按内容宽度排列，禁止用1fr/width100%把少量选项铺满宽屏；32px紧凑视觉尺寸，实测3840px每个选项仍短小。手机仅按空间自然换行，不能强制为每组分配整行。验收除可见/无溢出外必须限制控件宽度与密度。


- 2026-10-02：核心控件迁移后，定向几何测试绿灯不能替代完整Chromium门禁。同步迁移全部旧弹层定位器，保留数据请求/排行日期/地图与失效数据门禁；请求计数必须区分候选BestMatch与地图模型，不能混计为重复请求。完整CI有失败时必须标CHANGES_REQUIRED，不宣称全套浏览器通过。


- 2026-10-04 Jovi纠正：单坐标真实天气与评分通过，不代表整批候选地点页面恢复。每次交付需验证候选批量响应、实际页面、源时间、过期标志和有效评分；未完成页面验收必须明确保留未关闭缺陷。

- 2026-10-04: 可点击卡片包含日期/删除按钮时，外框不能同时 role=button 并捕获冒泡 Enter/Space；使用非交互分组和独立原生选择按钮。axe 通过只是语义门禁，还需验证子控件键盘操作不误选父卡。开放PR不能代表最新基线，先比较main新增恢复/缓存修复及精确CI终态，再安全整合原分支。

<!-- Preserved append-only Owner notes from main48f5562, originally2026-10-04 -->

- 2026-10-04 Jovi要求独立Agent全面审核：作者自测不能替代独立审核。交接必须提供精确基线、远端与部署地址、UI和数据全链路场景、未确认问题、证据边界及只读审查范围，不把历史单点或mock通过冒充整批生产验收。

- 2026-10-07 Jovi再次纠正：手机不应以大结论、固定高摘要和单列空值卡占用信息区。检查最终导入CSS、独立事实与评分耦合、面板唯一滚动容器；真实手机证据不能由375px模拟代替。

- 2026-10-07：独立复核发现client坐标仅条件比较会放过缺请求身份；显式有限坐标或严格旧API坐标ID匹配后再绑定本地点，刷新恢复也要同步当地时钟。
- 2026-10-07：移动文字200%时innerWidth可能跟随溢出扩大，不能以scrollWidth−innerWidth零当无溢出；检查clientWidth/visualViewport，输入框min-width0。地图缩小后固定tap坐标可能命中标记，必须观察真实事件目标，不能猜是地图未ready。

### 2026-10-07 Jovi 发布要求纠正
- 最终候选测试通过即继续已授权部署，不再因重复许可问题停下。Git读写认证、gh登录、公开API限流和网页连接分别核实；某一路失败不能概括成GitHub登录失效。远端生成结束后主动读取实际审核结论，不以旧等待状态停止。

### 发布内容一致性
- 低内存发布不能仅覆盖旧镜像目录：必须完整替换构建目录，验收服务实际HTML与打包HTML一致。健康SHA、原始天气可用、定向fixtures均不能替代正式页面检查。
- 验收容器的非敏感缓存路径需与生产相同；读缓存时模型、地点、天数都必须匹配，不能硬编码14天后将cache miss误判为代码缺陷。

### 2026-10-07 远端主导职责纠正
- 远端承担完整阶段审核/修复/计划/实施/GitHub提交，本地接收验证部署和证据回传；不得用本地业务实现静默替代。远端缺能力时必须核实并请求必要配置，不能派微任务后停止。未达到全盘无问题验收不得暂停循环。

### 云端任务启动验收
- create_thread(chatgptWorkCloud)成功不代表挂载了代码执行环境。必须核查工作目录、GitHub写入工具和实际测试/commit证据；不要把只读权限检查的秒级回复称为大阶段执行。GitHub-only的用户新指令覆盖旧Project本地只读连接前置要求。

## 2026-10-08 原目录约束
Jovi要求使用E:/project/Star_photo_addr并保持main同步；后续默认在原目录工作。不要默认创建C盘worktree。发现Owner修改先保护，禁止reset/clean/stash覆盖。
