# 工程手册（必读执行手册）

本手册是**每次提交代码、部署、排查错误时必须执行的最小步骤清单**。内容来自实际发生过的故障与解决方案沉淀。新会话开始工作前先读本文件；执行过程中遇到新错误后必须把「错误记录 → 解决方案」追加到 [docs/engineering-change-log/](./engineering-change-log/) 与本文件对应小节。

## 一、提交/发布前必须执行的步骤（每次必做）

> **流程冲突说明（2026-11-07 远端审查）**：仓库中的 `scripts/deploy-remote.ps1` 是早期"服务器端 `docker compose up -d --build`"旧入口，在低内存 ECS 上会触发 OOM（见 E-002），**不要再用它发布**。当前唯一有效流程是本节第 5 步的"本地构建运行时包 → 服务器隔离组装 → 停写备份 → 原子切换"。后续应删除或重写该旧脚本以消除歧义。

1. **确认基线与工作树**
   - `git -C E:\project\Star_photo_addr status --porcelain`：区分自己的改动与 Owner 本地未跟踪文件，不得覆盖。
   - `git fetch origin && git rev-parse HEAD origin/main`：打印两个 SHA；**功能分支上不要求相等**，但合并前必须确认 `git merge-base --is-ancestor origin/main HEAD` 通过（已包含最新 main）；直接在 main 发布时两者必须相等。
   - 生产验收以 `https://photo.joviluma.com/healthz` 实测 `version` / `buildRevision` 为准，不凭源码推断。
2. **本地门禁（按顺序执行，全部通过才能推送）**
   - `npm run check`：lint + TypeScript + Vitest + 生产构建（当前基线 120 文件 / 808 测试以上）。
   - `python -m unittest discover -s scripts/research -p "test_cloudsea*.py"`：研究脚本回归（72 项）。
   - 涉及 UI 布局时补跑 `node scripts/run-offline-e2e.mjs`（离线 Chromium）。
   - `npm audit --omit=dev --audit-level=high`：生产依赖**高危及以上审计门禁通过**（该参数只设置非零退出的严重性阈值，命令通过不等于所有级别漏洞为零）。
   - 注意：测试数量是历史基线参考，不是永久保证；Python 研究回归只在本机执行，不在 GitHub 五项 CI 内。
3. **分支与提交规范**
   - 分支名 `codex/<topic>-<date>`；commit 只包含本阶段必要文件，不夹带任务笔记、tmp 日志或私有交接资料。
   - `tasks/todo.md`、`tasks/lessons.md` 属于 Owner 本地文件，默认不提交。
4. **PR 与 CI**
   - 推送后等待 GitHub Actions 五项（quality、live-data-smoke、container-smoke、cross-browser-smoke、e2e）全部 success 才能合并；Chromium 全套偶发 1–2 项 flaky，先重跑失败 job 再判断，不得删断言降门槛。
   - 合并后必须核对 main HEAD 的 tree 与 PR 头一致，再进入部署。
5. **生产部署（低内存服务器专用流程）**
   - 流程冲突声明：`scripts/deploy-remote.ps1` 是早期"服务器端 `up -d --build`"旧入口，在低内存 ECS 上会 OOM（E-002），**禁止再用它发布**；`docs/deployment/ALIYUN_DEPLOYMENT.md` 中的同类命令仅适用于其他环境。
   - Compose 服务名：`star-weather`（容器 `star-photo-star-weather-1`）与 `star-weather-worker`（容器 `star-photo-star-weather-worker-1`）；compose 文件为 `docker-compose.yml -f docker-compose.aliyun.yml`。
   - 隔离组装：下载 runtime 包 → 校验 SHA256 → 在不挂生产卷的临时容器中组装镜像 → `check-release-frontend`（三页 HTML 与包体逐字节一致）+ `check-data-sources` 全绿。
   - 切换：`docker stop --time 30 star-photo-star-weather-worker-1 star-photo-star-weather-1` → 轮询确认零写入者（15 次 × 2s，防 Docker 状态延迟假阳性）→ `tar` 备份生产卷并 `sha256sum` 校验 → 原子替换 `.env` → 起 app → 数据门禁 → 起 worker → 公网 healthz 断言新版本。
   - 执行脚本位置：每次发布的 `assemble.py`、`switch-*-env.py`、`publish*.sh` 保存在服务器 `/opt/star-photo/.deploy-<版本>-<sha>-<日期>/` 阶段目录；切换前必须先在 `.env` 的合成副本上演练 apply/restore。阶段脚本缺失、版本无法确认，或演练未通过时，发布保持 BLOCKED，不得进入停服务、改配置阶段；人工发布必须另有完整、经过复核的操作与回滚步骤。
   - 每一步写入 `switch-receipt*/phase.txt`，已验证具备该机制的脚本执行路径上任一步失败会自动回滚到旧镜像并验证旧服务健康；人工路径不承诺自动回滚。回滚不等于修复，失败原因必须排查后才能重试。
6. **部署后核验**
   - `/healthz` 返回新版本；四入口 200；生产 `check-data-sources` 通过；关键页面 DOM/截图抽查（每阶段 2–3 张截图预算）；api 与页面数值交叉核对。

## 二、错误记录与解决方案（持续追加）

格式：**症状 → 根因 → 解决 → 预防**。

### E-001 Windows 递归删除被安全策略拒绝
- 症状：PowerShell 管道 `Get-ChildItem … | Remove-Item` 大规模清理时报错或被策略阻断。
- 根因：混合枚举与删除的管道在 Windows 上被拦截；跨 shell 组合删除有路径注入风险。
- 解决：单一 PowerShell 原生命令，用 `-LiteralPath` 精确路径逐个删除；或用 `apply_patch` 的 Delete File。
- 预防：不做通配递归删除；临时文件在创建时就登记在 `tmp/<task>/` 内。

### E-002 Next.js 构建在低内存 ECS 上 OOM
- 症状：服务器 `next build` 触发 OOM killer 或长期卡死。
- 根因：Turbopack 编译 + 单进程内存不足（服务器仅 1.8 GiB，且与其他容器共享）。
- 解决：本地（Windows）完成 `npm run build`，只上传 `.next/standalone` 运行时包；服务器仅组装镜像并运行。
- 预防：禁止在服务器上执行构建；部署脚本只做校验 + 组装 + 切换。

### E-003 Playwright Chromium 偶发 `boundingBox()` 失败
- 症状：CI e2e 中 `responsive-layout.spec.ts` 等用例偶发宽度为 0。
- 根因：疑似动画/挂载时序竞争（同用例本地重跑 8/8 通过，但重跑通过不能单独排除产品缺陷）。
- 解决：重跑失败 job 后再合并；不得删断言；失败截图与 trace 保留在 CI artifact 中。
- 预防：新用例优先断言稳定语义（可见、可点击），减少 boundingBox 断言；必要时用 `waitForFunction`。

### E-004 桌面断言选了不存在的移动控件
- 症状：`fireglow-window-status.spec.ts` 在 1440px 组 8/8 超时（PR66 首轮 CI 失败）。
- 根因：`mobile-map-first.css` 默认 `.topic-map-search{display:none}`，仅 `<1199px` 显示；桌面榜单只含有评分点位，未评分点位搜索不到。
- 解决：桌面用例改走目录定位链接 `?lat&lng&sourceScope=observing&sourceId=…`；断言强度不减。
- 预防：写用例前先确认控件在目标断点真实可见；产品代码与测试同步变更时，先跑本地复现再推 CI。

### E-005 Open-Meteo 免费额度 429 风暴
- 症状：部分覆盖快照不进缓存 → 每次访问全量重拉 → 上游 429 → 页面整体无数据。
- 根因：降级快照完全不缓存；客户端 600ms 后重复请求整批。
- 解决：同 `date|model` 部分结果 30 秒内沿用（`degraded-reuse`）；上游彻底失败时回退最近部分真实数据（`degraded-stale-on-error`）；云海客户端仅在"全部压力站点已收到且地面完整"时允许同轮去重。
- 预防：新增缓存策略时必须有"绝不晋升 fresh + 显式 stale 提示"的回归测试。

### E-006 GFS 粗网格把辐射谷雾平滑成 0% 低云（低分漏报）
- 症状：现场壮观云海，模型只给 8 分；GRPK 20 个正例低云全为 0%。
- 根因：0.25° 网格平均化；`lowCloud<25 且无压力层云` 分支硬编码晴空 8 分。
- 解决：新增辐射谷雾判据（高空晴朗 + 风≤2.2m/s + 地面/谷底湿层 + 逆温层顶在山顶下方 + 峰谷落差≥300m + 原生地形）→ 62–80 分推荐。
- 证据边界：精确率 100% 仅来自 GRPK 特定开发样本（58 时次、正例捕获 12/20），不是全站预报准确率；无独立人工裁决。
- 预防：云层提取与逆温检测分离——云层绝不取地下层，逆温允许贴地层 50m 容差；单元测试 `tests/unit/cloudseaRadiationFog.test.ts` 固定行为。

### E-007 山顶被浓雾包裹却评 94 分（多层云误报）
- 症状：Sonnblick 2026-10-20 暴风雪白化，旧算法只取最低云 deck 判"云上"并给 94/86/82 分。
- 根因：缺少第二层包裹检测与云顶上界校验。
- 解决：保守规则收紧——上层未清/层距>750m/过渡包络一律 `score: null` 暂缓。
- 证据边界：Sonnblick 独立留出集内高分推荐归零，精确率不可估计；"没有高分预测"不等于"成功校准"，召回仍未达门槛。
- 预防：新增垂直判据必须同时给出"正例召回"与"浓雾负例"双回归。

### E-008 停写检查假阳性触发自动回滚
- 症状：v1.0.34 首次切换在"零写入者"断言处回滚，但容器实际已停止。
- 根因：Docker 状态更新延迟，`docker stop` 返回后过滤 volume 的容器列表尚未刷新。
- 解决：`docker stop --time 30` 后加 15×2s 有限重试再断言；保留首次日志，重试成功。
- 预防：所有"等待状态消失/出现"的断言都用有限轮询，不做单次断言。

### E-009 文档路径迁移后引用失效
- 症状：归类移动 docs 文件后，源码注释、测试断言、README 出现 `docs/旧路径` 死链。
- 根因：移动文件时未同步更新引用。
- 解决：移动后全仓 `rg "docs/<旧文件名>"` 扫描 src/tests/docs/README 并逐一修复；本文档即修复产物。
- 预防：以后移动 docs 文件必须在同一提交内跑引用扫描；`docs/README.md` 为唯一入口索引。

### E-010 数据源健康探针误报 degraded
- 症状：`check:data-sources` 在 ICON 缺能见度时报 degraded，CI 失败但线上可用。
- 根因：默认模型 ICON 在中国区域 `visibility` 24/24 为 null（上游能力边界），探针把"字段缺失"与"服务故障"混为一谈。
- 解决：默认评分模型改用 Best Match；ICON 保留可选并如实降级；探针按模型区分能力。
- 预防：新增上游字段时先做 24h 可用性诊断（保留原始响应 JSON 与 SHA256）再接入评分。

### E-011 迁移批处理损坏文档正文（d/D→o 全局替换）
- 症状：docs 归类提交 8c49f4f 中 8 份文档出现 `docs/`→`oocs/`、`codex/`→`cooex/`、`--bg-deep`→`--bg-oeep`、`sourceFetchedAt`→`sourceFetcheoAt` 等异常替换，Git SHA 与证据哈希被改写。
- 根因：归类时的批量 PowerShell 编辑脚本发生异常字符替换（精确触发机制未完全定位）；批量编辑后未与父提交做逐字符差异审计。
- 解决：从父提交 `42300de` 按 git 原样恢复 8 份正文（git checkout + git mv 保留字节），仅用 Python 按 utf-8 精确重放路径替换。
- 预防：批量文本编辑后必须逐字符 diff 审计（非路径变更一律恢复）；把 Markdown 链接解析与内容完整性检查纳入 CI。

### E-012 私有运维文档被提交到公开仓库
- 症状：`REMOTE_DEPLOYMENT_PRIVATE_GUIDE.md`（含服务器 IP、部署拓扑）与 `INDEPENDENT_AGENT_AUDIT_REQUEST_PRIVATE_20261004.md` 被归类提交推到公开 GitHub。
- 根因：原 `.gitignore` 的 `docs/*PRIVATE*` 不覆盖嵌套目录，且已跟踪文件不受 gitignore 影响；归类时未先检查跟踪状态。
- 解决：`git rm --cached` 撤出两份文件（本地保留），补 `/docs-private/`、`docs/**/*PRIVATE*`、`docs/**/*private*` 递归忽略；历史提交中仍保留，未发现有效凭据泄漏，暂不强推重写历史，暴露范围记录在案。
- 预防：移动文件前先 `git ls-files <path>` 确认跟踪状态；含敏感信息的文件分类时默认本地保留。

### E-013 发布手册与实际部署入口不一致
- 症状：PLAYBOOK 描述的隔离组装流程与仓库内 `scripts/deploy-remote.ps1`、`docs/deployment/ALIYUN_DEPLOYMENT.md` 的服务器端构建流程并存，维护者可能从旧入口绕回会 OOM 的流程。
- 根因：新流程的执行脚本保存在服务器阶段目录而非仓库，仓库内旧入口未同步标记废弃。
- 解决：PLAYBOOK 与 ALIYUN_DEPLOYMENT 各处加显著冲突声明；旧脚本待后续提交删除或重写。
- 预防：SOP 文档必须指明唯一有效入口；新增流程时同步废弃旧入口。

## 三、快速排障索引

| 症状 | 先查 | 相关记录 |
| --- | --- | --- |
| 页面整体"数据不可用" | `/api/data-status`、`weather-quota-cooldown` | E-005 |
| 云海大面积"数据不足" | `X-Cloudsea-Cache` 响应头、pressure coverage | E-006/E-007 |
| CI e2e 单用例偶发失败 | 本地重跑同用例 8 次 | E-003/E-004 |
| 部署后版本未变 | `/healthz`、`.env` APP_IMAGE/BUILD_REVISION | 本文 §一.5 |
| 构建产物 HTML 不一致 | `check-release-frontend` 三页哈希 | 本文 §一.5 |
| 火烧云显示"降水条件排除" | `fireglowWindowStatus` 状态语义 | v1.0.33 CHANGELOG |

## 四、维护规则

- 每次新故障必须在本文件追加 E-xxx 条目（症状/根因/解决/预防四要素），并在 `engineering-change-log/` 留详细证据。
- 每次发布步骤变化（新增门禁、备份策略）必须同步更新 §一。
- 本文件与 `docs/README.md` 是文档体系的两个入口：本文件管"怎么做"，README 管"有什么"。
