# 完整Chromium契约收口

2026-10-02 heartbeat实际读取PR46 head e331ee88工作流36984744007：完整Chromium11失败/217通过/122适用性跳过；quality、live-data、container、Firefox/WebKit成功。原定向UI门禁不能称为完整CI绿灯。

修复仅涉及测试：旧弹层定位器迁移至常驻工具栏；实际月日与星期提示分别核验；32px桌面与44px粗指针条件分开；过期原始事实保留且不给94分；请求计数区分GFS地图和BestMatch候选，保留每个所有者单次请求约束；激活日期文字背景对比度>=4.5。公共夹具兜底阻断遗漏API，不让UI测试进入真实供应商。日期请求、排行日期、地图/面板和评分门禁保留。

本轮实际执行：3项stale/grid/navigation定向通过；相关48项定向套件首轮25通过、22适用性跳过、剩余1项旧颜色断言，改为对比度检查后专项1通过。最终完整Chromium350计划=228通过/122适用性跳过/0失败，6.7分钟；完整npm check72文件414测试、lint/typecheck/build通过。

以上是本地实际结果，新的GitHub完整CI尚待当前测试修复SHA终态。生产v1.0.25代码a74f7ee未修改；PENDING_REMOTE_PLANNING保持，远端旧聊天满额仍等待接力决定。不得以本轮fixtures冒称生产真实天气通过。

## 后续WebKit门禁
当前CI36993020247的Chromium、quality、live-data、container实际SUCCESS；跨浏览器5PASS1WebKit失败，旧helper要求动画matrix精确相等后force点击。修改helper为普通稳定/可命中点击并核验aria状态，保留原测试时限。WebKit失败用例本地连续3PASS，Firefox/WebKit全6PASS；没有修改产品动画或业务源码。新GitHub最终head门禁仍需完整终态。

