# 星空摄影天气网页｜本地 Codex 继续工作入口

这份文件是本项目唯一推荐的本地接力入口。仓库已经包含可运行 MVP，不需要 Codex 从零搭建。

## 1. 克隆与预检

Windows PowerShell：

```powershell
git clone https://github.com/Jovifei/Star_photo_addr.git
cd Star_photo_addr
powershell -ExecutionPolicy Bypass -File .\scripts\local-preflight.ps1
```

预检脚本会执行：Node/npm 版本检查、`npm ci`、全部自动测试、Open‑Meteo 真实接口冒烟测试和生产构建。若本机安装了 Docker，还会检查 Compose 配置，但不会擅自启动容器。

本地开发：

```powershell
npm run dev
```

Docker 启动：

```powershell
docker compose up --build -d
curl.exe -fsS http://127.0.0.1:8080/healthz
```

## 2. 当前已完成

- React/Vite 响应式网页与深色摄影风格。
- 12 个预置拍摄点和浏览器本地自定义点位。
- Open‑Meteo 7/14 天实时逐小时天气。
- 总、低、中、高云量；降水、能见度、湿度、露点、风和阵风。
- Astronomy Engine 太阳/月球高度、月面照度、暗夜与银河中心高度。
- 星空评分、云海潜力、安全硬门禁和连续可拍窗口。
- 点位排名、观测夜切换、核心窗口矩阵和逐小时详情。
- 气压层云高区间及机位“云上/云中/云下”判断。
- 1 小时浏览器缓存、自动刷新、手动刷新和失败回退。
- 算法测试、Sites Worker 测试、真实接口测试、生产构建。
- Dockerfile、Nginx、Compose 和 `/healthz`。

## 3. Codex 必须先完成的本地任务

1. 读取 `README.md`、本文件、`HANDOFF_CODEX.md`、`docs/PRODUCT_TECH_PLAN.md`。
2. 执行 `scripts/local-preflight.ps1`，不得复用聊天中的旧测试结论。
3. 在本机执行 `docker compose up --build -d`，检查 `/healthz`。
4. 使用桌面和手机尺寸实测：首页、7/14 天、星空/云海、对比、点位管理、详情和云层剖面。
5. 检查本地网络能否从浏览器访问 Open‑Meteo；若受限，才实现同域代理。
6. 修复发现的问题，增加回归测试，再提交独立分支和 PR。

## 4. 后续生产增强

- 同域天气 API 代理，避免浏览器跨域和地区网络差异。
- Redis 缓存、超时重试、熔断和上一版数据回退。
- Postgres 保存预报快照、判断快照和摄影现场反馈。
- 雷达、卫星、雷电、道路和地质灾害安全门禁。
- 预报命中率、Brier score、模型校准和评分版本回滚。
- GitHub Actions：测试、构建、Docker build 和依赖审计。
- 根据 `sunsetbot.top` 恢复后的真实截图再优化移动端信息组织；禁止仅凭描述盲目复制。

## 5. 可直接粘贴给本地 Codex 的提示词

```text
你现在接手 GitHub 仓库 https://github.com/Jovifei/Star_photo_addr 。这是已经可运行的星空摄影天气决策网页，不是新项目，不允许从零重写。

第一阶段只做基线接管：
1. 完整阅读 README.md、LOCAL_CODEX_START.md、HANDOFF_CODEX.md、docs/PRODUCT_TECH_PLAN.md 和现有源码。
2. 检查 git status、当前分支、远程仓库和最新提交；不得覆盖未提交的用户改动。
3. 在 Windows PowerShell 执行 scripts/local-preflight.ps1。逐项记录 npm test、npm run test:live、npm run build 的真实结果；失败必须先定位，禁止把未执行写成通过。
4. 执行 docker compose up --build -d，再验证 http://127.0.0.1:8080/healthz 和 SPA 刷新回退。若 Docker 不可用，明确报告环境阻断，不得伪造结果。
5. 使用真实 Chrome，以桌面和手机 viewport 检查：首页、7/14 天、星空/云海切换、观测夜、核心窗口对比、点位管理、详情抽屉、逐小时图表和气压层云高。

第二阶段修复验证中发现的问题：
- 保留 12 个预置点位和 Open-Meteo/Astronomy Engine 署名。
- 不得把云海潜力混入星空评分。
- 雷暴、降水、低能见度和大阵风继续作为不可被高分抵消的硬门禁。
- 0–72 小时用于决策，4–7 天用于规划，8–14 天只能标记为趋势。
- 云高必须显示估算区间和置信度，AGL 永不为负；没有垂直层数据时不得伪造云底/云顶。
- 每个修复都增加回归测试。

第三阶段在基线完全通过后再评估生产增强：同域天气代理、Redis、Postgres 快照、定时刷新、监控、灾害预警和 GitHub Actions。不要一次性把所有增强塞进一个提交。

Git 规则：从 main 创建 codex/local-validation-and-hardening 分支；只提交本任务文件；测试通过后生成清晰 commit；先不要直接合并 main，也不要改写历史。最终交付变更清单、测试证据、Docker 结果、桌面/手机截图、已知风险和下一阶段建议。
```

## 6. 验收基线

- `npm test`：7 项算法测试和 4 项 Worker 测试通过。
- `npm run test:live`：至少返回 2 个点位、48 小时地面预报和 10 层压力数据。
- `npm run build`：成功生成 `dist/client` 和 Sites Worker 产物。
- Docker：`/healthz` 返回 `ok`，未知前端路径回退到 `index.html`。
- 浏览器：实时数据加载失败时有明确提示并保留上一版缓存，不出现白屏。

以上数字是当前云端基线；本地 Codex 必须重新执行后才能引用。
