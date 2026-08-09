# 交给下一位 Codex 的执行 Prompt

你现在接手 `Jovifei/Star_photo_addr` 的最终发布验证。不要重做产品，也不要恢复旧 Vite 架构；先复核现有成果，再只修 CI/部署环境中真实出现的剩余问题。

## 必须先读

1. `README.md`
2. `LOCAL_CODEX_START.md`
3. `docs/gpt_plan/CODEX_HANDOFF_PRODUCT_INTEGRATION_2026-08-07.md`

## 分支与目标

- 检出远端分支 `codex/product-integration-final`
- 目标分支为 `main`
- 远端核心整合提交起点为 `ce05b2d`
- 先检查是否已有对应草稿 PR；不要重复创建 PR

## 当前不可破坏的产品契约

- `/` 是逐星主地图；`/sites` 是推荐观星地点；`/planner` 是星野决策；`/viirs` 只做兼容重定向。
- 页面联动参数固定为 `lat/lng/name/elevation/night`。
- `night=YYYY-MM-DD` 表示当日 20:00 到次日 05:00。
- 云层必须保留高/中/低三层、0–100%、时间轴和播放控制。
- 地图可见文字以中文为主；不能重新启用英文地图标签。
- 数据来源弹窗必须居中且高于地图/顶部栏；保持焦点锁、Esc 和移动安全区。
- 星野决策必须保留地点增删、日期排序、星期几和跨午夜说明。
- 不能生成假的云量、光污染或推荐点评分。
- 不要提交 `.agents/`、`.qoder/`、Comet/OpenSpec、skills-lock 或 dist 备份。

## 你要执行的工作

### 1. 拉取与审计

```bash
git fetch origin
git checkout codex/product-integration-final
git status -sb
git log --oneline --decorate -20
```

若工作区已有用户改动，先区分来源，不要覆盖。

### 2. 标准门禁

```bash
npm ci
NODE_OPTIONS= npm run check
npx playwright install chromium
npm run test:e2e
```

只有命令真实失败时才修改代码。若失败，保留完整错误与根因，做最小修复，然后复跑相关命令和 `npm run check`。

### 3. Docker 级验证

在有 Docker CLI 的环境执行：

```bash
docker build -t star-photo:integration .
docker run --rm -d --name star-photo-integration -p 8080:3000 star-photo:integration
curl --fail http://127.0.0.1:8080/healthz
curl --fail --output /dev/null http://127.0.0.1:8080/
curl --fail --output /dev/null http://127.0.0.1:8080/sites
curl --fail --output /dev/null http://127.0.0.1:8080/planner
docker stop star-photo-integration
```

如需调试，先读取容器日志；不要用改回开发服务器的方式绕过 standalone 问题。

### 4. PR/CI 收口

- 查找 `codex/product-integration-final → main` 的 PR。
- 查看所有 GitHub Actions 和部署检查。
- 只修失败检查；每个修复单独说明根因、影响和验证。
- 提交并推送到同一分支，不要另开一条重复分支。
- 所有检查绿后，将草稿 PR 标记为 ready for review（若权限允许）；不要自行合并，除非用户明确授权。

## 建议 PR 摘要

标题：`feat: 打通星野决策与逐星并完成云图观星体验`

正文应包含：

- 两个产品统一进 Next.js 的路由与 URL 状态协议
- 三层云图、20:00→05:00 时间轴、中文地图、推荐地点
- 地点增删、日期排序、星期几和跨午夜语义
- 数据来源弹窗与响应式修复
- lockfile、E2E、standalone、Docker 工程化
- 实际执行的检查结果
- 数据边界：预报插值不等于卫星云图；推荐点需来源复核

## 完成标准

最终回复必须给出：

1. 最终提交 SHA 和分支名
2. PR 链接与状态
3. `npm run check`、完整 `npm run test:e2e`、Docker 烟测结果
4. 任何仍需人工配置的环境变量或外部数据授权
5. 明确说明是否可合并，以及尚未满足的唯一条件（如有）
