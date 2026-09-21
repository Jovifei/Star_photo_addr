# 逐星：手机和平板浏览器布局审计与候选修复

状态：**READY_FOR_LOCAL_INTEGRATION_VALIDATION，不是生产验收通过。**

## 1. 范围与基线

本轮基于 `codex/mobile-document-scroll-20260921` 的精确提交 `349db7b5ba320593724f2a084f6b2228489b6fb7`，其父提交为 S3 修复 `ec5abdd72cb73666c12e655b829e275134420dbe`。新工作分支为 `codex/mobile-content-flow-audit-20260921`。没有从旧 `main@3334e0c` 重做，没有回退之前的火烧云/日期/S3 修复。

用户提供了此前审计和部署的文字记录，**本轮没有收到原始八张截图**。下面是对最新发布分支源码的审计，加上明确标注的离线组件验证，不是对那八张图的逐张重新验收。当前环境不能读取用户的本地工作树，也没有操作用户手机或生产服务器。

## 2. 用户的主任务与本轮布局原则

手机端优先顺序为：当前地点/时段 → 地图与判断 → 需要时查看证据和设置。保留四个产品入口及真实选中日期，不能用缩小到难读的文字、隐藏错误或取消触控空间来制造“首屏变简洁”。

页面本身保留浏览器原生纵向滚动；仅打开详情对话框时，正文在面板中滚动并锁住背景。地图拖动是显式可退出的模式，不能长期截获页面手势。地图和二维表格允许局部二维操作，不应迫使整篇文字同时左右/上下滚动。

## 3. 源码发现与修改对照

| ID | 页面/范围 | 基线问题及依据 | 本轮处理 | 验证状态 |
|---|---|---|---|---|
| M01 | 首页、暗夜选址 | `MapSearchCard` 的筛选展开按钮独占一整行；搜索、定位后仍多占约一个控件行 | 搜索、定位、筛选在普通文字尺寸下同一行；详情展开后才占整行；48 CSS px 触控区域、16px 搜索输入 | 已改代码；离线布局断言通过；完整应用待验 |
| M02 | 火烧云、云海 | `ProductHeader` 内所有时段、日期、总览、刷新都默认展开，控制区抢占主要内容空间 | 增加“调整”披露入口；收起时保留原有 active 日期/时段，不生成另一套摘要值；完整选项与刷新在展开后可达 | 已改代码；离线披露断言通过；原 E2E 操作流程需更新 |
| M03 | 云海/专题根容器 | 通用 `.app-shell` 与专题 `.cloudsea-root` 的 fixed viewport/overflow 规则有层叠竞争；组件 CSS 后加载存在重新锁住页面的风险 | 最终 compact 层使用产品根容器限定的更高优先级选择器，不只依赖 CSS 加载顺序 | 已改；离线注入晚到根样式仍可滚动；实际路由切换待验 |
| M04 | 平板时间轴 | 基线桌面 `.cloud-timeline-toggle` 是 absolute/translateX，较窄断点曾重置，但 981–1199px 的新网格规则没有完整重置定位 | 所有 compact 尺寸明确 static、inset:auto、transform:none，按钮在网格内占位 | 已改；320–1024 与横屏隔离断言通过 |
| M05 | 地图工具/今晚判断 | 地图抽屉没有背景文档锁；面板内部与背景存在滚动串扰风险 | 新增引用计数滚动锁，保存并恢复原页面坐标和内联样式；只在实际打开的 compact 面板生效 | 已改；实际 DOM helper 离线测试通过 |
| M06 | 详情交互 | 焦点恢复没有 preventScroll；切换工具页签反复强制聚焦关闭键；专题详情只在挂载时判断一次宽度 | 焦点恢复不滚动；锁/首次聚焦按打开状态管理；媒体查询变化自动切换锁；桌面保留 Escape 关闭，不强制 Tab 陷阱 | 已改；helper 离线测试通过，React 层焦点链待全应用测试 |
| M07 | 手机横屏面板 | 底部面板高度规则叠在先前横屏侧栏宽度上，展示形态不统一；关闭变换也可能扩大滚动范围 | 竖屏 bottom sheet，短横屏全高侧栏；关闭态局部裁切；快捷工具与详情入口在地图底部错开排布并验证不重叠；保留减少动画设置 | 已改；离线边界检查通过 |
| M08 | 三个地图的手势 | 开启“移动地图”后，只靠再次点按钮退出；原 doubleClickZoom 未随页面模式统一管理 | 完成按钮、Escape、点地图外均可退出；恢复每个 handler 的原始状态，不强行开启原本禁用的功能 | 已改；真实 DOM 控制器离线测试通过 |
| M09 | 地图尺寸变化 | 现有共享 MapScrollControl 不处理容器自身尺寸变化；仅靠窗口变化不足以覆盖所有重新布局 | 增加 ResizeObserver，按帧合并，尺寸真的变化且大于0才 invalidateSize；清理订阅 | 已改；仅验证回调调用，不宣称真实瓦片空白已消失 |
| M10 | 专题地图图例 | 图例 absolute 浮在地图内，窄屏多项说明遮画布、靠近底部署名 | compact 时图例成为地图后的正常文档内容，可换行；地图有独立稳定高度 | 已改；隔离几何检查通过 |
| M11 | 专题排行/正文 | 长列表继续受局部容器高度/滚动约束，会形成“小窗口滚动” | compact 排行和列表解除局部高度限制；保留主页面滚动，面板正文例外 | 已改代码；真实长列表性能待验 |
| M12 | 样式维护 | 原规则通过 `.segmented:nth-child(2)` 猜测日期控件结构 | 新层不再依赖第几个兄弟节点，使用主题容器/展开状态/真实 active 选项 | 已改代码 |

M03/M05/M09 中的运行表现以“静态风险”描述；没有成功重现生产截图时，不把代码推断冒充生产实测。

## 4. 数据展示与画布：明确没有解决的项目

| ID | 核查结论 | 后续验收要求 |
|---|---|---|
| D01 | `CloudTimeline.forecastQualityLabel(source, stale)` 仍主要根据“有没有来源”和 stale 判断“可用”，不能证明能见度等评分字段完整 | 同一选择的模型、时次和地点分别表达“天气可展示/评分可用”；缺字段不得称完整可用。此文件本轮未改 |
| D02 | `CloudSeaApp.fetchSnapshots()` 对日期变化没有完整的请求代次/中止保护，旧请求的 notice/loading 可能覆盖新选择；代码仍有短间隔二次请求 | 注入延迟乱序、切日期、429 和部分 pressure，确认旧响应不能更新新选择的状态。这是静态风险，本轮未做生产复现/数据链修改 |
| D03 | 火烧云 stale 快照及失败后保留地图与排行的对应关系仍需逐条回放；不能只检查 HTTP 200 或容器健康 | 按日期/时段检查地图色面、列表、详情和 stale 提示一致；未校准条件指数不能叫概率 |
| D04 | 黑/白画布可能来自容器尺寸，也可能来自瓦片请求、图层覆盖、网络或上游无数据 | 本轮补充尺寸通知，不保证 OSM/NASA/VIIRS 可用；真实瓦片失败必须有明确状态，不能画假天气层 |
| D05 | 原八图中的标签拥挤、具体值/单位是否正确、个别图例截断和长名称，需要原图或当前完整页面才能逐项对照 | 本轮未收到八图，不记录“八图全部修好” |

上述数据项不能为了移动 UI 美观而被隐藏或绕过。算法、Provider、默认模型、API、评分权重、stale 门槛和 `.env` 本次均未修改。

## 5. 验证证据与限制

当前容器 Node 22.16.0，项目要求 Node >=24。GitHub connector 可以读写源码，但容器 DNS 无法取得全仓依赖；浏览器本地 HTTP 导航也被策略拒绝。本轮没有运行 npm ci / 全仓 check / 原有完整 E2E / Firefox-WebKit / Docker / 真实上游 / 真机测试。

实际执行：

| 验证 | 结果 | 准确含义 |
|---|---|---|
| 2 个新增纯 DOM helper 的 strict tsc | PASS | 有限模块类型检查，不等于全项目类型检查 |
| 7 个 TS/TSX 源文件 transpile 语法检查 | PASS | 不解析项目 React/Next/Leaflet 依赖 |
| 新 E2E 文件语法检查 | PASS | 测试源码可解析，测试未执行 |
| CSS PostCSS 解析 | PASS | 不等于所有旧样式组合都正确 |
| 系统 Chromium 离线 DOM/CSS 契约断言 | **145 passed / 0 failed** | 使用实际候选 CSS、真实 helper、代表性 DOM 及 mock map handler；不是 Next/Leaflet 全应用 |
| 离线图像检查 | 已查看首页、滚动后、专题与面板夹具 | 图上始终标明“不是生产页面截图”，没有真实天气/瓦片 |

离线宽度覆盖 320/375/390/430/768/1024、812×375 横屏、1440 桌面；检查触控、单指 CDP 手势、页面位移、锁的引用计数、旋转、恢复位置、地图模式退出、尺寸通知、图例流布局和 reduced-motion。145 是分项断言数量，不是145个端到端业务场景。不得把历史352项通过复用为本次候选结果。

新增 `tests/e2e/mobile-content-flow.spec.ts` 用原项目 API mock，在真实应用里验证新交互。**现有 E2E 中直接点未选中日期/时段、直接点顶部隐藏筛选的路径，需要先展开“调整/筛选”再操作。**本轮未取得并改完所有旧用例，不得删断言、加 skip 或全局自动展开来掩盖差异。该项是接收阻断门槛。

## 6. 技能选择与引用

`349db7b` 分支读取 `.agents/skills/ui-ux-pro-max/SKILL.md` 返回404，不能说该本地路径已随远端存在。已阅读公开上游 `nextlevelbuilder/ui-ux-pro-max-skill` 的 SKILL 与 quick-reference，采用其内容优先、渐进披露、触摸/滚动冲突、焦点和 reduced-motion 指南；没有运行其本地搜索数据库脚本，也没有复制完整技能或引入新依赖。

新增本项目技能 `.github/skills/zhuxing-mobile-web/SKILL.md`，供本地 Codex 在以后修改时复用。48 CSS px 是本项目触控目标，不能混称 WCAG 的统一最低要求，也不能把 Apple pt/Material dp 直接当 CSS px。

参考：
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/references/quick-reference.md
- https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- https://developer.apple.com/design/human-interface-guidelines/layout

## 7. 发布边界

只提交新分支供本地集成审查；不合并 main，不部署，不升级已发布版本号，不修改工作树以外的用户文件或数据卷。完整接收和验收流程见 `docs/handoff/2026-09-21-mobile-content-flow-CODEX.md`。
