# 星野决策｜本地 Codex 继续工作入口

这是本项目唯一推荐的本地入口。请以 GitHub 最新 `main` 为权威基线，不要从旧的 `agent/map-observatory` 或 `codex/local-validation-and-hardening` 整体合并。

## Windows PowerShell 启动

```powershell
git clone https://github.com/Jovifei/Star_photo_addr.git
cd Star_photo_addr
git switch main
npm ci
npx playwright install chromium
npm test
npm run test:e2e
npm run test:live
npm run dev
```

也可先运行项目预检：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local-preflight.ps1
```

## Codex 必读顺序

1. `README.md`
2. `docs/PRODUCT_TECH_PLAN.md`
3. `docs/PERSEIDS_REFERENCE_AUDIT.md`
4. `docs/THEME_SYSTEM.md`
5. `docs/LIGHT_POLLUTION_DATA_DECISION.md`
6. `docs/CODEX_HANDOFF_MAP_PHASE2.md`

完整剩余任务、阻塞、验收口径和可直接粘贴的 Codex 提示词全部维护在 `docs/CODEX_HANDOFF_MAP_PHASE2.md`，不要继续使用旧聊天记录中的任务清单。

## 当前基线

- 地图、搜索、点击选点、定位、7/14 天即时评估已经实现。
- 候选点可编辑名称，并按 ID/坐标防止重复保存。
- Observatory Theme v2 已统一首页、地图、矩阵、点位、详情和移动底栏。
- `npm test`、生产构建、Sites Worker 和真实 Open‑Meteo 冒烟测试已通过。
- 26 个 desktop/mobile E2E 用例已写好；本轮云端环境缺少 Chromium，必须在本地安装浏览器后实际跑完并检查 `docs/qa/` 截图。
- Docker `/healthz` 与真实设备 GPS 仍需在相应环境验收。
- 光污染与多模型云图尚未接入；数据边界见专门决策文档。

## Docker 验收

```powershell
docker compose up --build -d
curl.exe -fsS http://127.0.0.1:8080/healthz
```

预期 `/healthz` 返回 `ok`，未知前端路径回退到 `index.html`。

## 直接给本地 Codex 的一句话

```text
请以最新 main 接管 Jovifei/Star_photo_addr，完整阅读 LOCAL_CODEX_START.md 和 docs/CODEX_HANDOFF_MAP_PHASE2.md，先安装 Chromium 并完成 26 个 desktop/mobile E2E、截图审查与 Docker /healthz 验收，再按交接文档进入 P1；直接执行并提交独立分支，不得把普通卫星夜光辐亮度伪装成 SQM/Bortle，也不得声称未运行的测试已通过。
```
