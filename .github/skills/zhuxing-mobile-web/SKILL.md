---
name: zhuxing-mobile-web
description: Review and repair Star_photo_addr phone/tablet browser content hierarchy, native scrolling, map gestures, dialogs and truthful data presentation. Preserve desktop and existing forecast integrity.
---

# 逐星移动浏览器专项规范

适用：Next.js/React/Leaflet 的手机和平板浏览器，不是原生 APK 设计或自动部署授权。

先读当前生产/发布分支，再读最新 ui-audit；不要假设 main 等于生产。保留 Owner 脏工作区。原始截图不存在时直说；隔离 HTML 夹具、完整应用模拟器和真机证据分开记录。

## 必须检查

1. 主页面采用原生纵向滚动；顶栏随文档离开视口；不得用永久展开的设置、100vh+overflow:hidden 或多个小滚动框压缩正文。地图/表格二维操作只限制在对应部件内。
2. 搜索/当前地点/实际日期时段优先。次要设置可披露，选中值与错误仍可看见；不得用另一套常量伪造当前摘要。48 CSS px 为产品触控目标，输入16px，支持文字增大。
3. 地图默认允许滑页面；移动地图有明确退出方式，保留浏览器 pinch-zoom、返回等系统手势。容器尺寸变动要通知 Leaflet，按帧合并，清理观察器；不能把瓦片失败说成重绘已恢复。
4. 图例不盖住地图署名和操作；关闭面板不扩大页面横向滚动范围。手机 bottom sheet 与短横屏侧栏职责明确。
5. 面板打开才锁背景，旋转时更新；关闭恢复页面位置和焦点但不滚动跳转。保留嵌套弹窗的优先级、Escape、键盘出口、减少动画设置。桌面非模态区不得强锁焦点。
6. missing ≠ 0，stale ≠ fresh，年度夜光 ≠ 实时Bortle，卫星 ≠ 预报，条件指数 ≠ 校准概率。模型/时间/地点与地图、列表、详情必须一致。布局补丁不能改权重或放宽门槛。

## 验证门槛

在320、375/390、430、768、1024、812×375、1440宽度检查溢出、首屏地图占比、标题/日期可读性、展开/关闭与旋转。用真实手势测试，不仅 scrollTo；同时测软键盘、200%文字、低端真机快速反向滚动、前后台与长列表。连续FPS只有实际测量才能报告。

先 Node>=24 npm ci，再 lint/typecheck/tests/build、针对性E2E、完整Chromium、Firefox/WebKit。改变交互时正常更新旧测试操作步骤，不得跳过/删掉断言或让测试自动恢复旧UI来变绿。未跑项标 NOT_RUN；提交与部署分开。

参考的是公开 ui-ux-pro-max 的工作方法，而非其完整安装：
https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
