> Historical archive retained 2026-10-02 from `ef15634`. This records an earlier proposal or verification; current source, latest handoff and current release evidence take precedence. No historical PASS establishes current production acceptance.

# 2026-09-18 手机端响应式布局与参数显示优化

## 目标与已锁定决策

- 目标：让逐星四个正式入口在手机浏览器、手机 App 内嵌浏览器、平板和桌面浏览器中保持清晰、可操作、无横向溢出，并优先呈现“今晚能不能拍、去哪里拍、几点拍”。
- 已锁定决策：
  - `1A`：手机端详情使用底部详情抽屉；地图保持主视图，详情抽屉独立滚动。
  - `2A`：主页、暗夜选址、火烧云、云海四个入口统一优化。
- 视觉参考：保留云海页面现有的“评分 → 山顶/云层关系 → 气象指标 → 拍摄方案”信息层级；不直接复制当前云海移动端的堆叠布局，因为它存在详情卡 flex 压缩问题。

## 基线、证据和边界

- 基线：`main@3334e0c08f9ab2e481277628ce4ee875e2f1039e`，版本 `v1.0.18`，开始实施前必须再次确认工作树干净。
- 当前只读浏览器证据：
  - 主页 `390x844`：命令栏约 `422px`，地图视口约 `191px`，导航实际宽度约 `98px`，地图内部滚动宽度约 `740px`。
  - 云海 `390x844`：顶部约 `235px`，地图约 `439px`，排行约 `405px`；详情加入后，详情滚动内容约 `1200px`，但容器约 `441px`，垂直剖面卡发生 flex 压缩。
  - 主页 `1024x768`：输入栏约 `300px`、地图约 `364px`、证据栏约 `360px`，三栏对平板横屏过于拥挤。
- 本轮只允许改变展示层、响应式结构、交互可达性和回归测试；不得改变评分算法、天气/卫星/光污染数据源、缓存、地点目录、URL 状态协议、数据缺失语义或生产配置。
- 不自动提交、推送、合并、部署，不改 `main`，不修改凭据和生产 `.env`。任何需要改变数据或路由语义的发现都必须停止并重新确认。
- Open-Meteo 429 只作为数据降级测试输入；视觉回归必须使用固定 fixture，不能把实时数据可用误当作布局通过。

## 响应式契约

- 断点固定为：手机 `<=767px`，平板 `768–1199px`，桌面 `>=1200px`；短横屏额外覆盖 `(max-height:520px) and (max-width:1024px)`。
- 验收视口固定包含：`375x812`、`390x844`、`414x896`、`844x390`、`915x412`、`768x1024`、`1024x768`、`1280x800`、`1440x900`。
- 手机和平板采用地图优先结构：共享头部、紧凑参数区、地图/时间轴、一个地图工具抽屉；不渲染主页输入栏和证据栏的三栏列宽。
- 桌面保留主页“输入栏 / 地图画布 / 证据栏”三栏；专题页保留地图、排行、详情的桌面布局。
- 所有模式遵守：关键按钮和滑块触控高度至少 `44px`；尊重安全区；页面级 `scrollWidth` 不得超过视口；表格只在局部容器滚动；数据数字使用等宽数字和单位；未知值继续显示 `—`/“数据不足”。

## 实施步骤

### 1. 先建立 RED 回归和共享壳层契约

- 目的/前提：先把当前 375/390/768/1024 的布局缺陷固定成行为证据，再开始改 CSS；确认基线和端口身份正确。
- 主要文件：新增 `tests/e2e/responsive-layout.spec.ts`；必要时扩展 `tests/e2e/workspace-shell.spec.ts`、`tests/e2e/mobile-panel-dock.spec.ts`、`tests/e2e/product-integrity.spec.ts`。
- 断言：四个导航入口完整可达；主页核心参数直接可见；手机/平板工具抽屉可打开关闭；详情抽屉支持 Escape/遮罩/关闭按钮；页面和地图容器无横向溢出；详情内容不会被 flex 压缩。
- 证据命令：先运行 `$env:PORT='4178'; npm.cmd run test:e2e -- tests/e2e/responsive-layout.spec.ts`，预期当前基线对新增几何断言出现可解释的 RED；不允许用放宽断言替代修复。
- 失败处理：若测试连到非逐星服务、`/healthz` 身份不匹配或数据 fixture 未接管，立即停止并修正测试环境；不得诊断成产品回归。
- 状态标签：`RED_BASELINE`，只能证明缺陷可复现，不能证明功能完成。

### 2. 修复共享头部、断点和地图工具容器

- 目的：解决手机导航被 flex 压缩、专题控制器占满三行、平板仍被硬塞三栏的问题。
- 主要文件：`src/app/globals.css`、`src/app/theme-unified.css`、`src/components/workspace/workspace-shell.css`、`src/app/mobile-map-controls.css`；只有需要语义调整时才改 `src/components/ProductHeader.tsx` 和 `src/components/ResponsiveMapControls.tsx`。
- 实现口径：
  - `.app-header` 在手机固定为“品牌/信息入口行 + 四项导航行”，导航可以局部横向滚动，但不能被压缩成不可识别的窄胶囊。
  - 统一当前 `.app-header` 规则与遗留 `.topbar` 覆盖关系，禁止继续叠加互相冲突的旧选择器。
  - `<=1199px` 进入地图优先壳层；手机和平板工具均使用一个抽屉，短横屏使用紧凑头部和紧凑工具轨道。
  - 地图画布、插值 SVG、时间轴和工具轨道使用明确裁切边界，内部不产生 700px 级无意横向内容。
  - 所有抽屉关闭后恢复触发控件焦点，尊重 `prefers-reduced-motion`，不阻断系统返回手势。
- 证据命令：先跑共享壳层 focused E2E，再跑 `npm.cmd run lint` 和 `npm.cmd run typecheck`。
- 失败处理：若发现需要变更 URL、store、评分或数据状态才能满足布局，停止，不越过本计划边界。
- 状态标签：`SHELL_LAYOUT_PASS`，只证明共享壳层和交互几何通过。

### 3. 重排主页手机参数区并恢复地图可用高度

- 目的：保留用户已确认的“核心筛选直接可见”，同时把当前约 422px 的命令栏压缩到可读的两层结构。
- 主要文件：`src/components/MapSearchCard.tsx`、`src/components/RecommendationQuickControls.tsx`、`src/components/BortleFilterBar.tsx`、`src/components/CloudTimeline.tsx`、`src/components/workspace/workspace-shell.css`。
- 实现口径：
  - 搜索与“我的位置”在手机同一主操作行；搜索可伸缩，定位保持至少 `44px` 命中区。
  - 评分时间和推荐门槛作为第一层参数；B1–B4 作为第二层 `2x2` 控件；推荐开关占整行并保留完整语义。
  - 不删除 B1–B4、时间、门槛或推荐开关，不把核心参数藏入低频设置页；窄屏允许文字换行，不用不可读缩写。
  - 时间轴继续使用当前选中时次，静态光污染图层不显示误导性的逐小时预报控制。
  - 在 390x844 下地图视口至少保留 `280px` 可用高度；在短横屏下优先保证地图和当前时次栏可见。
- 证据命令：运行主页 focused E2E、四档几何断言和截图检查；再运行 `npm.cmd run test:e2e -- tests/e2e/workspace-shell.spec.ts tests/e2e/mobile-panel-dock.spec.ts`。
- 失败处理：若参数状态、LocalStorage 或选中时次发生变化，回滚展示改动并检查是否误动共享 store；不能通过删除状态断言来“修复”。
- 状态标签：`HOME_RESPONSIVE_PASS`，只证明主页展示与交互通过。

### 4. 统一火烧云/云海专题页与手机底部详情抽屉

- 目的：让两个专题页都采用“地图 → 排行 → 手机详情抽屉”的一致路径，并修复云海详情卡被压缩/截断的问题。
- 主要文件：`src/app/cloudsea/CloudSeaApp.tsx`、`src/app/cloudsea/CloudSeaSiteDetail.tsx`、`src/app/cloudsea/cloudsea.css`、`src/app/fireglow/FireglowApp.tsx`、`src/app/fireglow/FireglowSiteDetail.tsx`、`src/app/fireglow/fireglow.css`；如共享逻辑重复，新增内部 `src/components/ResponsiveTopicDetail.tsx`。
- 内部抽屉接口固定为：`open`、`label`、`onClose`、`tone`、`children`；它只负责移动端遮罩、底部定位、焦点、Escape、滚动和关闭，专题数据 props 保持不变。
- 实现口径：
  - 手机详情使用 `role="dialog"`、`aria-modal="true"`、可见关闭按钮和明确的焦点返回；桌面保持现有详情列。
  - 详情抽屉最大高度为 `72dvh`，内容区独立滚动；所有详情卡使用 `flex: 0 0 auto`、`min-width:0` 和长文本换行，禁止再次被压成 28px 等异常高度。
  - 云海保留评分、山顶/云层相对层位、云顶/云底、压力剖面置信度、湿度、风速、逆温、日出/日落和拍摄方案；火烧云保留评分、晨晚霞窗口、云层、能见度、方位和拍摄建议。
  - 排行卡在 `<=400px` 下将长说明改为可读的分行信息；评分、位置判断、日期/时段、单位和“数据不足”优先，来源与 Beta 说明次级展示但不删除。
  - 云海/火烧云卡片必须可由键盘和屏幕阅读器触发，不能依赖当前仅有的 `div onClick`。
- 证据命令：使用固定 CloudSea/Fireglow fixture 运行专题 focused E2E，覆盖未选中、选中、切换时段/日期、数据不足和详情关闭；再跑移动/桌面截图。
- 失败处理：若专题排序、分数、位置层位或数据不足语义变化，停止并恢复为只改布局的最小差异。
- 状态标签：`TOPIC_DETAIL_PASS`，只证明专题布局、参数显示和详情交互通过。

### 5. 全量验证、文档和交接

- 目的：在不把本地 fixture/构建绿灯升级为真实预报准确率的前提下，完成可审计的候选验证。
- 命令顺序：
  1. `npm.cmd run check`；
  2. `$env:PORT='4178'; npm.cmd run test:e2e`；
  3. `npm.cmd run test:e2e:cross-browser`；
  4. 生成并人工检查 375/390/414、短横屏、768、1024、1280、1440 截图；
  5. 如需实时数据，只运行既有 `npm.cmd run test:live`，将 429 保留为 `BLOCKED/DEGRADED`，不改变视觉测试结论。
- 必须记录：每条命令退出码、测试文件/通过/跳过/失败数量、截图路径、`/healthz` 身份、是否使用 fixture、任何 NOT_RUN/BLOCKED 原因。
- 文档：验证通过后再新增本轮 `docs/engineering-change-log/` 记录，并回填 `tasks/todo.md` Review；发现新的防错规则才追加 `tasks/lessons.md`。
- 发布边界：本计划结束只形成本地候选和验证报告；提交、推送、合并、部署需要另外的明确授权。
- 状态标签：`RESPONSIVE_CANDIDATE_VERIFIED`；只有真实手机验收通过才可另记 `DEVICE_VERIFIED`，不能从本地浏览器推导。

## 停止条件与回滚

- 工作树出现非本计划变更、基线 SHA 改变、端口身份不匹配、测试 fixture 未接管、需要改数据/评分/API/URL，立即停止并报告。
- 每个实现增量都在独立 `codex/` worktree/分支中完成；回滚优先丢弃该隔离候选，不触碰 Owner 的 `main` 和用户数据。
- 实现已获授权并完成于隔离候选；当前状态为 `RESPONSIVE_CANDIDATE_VERIFIED_PENDING_HANDOFF`，尚未提交、推送或部署。
