## 1. 依赖与 lockfile 同步

- [ ] 1.1 审计 `package.json` 中 Next 与遗留 Vite 依赖的实际 import，确认无悬空引用
- [ ] 1.2 在 Node 24 下用 `npm install --package-lock-only` 重新生成 `package-lock.json`（不使用 `--force`/`--legacy-peer-deps`）
- [ ] 1.3 删除本分支测试生成的 `node_modules`/`.next` 后 `npm ci` 成功，确认根项目版本/Next/React 与 `package.json` 一致

## 2. 命令与脚本统一

- [ ] 2.1 在 `package.json` 补齐 `test:unit`(vitest run)、`test:e2e`(playwright)、`test:live`(Open-Meteo 冒烟)、`check`(lint+typecheck+test:unit+build)
- [ ] 2.2 重写 `playwright.config.js` 的 `webServer` 为 Next `build`+`start`（端口 4178），E2E 针对当前 Next 页面，移除对 Vite `dist`/`preview:test` 的依赖
- [ ] 2.3 重写 `scripts/local-preflight.ps1` 到 Next 命令
- [ ] 2.4 同步 `README.md`/`LOCAL_CODEX_START.md`/`HANDOFF_CODEX.md` 到真实入口（端口 3000、Node 24、无需 API Key、不能双击 index.html）

## 3. CI 修正

- [ ] 3.1 `.github/workflows/ci.yml` 改为监听 `main`、加入 `workflow_dispatch`，使用 Node 24 + `npm ci` + `npm run check`

## 4. 公共资源与降级

- [ ] 4.1 只读搜索合法本地备份/旧 worktree/已有制品中的 `public/images/perseids`，为每类资源记录来源/许可/大小
- [ ] 4.2 恢复合法且完整的资源；对缺失资源实现优雅降级（Bortle/VIIRS/候选/边界默认禁用或显示"无数据/不确定"），`sampleBortle` 的 nodata 不冒充可信 B9/SQM
- [ ] 4.3 确保缺失资源不会造成反复 404 请求或未处理异常

## 5. 本地一键启动

- [ ] 5.1 新增并验证 `scripts/start-local.ps1`（检查 Node 24 → 缺依赖则 `npm ci` → `npm run dev` → 等待 200 → 打开浏览器 → 失败时非零退出并保留错误）
- [ ] 5.2 可选新增 `start-local.cmd`

## 6. 真实验收

- [ ] 6.1 `npm run check`（lint/typecheck/unit/build）全绿且 0 skipped
- [ ] 6.2 `npm run test:e2e` 真实运行（非 `--list`）
- [ ] 6.3 `npm run test:live` Open-Meteo 冒烟
- [ ] 6.4 `npm run dev`；验证 `GET /`、`GET /viirs`、`GET /api/geocode?q=杭州&count=5&language=zh`、`GET /api/forecast?latitude=30.2741&longitude=120.1551&days=3` 均 200
- [ ] 6.5 浏览器 QA：桌面 1440×1000 与手机 390×844 检查首屏地图、搜索杭州、选择地点侧栏、11 夜切换、地图点击请求天气、定位拒绝、打开 `/viirs`、Console 无未处理异常、必需本地资源无 404
- [ ] 6.6 从最终提交创建全新临时克隆，确认无 `node_modules`/`.next`/`dist` 后重新 `npm ci` + `npm run check` + 最小路由验证

## 7. 文档与收尾

- [ ] 7.1 重写交接/README 使其与现状一致，删除旧 Vite 9/9、Sites Worker、`dist`、8080 等不再成立的描述
- [ ] 7.2 提交独立清晰 commit；push 分支并开 Draft PR 到 `main`（无用户明确合并授权不得擅自合并 main）；不 force push、不重写历史
