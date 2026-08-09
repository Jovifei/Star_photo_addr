# Codex 接管入口

权威基线是本文件所在分支的最新提交。不要再把旧 Vite 根入口、`dist_old_*`、Comet/OpenSpec 运行态目录或仓库内复制的 UI 技能重新合入。

## 首次接管

```bash
npm ci
npx playwright install chromium
npm run check:full
```

阅读顺序：

1. `README.md`
2. `docs/gpt_plan/CODEX_HANDOFF_PRODUCT_INTEGRATION_2026-08-07.md`
3. `docs/LIGHT_POLLUTION_DATA_DECISION.md`
4. `docs/PUBLIC_ASSETS_AUDIT.md`

产品路由：`/` 逐星、`/sites` 推荐观星地点、`/planner` 星野决策。联动协议为 `lat/lng/name/elevation/night`；观测夜以傍晚日命名并跨到次日 05:00。

## PowerShell 预检

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\local-preflight.ps1
```

不得把未执行的测试写成“已通过”，不得把普通夜光辐亮度包装成 SQM/Bortle，任何部署或真实数据升级都要保留来源、许可和降级状态。
