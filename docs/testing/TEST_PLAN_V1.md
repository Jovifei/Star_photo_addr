# 《逐星》详细测试方案 V1.0

> 文档状态：已批准实施  
> 适用仓库：`Jovifei/Star_photo_addr`  
> 适用产品：逐星（今夜观测 / 暗夜选址 / 观星计划）  
> 基线：`main@94043d8715faefd79306c77998741cad44425da9`  
> 更新时间：2026-08-20

## 1. 测试目标

测试不是为了堆积用例，而是阻止以下高风险问题进入生产：

1. **错误观测结论**：地点、日期、观测夜、时次、模型或云层错位；
2. **假正常**：第三方接口返回 200，但字段缺失、数组错位或全部为空，页面仍显示可用；
3. **刷新竞态**：旧地点、旧模型或旧时次的慢响应覆盖用户的新选择；
4. **数据语义混淆**：卫星实况被当成未来预报，VIIRS 夜光被当成现场 Bortle/SQM；
5. **移动端不可用**：浮层遮挡、按钮不可点击、抽屉无法收起、横向溢出；
6. **部署不可靠**：Docker、Nginx、数据卷、Worker、HTTPS 或海外数据源出口异常；
7. **不可诊断**：错误没有 request/cache/stale 信息，无法定位线上问题。

## 2. 测试范围

| 模块 | 主要对象 |
| --- | --- |
| 今夜观测 | 地点、地图、云量、卫星云图、光污染、72 小时时次、数据源状态 |
| 暗夜选址 | 当前视野推荐、编号标记、Bortle、海拔、筛选、候选地点 |
| 观星计划 | 多地点、多夜晚、连续窗口、排行、详情抽屉、候选管理 |
| 数据接口 | forecast、pressure、satellite、light pollution、AQI、Kp、geocode、snapshot |
| 缓存刷新 | fresh、stale、强刷、冷却、并发合并、请求取消、旧值回退 |
| 非功能 | 兼容性、视觉、无障碍、性能、压力、安全、可观测性 |
| 部署 | Docker、Compose、Nginx、TLS、健康检查、Worker、数据卷、阿里云出口 |

### 2.1 科学与数据边界

- Himawari 属于卫星观测，不是未来预报；
- VIIRS 视觉夜光只用于人工夜光空间参考，不等于实时光污染；
- 未安装授权本地暗夜栅格时，不显示或推导 Bortle/SQM 数值；
- Kp 是全球行星指数，不等于某个地点的极光概率；
- 推荐地点不替代雷电、道路、地质灾害、景区管制与现场安全判断；
- 参考站点只用于产品结构与交互参考，不用于校验天气或评分真值。

## 3. 缺陷等级

### P0：阻断发布

- 地点、日期、模型或时次错位；
- 旧响应覆盖新选择；
- 无数据时生成假的评分、Bortle 或 SQM；
- 卫星云图、夜光与数值预报串用；
- 核心页面崩溃或无法操作；
- Docker 无法启动或 `/healthz` 失败；
- 敏感信息、内部 URL、Token 或堆栈泄漏。

### P1：正式发布前必须解决

- 重复上游请求或刷新风暴；
- stale 数据未标记；
- 429/502/503/504 没有可理解反馈；
- 移动端浮层遮挡或按钮不可点击；
- 工作区跳转丢失地点、模型、时次或候选状态；
- iPhone Safari 核心流程不可用；
- 排序不稳定或缓存键串数据。

### P2：可进入后续迭代

- 次要文案、间距、动画；
- 非关键 Tooltip；
- 低频视口的轻微布局问题；
- 不影响流程的轻度性能问题。

## 4. 测试分层

| 层级 | 对象 | 网络 | 执行时机 |
| --- | --- | ---: | --- |
| 单元测试 | 评分、排序、时间、坐标、缓存决策 | 否 | 每次提交 |
| 契约测试 | 上游 JSON/XML 到内部模型 | 否（Fixture） | 每次提交 |
| API 集成测试 | 状态码、响应头、缓存、异常 | 否（Mock fetch） | 每次提交 |
| 组件测试 | loading/error/empty/keyboard | 否 | 每次提交 |
| Chromium E2E | 用户完整流程 | 主要 Mock | 每次 PR |
| 跨浏览器 E2E | WebKit / Firefox 核心流程 | 主要 Mock | 夜间/发布前 |
| 视觉回归 | 遮挡、错位、响应式 | 否 | 每次 PR |
| 无障碍 | 语义、焦点、键盘、对比度 | 否 | 每次 PR |
| 真实数据源冒烟 | Open-Meteo/NASA/NOAA | 是 | 定时/发布前 |
| 性能与压力 | LCP/CLS/INP/API p95/并发 | 可选 | 夜间/每周 |
| 生产冒烟 | 域名、TLS、容器、出口网络 | 是 | 每次部署后 |

建议目录：

```text
tests/
├── unit/
├── contract/
├── integration/
├── component/
├── e2e/
├── visual/
├── accessibility/
├── performance/
└── fixtures/
    ├── open-meteo/
    ├── gibs/
    ├── noaa/
    ├── geocoding/
    └── malformed/
```

## 5. 测试环境矩阵

### 5.1 每次 PR

- Node.js 24；
- Chromium Desktop：1440×1000；
- Chromium Mobile：375×812；
- Next.js production build；
- Mock 上游数据；
- Docker production image；
- Compose + Nginx 配置检查。

### 5.2 夜间或发布前

- WebKit iPhone 核心流程；
- Firefox Desktop 核心流程；
- 320×568、390×844、768×1024、1024×768；
- 真实 Open-Meteo、NASA GIBS、NOAA SWPC；
- Lighthouse；
- 30 分钟 soak test。

### 5.3 阿里云生产

- ECS 内部 DNS、TCP、TLS、TTFB；
- 正式域名与证书；
- 80→443；
- Docker 重启与数据卷；
- Worker 快照更新；
- 中国大陆访问海外数据源稳定性。

## 6. 测试数据策略

### 6.1 固定 Fixture

必须至少保存：

- Open-Meteo 正常天气；
- 四层云量缺失、错位、全空、非法数值；
- GIBS 正常 capabilities、缺图层、缺 `ResourceURL`、非法 XML；
- AQI 正常、全空、错位；
- NOAA Kp 表格/对象两种格式、非法格式；
- 地理编码正常、同名、空结果、非法坐标；
- 429、500、503、超时、HTML 响应。

### 6.2 测试原则

- E2E 地图瓦片与天气优先 Mock，避免截图漂移；
- 真实数据测试只验证接口契约和基本可用性，不断言具体天气数值；
- 日期测试使用固定时钟；
- 不让测试依赖执行机器的本地时区；
- 所有排序测试必须验证稳定性。

## 7. 模块用例

### 7.1 导航与跨工作区状态

| ID | 场景 | 预期 | 等级 |
| --- | --- | --- | ---: |
| NAV-001 | 首页打开 | 今夜观测高亮 | P0 |
| NAV-002 | 首页→暗夜选址 | 地点、模型、时次保留 | P0 |
| NAV-003 | 暗夜选址→观星计划 | 候选地点保留 | P0 |
| NAV-004 | 观星计划→首页 | 地点/模型保留，过期时次清理 | P1 |
| NAV-005 | 浏览器后退/前进 | URL 与页面状态一致 | P1 |
| NAV-006 | 无痕窗口打开分享 URL | 无 localStorage 也可恢复基本上下文 | P1 |
| NAV-007 | 中文地点名 | 编解码正确 | P1 |
| NAV-008 | 无关/恶意参数 | 不反射、不开放重定向 | P0 |

### 7.2 地点搜索与地理编码

- GEO-001：正常中文地点返回候选；
- GEO-002：同名地点显示区域区分；
- GEO-003：不存在地点显示空状态；
- GEO-004：输入前后空格被规范化；
- GEO-005：快速输入时旧请求被取消或忽略；
- GEO-006：上游超时后有明确提示；
- GEO-007：429 不清除已有地点；
- GEO-008：非法经纬度被过滤；
- GEO-009：HTML 响应不崩溃；
- GEO-010：拒绝定位权限仍可搜索。

### 7.3 天气与云量

#### 契约

- WX-001～005：时间轴、总云、低云、中云、高云任一缺失均降级；
- WX-006：云量数组与时间轴长度不同，拒绝；
- WX-007：数组全 `null`，不可用；
- WX-008：混入字符串，拒绝；
- WX-009：NaN/Infinity，拒绝；
- WX-010：时间重复或乱序，规范化或拒绝；
- WX-011：降水概率与降水量不混淆；
- WX-012：风速缺失只影响对应指标。

#### 用户流程

- WX-020：ICON→GFS 后只显示 GFS；
- WX-021：旧模型慢响应不能覆盖新模型；
- WX-022：72 小时播放不重复请求相同天气序列；
- WX-023：23:00→00:00 日期正确；
- WX-024：20:00–05:00 归属同一观测夜；
- WX-025：超出模型时效明确提示；
- WX-026：503 + 旧缓存，保留并标 stale；
- WX-027：503 + 无缓存，显示不可用；
- WX-028：连续刷新十次只产生一次有效强刷；
- WX-029：新地点加载期间不把旧值标成新地点；
- WX-030：刷新失败不清空旧云量画布。

### 7.4 卫星与 GIBS

- SAT-001：正常 capabilities 可识别所需图层；
- SAT-002：缺 `ResourceURL` 降级；
- SAT-003/004：缺 Himawari/VIIRS 分别降级；
- SAT-005/006：云图与夜光切换失败不串帧；
- SAT-007：并发 capabilities 只下载一次；
- SAT-008：强刷失败后立即重试命中冷却；
- SAT-009：有旧 XML 时使用 stale-memory；
- SAT-010：超过原生 zoom 使用 overzoom；
- SAT-011：空时次显示无可用观测；
- SAT-012：过期时次不写“实时”。

### 7.5 光污染与暗夜数据

- LP-001：默认瓦片加载；
- LP-002～004：缺 z/x/y 占位符拒绝；
- LP-005/006：`{s}`、`{r}`、`{-y}` 正确；
- LP-007：公网 HTTP 拒绝；
- LP-008：localhost HTTP 允许；
- LP-009：URL 内嵌账号密码拒绝；
- LP-010：瓦片 404 标记 degraded；
- LP-011：单个边缘瓦片失败不移除图层；
- LP-012：后续成功恢复 available；
- LP-013：自定义源无署名时显示中性名称；
- LP-014：无授权栅格不显示 Bortle/SQM；
- LP-015：文案只写夜光参考，不写现场实测。

### 7.6 当前视野推荐

- REC-001：全国缩放提示继续放大；
- REC-002：省域范围生成边界内地点；
- REC-003：平移只标待更新，不自动打上游；
- REC-004：点击更新使用新边界；
- REC-005：地图编号与卡片严格一致；
- REC-006/007：编号和卡片进入同一详情；
- REC-008：无地点显示空状态；
- REC-009：超过 12 个只保留前 12；
- REC-010：同分时按 Bortle/海拔/名称稳定排序；
- REC-011：无评分显示等待评分；
- REC-012：筛选变化同步更新；
- REC-013：跨 180° 经线正确；
- REC-014：移动端面板不被遮挡。

### 7.7 地图交互

- MAP-001：快速拖动不崩溃；
- MAP-002：连续缩放无请求风暴；
- MAP-003：242 点位性能可接受；
- MAP-004：弹窗打开不误触底图；
- MAP-005：详情抽屉和推荐面板层级正确；
- MAP-006：移动端无页面级横向滚动；
- MAP-007：横屏可操作；
- MAP-008：字体 150% 不重叠；
- MAP-009：浏览器返回恢复中心/缩放/地点；
- MAP-010：生产预渲染不访问 `window`。

### 7.8 观星计划

- PLN-001：重复地点自动去重；
- PLN-002：删除主地点后正确回退；
- PLN-003：1/3/5/7 夜范围正确；
- PLN-004：ICON 时效不足提示切换模型或缩短范围；
- PLN-005～007：地点、日期、模型的旧响应不得覆盖；
- PLN-008：无连续窗口显示阻断原因；
- PLN-009：部分小时缺失降低置信度；
- PLN-010：同分排序稳定；
- PLN-011：分享 URL 可恢复；
- PLN-012：损坏 localStorage 安全回退；
- PLN-013：刷新页面恢复候选；
- PLN-014：Esc 关闭详情并恢复焦点。

## 8. 缓存与刷新状态机

统一状态：

```text
idle
loading
fresh
refreshing-with-old-data
stale
degraded
cooldown
error-without-data
```

必须覆盖：

- 无缓存成功→fresh；
- 无缓存失败→error-without-data；
- fresh 强刷→refreshing-with-old-data；
- 刷新成功→fresh；
- 刷新失败→stale/degraded；
- stale 上游恢复→fresh；
- 连续强刷→cooldown；
- 同 key 并发→coalesced；
- 切换地点→旧请求取消或结果丢弃。

响应头：

```text
Cache-Control
X-*-Cache
X-Data-Stale
X-Refresh-Suppressed
Retry-After
Warning: 110 - "Response is stale"
```

## 9. 故障注入矩阵

所有外部源至少模拟：

- 3 秒延迟；
- 超过超时；
- 429；
- 500/503；
- 连接中断；
- HTML 响应；
- JSON 字段缺失；
- 数组错位；
- 全 null；
- 慢响应晚于新请求。

规则：有旧数据则保留并标 stale；无旧数据则明确不可用；任何情况不得伪造正常值。

## 10. 视觉回归

固定 Mock 数据，覆盖：

- 今夜观测：综合/卫星/光污染；
- 当前视野推荐：12 条/空状态；
- 地点详情：桌面/移动端；
- 观星计划：1 夜/7 夜；
- 数据源降级、加载、错误。

视口：320×568、375×812、390×844、768×1024、1024×768、1440×1000。建议 `maxDiffPixelRatio: 0.005`。

## 11. 无障碍

自动：按钮名称、对比度、Dialog 标题、tab/tabpanel、`aria-expanded`、重复 ID、输入 label、隐藏区域焦点。

手工：Tab、Enter/Space、方向键、Esc、焦点回归、无鼠标完成搜索和加入计划。

## 12. 性能与压力目标

| 指标 | 目标 |
| --- | ---: |
| 移动端 LCP | < 2.5s |
| CLS | < 0.1 |
| INP | < 200ms |
| 地图平移长任务 | < 200ms |
| `/healthz` | < 200ms |
| 内存缓存 API p95 | < 300ms |
| 磁盘快照 API p95 | < 500ms |
| 正常上游 API p95 | < 8s |
| 30 分钟内存增长 | < 20% |

压力：10/50/100 并发用户；60% 首页、20% 天气、10% 区域推荐、5% 计划、5% 强刷。

## 13. 阿里云部署验证

### 部署前

```bash
npm ci
npm audit --omit=dev --audit-level=high
npm run check
npm run test:e2e
docker compose -f docker-compose.yml -f docker-compose.aliyun.yml config --quiet
docker build .
```

### ECS 出口

```bash
curl -I https://api.open-meteo.com
curl -I https://gibs.earthdata.nasa.gov
curl -I https://services.swpc.noaa.gov
```

记录 DNS、连接、TLS、TTFB、总耗时。

### 发布后

```bash
curl -fsS http://127.0.0.1:3100/healthz
curl -i 'http://127.0.0.1:3100/api/data-status?refresh=1'
npm run check:data-sources -- https://正式域名
```

还需验证：容器/ECS 重启、外网断开恢复、named volume、Worker、80→443、无混合内容。

## 14. 生产可观测性

建议记录：requestId、route、provider、cacheState、stale、durationMs、buildRevision、browser、viewport；不要记录完整精确经纬度。

合成监控：`/healthz`、首页、固定地点 forecast、data-status、代表性光污染瓦片。

## 15. CI 分阶段门禁

### 每个 PR

- dependency audit；
- lint；
- typecheck；
- unit/contract/integration/component；
- coverage；
- production build；
- Chromium desktop/mobile；
- accessibility；
- 关键视觉回归。

### 每日

- 真实数据源；
- WebKit/Firefox；
- 全量视觉；
- Lighthouse；
- dead-code。

### 每周

- k6；
- 30 分钟 soak；
- Docker 重启；
- 快照 volume 恢复；
- 依赖升级检查。

## 16. 覆盖率目标

全局初始门槛：lines/statements/functions 75%，branches 65%。

关键模块：评分、夜晚时间、视野推荐、刷新协调器、数据契约 ≥90%；坐标解析 ≥95%。

## 17. 发布准入

正式发布必须满足：

```text
P0 = 0
P1 = 0
单元/契约测试通过
Chromium 桌面/移动端通过
WebKit 核心流程通过
生产构建、Docker、阿里云出口通过
视觉差异已审批
严重无障碍问题 = 0
stale 均明确标记
刷新无重复上游请求
日志无敏感信息
```

## 18. 实施顺序

1. 测试目录、契约/集成测试、跨浏览器冒烟、失败产物；
2. 数据契约、缓存状态机和故障注入；
3. 三工作区、移动端和 Safari；
4. 视觉/无障碍/覆盖率；
5. 阿里云压力、长期运行和生产监控。
