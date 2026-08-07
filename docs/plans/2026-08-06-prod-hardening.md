---
change: prod-hardening-same-domain-proxy
design-doc: docs/PRODUCT_TECH_PLAN.md
base-ref: 2385e6b36db74557e3225db3113691991d0b4360
note: |
  Comet CLI 在本机不可用（全局模块路径损坏，MODULE_NOT_FOUND），且工作区无 .comet.yaml / openspec/。
  本计划按 comet-build 的“计划→构建→验证（本地优先，再 Docker）”精神，以等效 SOP 模式起草。
  设计文档复用已有的 docs/PRODUCT_TECH_PLAN.md（非 superpowers spec 路径，特此说明偏差）。
---

# 实现计划：生产加固 · 同域天气代理（本地优先，再 Docker）

> 依据 `docs/PRODUCT_TECH_PLAN.md` 与 `HANDOFF_CODEX.md` 的“生产增强”章节。
> 用户指令：**先起草计划 → 本地运行成功 → 再 Docker**。

## 0. 关键事实（起草前已核实）

- 当前代码是 **React/Vite SPA**，浏览器直连 `api.open-meteo.com`（Open-Meteo 免密钥、允许 CORS）。
- 已有 **Dockerfile（多阶段 Vite 构建 → nginx 静态托管）** 与 `nginx.conf`（`/healthz` + SPA 回退已就绪）。
- 已有 **Cloudflare Worker**（`worker/index.js`）做 Sites SPA 回退；`AGENTS.md` 要求该文件与 `.openai/hosting.json`、`scripts/prepare-sites-build.mjs`、`tests/sites-worker.test.mjs` 保持不动。
- `PRODUCT_TECH_PLAN.md` 描述的是 Next.js + Prisma + Worker + Postgres 全栈架构，**与当前 SPA 实装不符**。本计划优先保留轻量 SPA + nginx + Worker 模型，避免为“看起来高级”引入运行依赖（与方案 9.3 一致）。
- 本机**无 Docker**（之前已确认 `DOCKER_CLI_MISSING` / 无 daemon），Docker 步骤只能在具备 Docker 的机器执行；本计划会写好命令与断言，但本地只验证 nginx 配置语法与构建产物。

## 1. 范围决策（需用户确认，见文末问题）

| 方案 | 内容 | 风险/代价 | 与现状关系 |
|---|---|---|---|
| **A（推荐）** | 同域 `/api/forecast` 代理（nginx + Worker 路由）+ 可配置数据源基址 + `.env.example` + 本地与 Docker 验证 | 低；不引入后端栈，保留 SPA+Sites | 增量，不改动现有 UI/评分 |
| B | A + Redis 缓存 + Postgres 快照 + 定时刷新 Worker + 监控 | 高；需要后端服务与数据迁移，偏离 SPA+Sites 部署模型 | 实质重写部署架构 |
| C | 仅 Docker 验证当前 SPA（不新增代理功能） | 最低；但未解决“公网生产需同域代理” | 纯验证 |

> 默认按 **方案 A** 起草下文任务。B/C 的任务在文末“备选”中简述，选中后再展开。

## 2. 方案 A 任务清单（可执行，含验收）

### T1 — 可配置数据源基址（前端）
- 文件：`src/lib/openMeteo.js`
- 内容：新增 `FORECAST_BASE` 解析——默认同源 `/api/forecast`；可用 `import.meta.env.VITE_FORECAST_BASE` 覆盖（如 `https://api.open-meteo.com/v1/forecast`）；保留直连 Open-Meteo 作为文档化回退。
- **约束**：对上层的规范化数据契约（字段、单位、AGL≥0 等）不变；不把任何第三方密钥写入前端 bundle。
- 验收：默认走同源 `/api/forecast`；设 `VITE_FORECAST_BASE` 时行为与原版一致；无密钥进入前端。

### T2 — Docker 同源代理（nginx）
- 文件：`nginx.conf`
- 内容：新增 `location /api/forecast { proxy_pass https://api.open-meteo.com/v1/forecast; proxy_set_header Host api.open-meteo.com; proxy_set_header X-Forwarded-For $remote_addr; proxy_connect_timeout 5s; proxy_read_timeout 15s; }`（透传 query，`$is_args$args` 由 proxy_pass 自动携带）。
- **约束**：`/healthz` 与 `location /` 的 SPA 回退保持不变。
- 验收（在 Docker 机器）：`curl 'http://127.0.0.1:8080/api/forecast?latitude=30.02&longitude=119.00&hourly=temperature_2m&forecast_days=1'` 返回 Open-Meteo JSON；`/healthz` 仍 200；未知路由仍回退 `index.html`。

### T3 — Cloudflare Worker 同源代理路由
- 文件：`worker/index.js`
- 内容：增加 `/api/forecast*` 路由，服务端 `fetch('https://api.open-meteo.com/v1/forecast' + url.search)`，返回流式响应；不写任何密钥。
- **约束**：SPA 回退逻辑保持不变；`tests/sites-worker.test.mjs` 现有断言必须仍通过。
- 验收：Worker 测试新增断言 `/api/forecast` 代理返回 200 且透传查询；SPA 回退断言不变。

### T4 — `.env.example`
- 文件：`.env.example`（新建）
- 内容：`VITE_FORECAST_BASE` 说明（默认同源）；为未来密钥型供应商（QWeather/CMA）预留**服务端**变量占位与说明，明确“密钥只进服务端，不进前端/Git/日志”。
- 验收：仓库根存在 `.env.example`；`git status` 确认无 `.env` 被追踪。

### T5 — 本地优先验证（本地先跑通）⭐
- 步骤：
  1. `vite.config.mjs` 增加 `server.proxy['/api/forecast'] -> 'https://api.open-meteo.com/v1/forecast'`，使 `npm run dev` 默认走同源代理，本地即可验证代理路径。
  2. 运行（与之前 hardening 一致，NODE_OPTIONS 内存受限时加 `--max-old-space-size=2048`）：
     - `npm ci`
     - `npm test`（unit + build + sites）
     - `npm run test:live`
     - `npm run build`
     - `npm run test:e2e`（用 `preview` 静态服务 + 代理模式 fixture）
  3. Playwright 桌面(1440×1000)/手机(390×844) 走查：经同源代理取数、7/14 天切换、星空/云海切换、对比矩阵、点位详情抽屉、压力层云高、API 失败保留旧数据。
  4. 截图存 `docs/qa/`。
- 验收：本地浏览器经同源 `/api/forecast` 成功取数并渲染；无白屏；E2E 全绿；截图齐全。

### T6 — Docker 验证（在具备 Docker 的机器，本机曾被 BLOCKED）
- 提供可复现命令（写在 README/交付报告，不在本机强跑）：
  ```bash
  docker compose up --build -d
  curl -fsS http://127.0.0.1:8080/healthz
  curl -fsS 'http://127.0.0.1:8080/api/forecast?latitude=30.02&longitude=119.00&hourly=temperature_2m&forecast_days=1'
  # 浏览器桌面/手机走查首页、14 天切换、对比、点位页、详情抽屉
  ```
- 验收：`docker compose up --build -d` 健康；网页可访问；重启后静态资源与 SPA 回退正常；代理可取数。**未实际执行的不写 PASS**，如实记录待用户机器验证。

## 3. 提交与分支
- 基于当前分支 `codex/local-validation-and-hardening`（HEAD `2385e6b`）。
- 不 `git add -A`；按文件精确暂存；不动 `node_modules/`、`dist/`、`.env`、`AGENTS.md`、`.workbuddy/`。

## 4. 明确不在本增量（后续单独立项）
Redis 缓存、Postgres 预报/决策快照、定时刷新 Worker、登录/关注/出发提醒/现场反馈/校准面板、QWeather/CMA 适配器、Sentry 监控。这些需要后端栈，与当前 SPA+Sites 模型冲突，且 `HANDOFF_CODEX.md` 将其标为“准备公网生产后再实施”。

## 5. 风险
- 本机无 Docker：T6 只能写命令与断言，无法本地跑容器（已确认）。
- 代理后客户端不再依赖 Open-Meteo CORS，但仍保留直连回退，以兼容纯静态托管（无 Worker 的 Cloudflare Pages）。
- 代理会放大 Open-Meteo 速率限制；本增量仅在 nginx/Worker 做透传，缓存与限流留待后端增量。

## 6. 备选（若用户选 B / C）
- **B 展开**：在 A 基础上增加 Node/Express（或复用 Worker）的 `/api/forecast` 服务端缓存（Redis）、`/api/refresh` 限流与重试、Postgres（Prisma）`forecast_snapshot`/`decision_snapshot`/`field_report`/`score_model_version` 表、定时刷新（容器启动补跑 + cron）、健康检查与过期告警。需新建后端服务与 Docker 服务编排（web/worker/redis/postgres 数据卷）。工作量约 A 的 5–8 倍，且偏离 SPA+Sites。
- **C 展开**：跳过 T1–T4，仅执行 T5 的测试子集 + T6 的 Docker 验证；确认当前 SPA 在容器中 `/healthz` 与 SPA 回退正常。
