# 手机端响应式布局与参数显示优化（候选）

## 状态

- Status: `RESPONSIVE_CANDIDATE_VERIFIED`
- Branch: `codex/mobile-responsive-layout-20260918`
- Base: `main@3334e0c08f9ab2e481277628ce4ee875e2f1039e` / `v1.0.18`
- Scope: 主页、暗夜选址、火烧云、云海的响应式布局、参数显示和详情交互可达性。
- No change: 评分算法、天气/卫星/光污染数据源、缓存、地点目录、URL 状态协议、生产配置。

## 实现摘要

- 手机和平板在 `<=1199px` 进入地图优先壳层，统一使用地图工具抽屉；桌面保留输入栏/地图/证据栏。
- 共享产品头部改为显式网格区域，手机导航不再被品牌和页面控件挤成窄胶囊。
- 主页手机参数区改为搜索/定位主行、评分与门槛、B1–B4、推荐开关的紧凑布局；短横屏使用单行紧凑参数，避免覆盖地图工具轨道。
- 火烧云与云海详情统一使用底部 dialog 抽屉；焦点捕获、Escape、遮罩关闭、关闭后焦点恢复和独立滚动均由共享壳层处理。
- 云海点位卡改为键盘可操作按钮；详情卡禁止 flex 压缩，未知数据仍保持 `—`/“数据不足”。
- 更新平板断点 E2E 契约：1024px 验证地图优先工具，不再要求桌面候选榜出现在隐藏输入栏。

## 验证证据

- `npm run check`: PASS — lint、typecheck、59 个 Vitest 文件 / 340 个测试、生产构建。
- Responsive focused E2E: PASS — 手机主页、1024px 平板壳层、云海详情抽屉、火烧云详情抽屉；桌面/移动项目均覆盖。
- Full Chromium E2E: PASS — 164 tests, 124 passed, 40 designed skips, 0 failed。
- Cross-browser smoke: PASS — Firefox desktop + WebKit mobile, 4 passed。
- Visual geometry: 390×844 主页 `docWidth=390`、参数栏约 `319px`、地图约 `283px`；云海 390px 页面无横向溢出，专题详情抽屉覆盖视口底部并独立滚动。
- Live provider boundary: 本地视觉检查期间 Open-Meteo 返回 HTTP 429；页面按既有 fail-closed 语义显示数据不足。本次布局证据使用固定 fixture，不把实时数据可用性当作布局证明。

## 未执行与交付边界

- 未进行真实 iOS Safari/Android Chrome 真机验收。
- 未进行生产部署、提交、推送、合并或版本升级。
- 未声称天气预报、云海指数或火烧云指数的现场准确率改善。

## 下一步

由 Jovi 审阅隔离工作树差异；确认后再决定是否提交、推送或合并。生产部署需要单独的精确 SHA 授权。
