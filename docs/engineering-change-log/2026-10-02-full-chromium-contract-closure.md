# 完整Chromium契约收口

2026-10-02 heartbeat实际读取PR46 head e331ee88工作流36984744007：完整Chromium11失败/217通过/122适用性跳过；quality、live-data、container、Firefox/WebKit成功。原定向UI门禁不能称为完整CI绿灯。

修复仅涉及测试：旧弹层定位器迁移至常驻工具栏；实际月日与星期提示分别核验；32px桌面与44px粗指针条件分开；过期原始事实保留且不给94分；请求计数区分GFS地图和BestMatch候选，保留每个所有者单次请求约束；激活日期文字背景对比度>=4.5。公共夹具兜底阻断遗漏API，不让UI测试进入真实供应商。日期请求、排行日期、地图/面板和评分门禁保留。

本轮实际执行：3项stale/grid/navigation定向通过；相关48项定向套件首轮25通过、22适用性跳过、剩余1项旧颜色断言，改为对比度检查后专项1通过。最终完整Chromium350计划=228通过/122适用性跳过/0失败，6.7分钟；完整npm check72文件414测试、lint/typecheck/build通过。

以上是本地实际结果，新的GitHub完整CI尚待当前测试修复SHA终态。生产v1.0.25代码a74f7ee未修改；PENDING_REMOTE_PLANNING保持，远端旧聊天满额仍等待接力决定。不得以本轮fixtures冒称生产真实天气通过。

## 后续WebKit门禁
当前CI36993020247的Chromium、quality、live-data、container实际SUCCESS；跨浏览器5PASS1WebKit失败，旧helper要求动画matrix精确相等后force点击。修改helper为普通稳定/可命中点击并核验aria状态，保留原测试时限。WebKit失败用例本地连续3PASS，Firefox/WebKit全6PASS；没有修改产品动画或业务源码。新GitHub最终head门禁仍需完整终态。


## 最终门禁关闭
精确测试SHAf7e5373c3be7e741081dc24a5727bab46924d021的GitHub工作流36994802711已完成SUCCESS，五项jobs全绿。远端完整Chromium350计划=228PASS122适用性SKIP0FAIL(13分钟)，Firefox/WebKit6/6PASS。PR47已合并main f98cf45dcd81ec661abc2f524f6d9799134059fd，原目录干净且main/origin0/0。src/scripts/package与生产a74f7ee完全一致，此次仅测试及文档无需产品重新部署。
另核验生产冷却标记不存在后一次普通BestMatch请求：sourceFetchedAt2026-10-02T10:27:32.143Z、stale=false、336小时；保存响应经真实评分函数验证今夜10完整时次、45分、无缺字段。仅单点数据证据，不冒称所有生产页或预报准确率通过。

