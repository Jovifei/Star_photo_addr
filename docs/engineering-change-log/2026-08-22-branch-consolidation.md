# 工程修改跟踪：工作分支审计、PR #13 合并与主干收口

> 文档编号：`ENG-CHANGE-2026-08-22-BRANCH-CONSOLIDATION`  
> 目标仓库：`Jovifei/Star_photo_addr`  
> PR #13 功能 HEAD：`fa8f2996c1145fe69c251695eb6887fcde7a538f`  
> PR #13 合并提交：`3a461c09a2cb450de710f87490ff9317b2d81a8e`

## 1. 背景

Branches 页面同时保留了多条历史分支，且 Squash 合并后的分支仍可能显示 `Ahead`，容易被误解为最新功能尚未进入 `main`。本轮目标是逐条核对分支对应的 PR，保留最新功能，完成唯一活动分支的测试修复和合并，并把后续分支规则写回仓库。

## 2. 审计结果

| 分支 | 结论 |
| --- | --- |
| `codex/unify-stargazing-theme-20260819` | PR #7 已合并 |
| `docs/readme-visual-guide-20260819` | PR #8 已合并 |
| `fix/data-refresh-aliyun-audit-20260819` | PR #9 已合并 |
| `feat/province-viewport-recommendations-20260820` | PR #10 已合并 |
| `docs/test-plan-v1-20260820` | PR #11 已合并 |
| `test/quality-foundation-v1-20260820` | PR #12 已合并 |
| `test/ux-research-quality-v2-20260820` | PR #13 已合并 |
| `audit/module-data-aliyun-readiness-20260820` | 无独有提交，`main` 已完整超越 |

这些分支中的最终功能均已进入 `main`。分支上的中间 commit SHA 未必成为主干祖先，是因为部分 PR 使用 Squash 合并；这不表示功能遗漏。

## 3. 合并前发现并修复的问题

PR #13 首次 Chromium E2E 失败在“评分颜色筛选”用例。测试固定取消“优先”档位，但 Mock 的分数分布会随当前日期变化；某些日期优先档位数量为 0，过滤前后数量合法地保持不变。

修复方式：

1. 等待控制面板和地图快照均进入 `available`；
2. 读取四个档位的实时数量；
3. 选择第一个数量大于 0 的档位；
4. 取消该档位；
5. 精确断言地图点位数量减少该档位的数量。

没有修改业务筛选逻辑，也没有通过删除测试、延长等待或降低断言规避失败。

## 4. 最终门禁

PR #13 最终 HEAD 已通过：

- production dependency audit；
- ESLint、TypeScript、Vitest 和 Next.js production build；
- Open-Meteo、NASA GIBS、Geocoding、AQI、Kp 真实数据源冒烟；
- Compose、Nginx、production image 与 `/healthz`；
- Chromium Desktop/Mobile E2E；
- Firefox Desktop 与 WebKit 核心冒烟。

## 5. 分支策略

后续固定执行：

```text
一个工作包
→ 从最新 main 创建一个唯一分支
→ 所有代码、测试修复和文档都在同一分支追加
→ 最新 HEAD CI 全绿
→ Squash 合并 main
→ 删除临时分支
```

不得因 CI 失败、文档补充或同一功能的第二阶段另开近义分支。

## 6. 分支清理边界

当前 GitHub 连接器没有删除远端 Git ref 的写操作，因此本轮没有虚报“已删除分支”。Branches 页面列出的已合并分支可通过右侧垃圾桶安全删除；删除不会影响 `main`、PR、合并提交或工程记录。

## 7. 回滚

PR #13 是文档跟踪体系和一项 E2E 稳定性修复。若需要回滚，可回滚 `3a461c09...`；不会影响观星快照数据卷、天气评分或部署数据库。
