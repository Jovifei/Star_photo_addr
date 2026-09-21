# 本地 Codex 接收：手机/平板内容与滚动候选

任务：接收 `Jovifei/Star_photo_addr` 新分支 `codex/mobile-content-flow-audit-20260921`，独立审查和完成全应用验证。**不是部署指令。**

精确基线：`349db7b5ba320593724f2a084f6b2228489b6fb7`（当前文档滚动修复分支），父提交 `ec5abdd72cb73666c12e655b829e275134420dbe`。旧 `main@3334e0c` 不是本候选构建基线。最终候选 SHA 以这次交接回复和实际 `git fetch` 结果核对，严禁仅看分支名。

## 安全接收

```powershell
git status --short
git remote -v
git fetch origin
# 确认 origin 是 Jovifei/Star_photo_addr，Owner 改动不清理、不覆盖。
git log -5 --oneline origin/codex/mobile-content-flow-audit-20260921
git merge-base --is-ancestor 349db7b5ba320593724f2a084f6b2228489b6fb7 origin/codex/mobile-content-flow-audit-20260921
# 退出码须为0；检查候选未丢失60c348b/ec5abdd/349db7b的既有修改。
git worktree add -b local/mobile-content-flow-validation ../Star_photo_addr-mobile-review origin/codex/mobile-content-flow-audit-20260921
```

目录/分支已存在时先确认用途，再用新名称；不删除原 worktree。独立 `npm ci`，不要把另一个工作树的 node_modules 做目录联接给 Turbopack。

先读：
- `docs/ui-audit/2026-09-21-mobile-content-flow-audit.md`
- `.github/skills/zhuxing-mobile-web/SKILL.md`
- `docs/ui-audit/2026-09-21-mobile-content-flow-validation.json`

原 `.agents/skills/ui-ux-pro-max/SKILL.md` 未在该发布分支查到。你本机若存在可继续用，但不能把本机私有技能误说成远端交付内容。

## 改动边界

新增 pageScrollLock/mapBrowserInteraction 两个 DOM helper；修改 shared header、搜索行、地图手势包装、地图/专题详情锁与焦点；替换已有 mobile-document-scroll.css，不再额外叠一份同职责 CSS；新增真实应用 E2E 源码。**没有改 API、评分、默认模型、数据缓存契约、环境变量或发布版本号。**

重点审查：专题 active 日期/时段仍来自原组件；手机收起控件可通过“调整”找回；桌面完整控件不受影响；原地图点击选点、Leaflet 内置按钮与页面 pinch-zoom 都能用；模态滚动锁关闭/旋转/嵌套释放不残留。

## 必做验证

```powershell
node --version  # >=24
npm ci
npm run check
npx playwright test tests/e2e/mobile-content-flow.spec.ts tests/e2e/mobile-panel-dock.spec.ts
npm run test:e2e
npm run test:e2e:cross-browser
```

**已知集成门槛：** 新渐进披露会让未选中的日期/时段以及顶部详细筛选默认不可见。搜索现有 E2E 的相关点击，显式先点“展开日期与时段设置”或“时间与地点筛选”，再操作原控件。保留所有数据/日期/跳转断言；不要删测试、增加skip、或用全局脚本自动展开页面来伪装旧交互。云端尚未取得并更新所有此类旧测试，必须完成后才称全套通过。

截图与手势必须来自完整运行应用，不使用离线占位地图验收产品。覆盖首页、暗夜选址、四个工具页签、今晚判断、云量详情、火烧云、云海；至少320/390/768/1024/812×375/1440，并检查200%文字、软键盘、安全区、深度滚动后打开/关闭面板、旋转与回到后台。量化首屏导航/设置/地图像素高度，记录仍有的遮挡，而不是仅断言 scrollWidth。

使用现有mock完成稳定回归，再单独做公开/本地上游验证；429、502、空字段、stale有旧分时不得画成新鲜可推荐。不要让真实配额波动阻塞布局测试，也不要把mock通过当作实时数据恢复。

## 不能遗漏的数据问题

审计 D01（时间轴可用文案不代表评分完整）、D02（云海跨日期旧请求状态覆盖风险）、D03（火烧云stale图/榜/详情一致性）本轮没有修改，继续单列整改和故障注入，不得在UI交接里标成已解决。黑图必须区分尺寸与真实瓦片/API失败。

## 回传格式

回传实际候选SHA/祖先检查、diff文件清单、Node版本、各门禁PASS/FAIL/NOT_RUN、完整应用截图路径、各宽度地图与页头实测、手势与焦点/旋转结果、真实手机是否真的操作、剩余缺陷。允许在本地验证分支继续修复并按用户授权推送；**不要合并main或部署生产，待Jovi审核。**

云端已执行的仅是2个helper严格类型检查、7个TS/TSX语法、CSS解析、新E2E语法及145项离线DOM/CSS断言。没有全仓安装、完整Next构建、真实Leaflet瓦片、Firefox/WebKit、真实API或真机资格，不复用历史352项测试成绩。
