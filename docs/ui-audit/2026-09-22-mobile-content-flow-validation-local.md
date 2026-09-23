# 手机/平板内容流候选本地接收报告

> 证据修正：原快捷键测试不足以证明“200%浏览器文字缩放”；后续已改成实测两倍字号的 CSS 压力测试。原390专题截图存在视口复用错误，后续已修正采集器。八张原图现均可读取；详见 `2026-09-22-recovery-and-original-screenshots.md`，本报告的历史成绩不能替代后续候选验收。

状态：`LOCAL_INTEGRATION_VALIDATED_PENDING_OWNER_REVIEW`

## 接收边界

- 仓库：`Jovifei/Star_photo_addr`
- 候选分支：`codex/mobile-content-flow-audit-20260921`
- 候选 SHA：`1126cf11f854222bef939e5c1b4a955a8be50ab2`
- 基线：`349db7b5ba320593724f2a084f6b2228489b6fb7`
- 祖先关系：PASS；基线是候选祖先。
- Owner 主工作树：有未提交修改；本次使用独立 worktree，未清理、未覆盖。
- 当前本地验证分支：`local/mobile-content-flow-validation-20260922`
- 未合并 `main`，未部署生产。

## 本地候选补丁

为完成交接文档要求的旧操作流程适配，本地分支补了以下最小变更：

- `ResponsiveMapControls` 在 compact drawer 打开时用捕获阶段处理 Escape；嵌套 dialog 仍保留自己的 Escape。
- 移动卫星/图层流程在操作底部时间轴前显式关闭地图工具抽屉。
- 旧 E2E 更新为候选实际 accessible name、48 CSS px 触控尺寸、精确 Bortle dialog，以及移动筛选/地图披露流程。
- 新增完整应用截图采集测试和旋转、焦点、浏览器文字缩放验证测试。

## 门禁结果

| 检查 | 结果 |
|---|---|
| Node | `v24.18.0` |
| 独立 `npm ci` | PASS |
| `npm run check` | PASS：lint、typecheck、60 files / 352 tests、Next build |
| 候选移动流程 + 旧移动面板 | PASS：10 passed / 10 skipped |
| 完整 Chromium E2E | PASS：145 passed / 61 skipped / 0 failed，已包含 D02–D04 专项故障注入 |
| Firefox/WebKit 冒烟 | PASS：4 passed |
| 真实 provider `npm run test:live` | PASS：Open-Meteo 四模型、pressure、geocode、AQI、NASA GIBS、NOAA Kp、VIIRS tile |
| 应用数据源 `check:data-sources` | 初次 satellite 瞬时 degraded；重试 PASS，weather/satellite/light-pollution available |
| 截图矩阵 | PASS：20 张完整应用截图 |
| 旋转、sheet scroll lock、Escape、focus restore | PASS：2 项专用测试 |
| 200% 浏览器文字缩放/无横向溢出 | PASS：专用测试 |
| 软键盘真实 OS 交互 | NOT_RUN |
| OnePlus 7 Pro 真机滑动 | NOT_RUN：ADB 启动网页操作被自动审批策略拒绝 |

## 截图证据

完整应用截图位于：`tmp/mobile-content-flow-capture/`，包括：

- 首页：320、390、768、1024、812×375、1440；顶部、下滑、筛选展开。
- 首页四个地图工具：图层、地点、云量、推荐。
- 今晚判断详情。
- 火烧云/云海：390 折叠态、日期时段设置展开态、812×375 横屏。

截图使用完整 Next 应用与项目现有稳定 API mock；不是离线 HTML 夹具，也不是实时 provider 恢复证据。

## 数据问题跟进状态

- D01–D04 已在后续本地提交中修复并通过专项回归，详见 `2026-09-22-data-issues-fix.md`。
- 八张原图现已逐图复核，D05 的截图证据阻塞解除；详见 `2026-09-22-recovery-and-original-screenshots.md`。
- 2026-09-23 追加修复定位海拔缺失误显示 0m；当前源码重建后的完整结果见下方追记。

这些数据项未通过布局候选掩盖、放宽门槛或改变 API/评分/缓存契约。

## 2026-09-23 当前源码验证追记

- 修正海拔未知值与真实海平面 0m 的混淆，并禁止近邻/描述性名称启发式把别处海拔写入当前位置。
- `npm run check`：PASS，62 个测试文件 / 365 tests，lint、typecheck、Next production build 均通过。
- 当前 standalone 的完整 Chromium：153 passed / 61 project skips / 0 failed；Firefox/WebKit 冒烟 4 passed。
- “我的位置无设备海拔”桌面与手机各 1 项通过；两个结果已包含在完整 Chromium 统计中。
- 真实设备 Safari/Android、外部供应商长期可用率和目录高程精度仍不是此本地候选门禁的证明；没有合并或部署。
