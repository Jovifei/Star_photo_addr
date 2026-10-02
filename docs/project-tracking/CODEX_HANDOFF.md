> **2026-10-02 v1.0.24 最新交付**：云海/火烧云日期、晨晚时段常驻顶部直接选择，移除调整弹层和手机空白占位。PR44/45已合并，运行代码6389bef784c12b4bc1c7aaee0fa3a93d852766a5。72文件414测试、28几何/6交互组合及12手机地图手势通过；线上390px工具栏紧接搜索，所有选项可见，无横溢或地图覆盖。完整记录见[日期工具栏交付](../engineering-change-log/2026-10-02-direct-date-toolbar.md)。以下旧版本事实仅供历史参考。

> **2026-10-02 当前交付已完成**：PR41/43 已合并并同步原目录 main；部署代码 `4460382fc2991b3af5555816f307c2318f5b962a` / v1.0.23。完整检查72文件414测试、lint/typecheck/build通过；浏览器10PASS6适用性SKIP，最终缺字段提示回归1PASS。真实线上12行84评分，取样点今晚45，BestMatch源抓取2026-10-02T06:23:56.895Z，stale=false；app/worker健康，原卷和回滚镜像保留。ICON缺能见度仍暂缓该模型评分，已明确说明原因。远端真实修复9c249d5已接收验证；旧聊天长度上限，接力聊天待Jovi决定。以下旧候选/失败状态仅为历史。详见[当前交付记录](../engineering-change-log/2026-10-02-branch-consolidation.md)。

# Codex 接力说明：逐星测试与项目跟踪

## 当前接力状态：2026-10-02（集成中，尚未最终发布）

最新事实以 [功能分支归并记录](../engineering-change-log/2026-10-02-branch-consolidation.md)、根 `LOCAL_CODEX_HANDOFF.md` 和当前源码/命令证据为准。本节取代下方旧快照中的“当前主线、候选和部署”表述；下方保留内容均为历史记录或仍待重新核验的长期任务。

- 隔离集成分支：`codex/starphoto-main-refresh-20261002@78c107d`，包括候选 Best Match 证据、错误状态、Next 16.3.8、模型能力/压力/worker 修复和本地持久化地点天气水合修复。历史分支按功能保留/替代后已纳入祖先，远端 refs 均为集成历史祖先。
- 原目录 `E:\project\Star_photo_addr`：干净 `main@7a572b538caad9a881066cdd8c301a161c1523d1`；Owner 原修改由 `ef15634` 和独立备份保护。最终功能合并后仍需再次同步原目录。
- 完整本地 `npm run check`：lint/typecheck、71 个测试文件/411 测试和 build PASS。E2E 仍有 2 项桌面 loading 失败，第一轮水合修复后的相关单测通过；最终 UI 门禁保持 `CHANGES_REQUIRED`，不能用完整 check 代替。
- 已有真实单点 Best Match 来源 `sourceFetchedAt=2026-10-02T05:23:26.681Z`、stale=false，两个观测夜评分验证通过；不代表全部候选或生产页面验收。
- 远端实际修复分支 `candidate-pressure-review-followup@c3626d9` 仍在执行，尚未收到最终交接，也未合入最终 main。精确 SHA 的最终远端审核 `PENDING`。
- 生产仍为 `bd23a7c442e1` / v1.0.22。本轮 GitHub main 合并、最终原目录同步、合并 SHA 验证及部署未完成。
- 知识库已增量登记明确项目映射并保留其他 7 个映射及配置备份；安全 tracked 文档镜像待最终文档冻结后执行，不将注册视为镜像完成。

下一步：修复 E2E loading 失败 → 接收远端真实修复与交接 → 对最终提交重跑针对性和完整门禁 → 合并 GitHub main / 同步原目录 → 合并 SHA 测试 → 保留回滚的低内存部署 → 公网数据与页面复核 → 安全知识库同步。

## 以下为历史快照（请勿用作当前发布状态）

> 当前事实源：仓库文档，不以聊天摘要代替。  
> 当前主分支：`main@50496e61f0be1cb666f344f36d832029df2e988e`  
> 当前跟踪分支：`test/ux-research-quality-v2-20260820`

## 1. 开始前必须读取

```text
docs/project-tracking/README.md
docs/project-tracking/PROJECT_STATUS.md
docs/project-tracking/TEST_BACKLOG.md
docs/testing/TEST_PLAN_V1.md
docs/testing/TEST_STATUS.md
docs/project-tracking/CHANGE_LEDGER.md
```

然后读取所选工作包相关的源码、测试和最近工程修改记录。

## 2. 任务选择规则

1. 从 `PROJECT_STATUS.md` 选择最高优先级且未阻塞的工作包；
2. `MANUAL` 任务可以编写检查清单和辅助脚本，但没有真机证据时不得标记 PASS；
3. `BLOCKED` 任务只能准备脚本/文档，不得虚构 ECS、TLS 或科学校准结果；
4. 同一工作包只使用一个活动分支；
5. 不要同时创建 performance、visual、docs 多个分支；
6. 先完成代码与测试，再更新状态和提交台账。

## 3. 推荐下一工作包

优先建议：

```text
PERF-K6-050
PERF-K6-100
PERF-SOAK-030
```

建议放在同一个分支：

```text
test/performance-baseline-v1-YYYYMMDD
```

实施内容：

- `tests/performance/k6-smoke.js`；
- `tests/performance/k6-load.js`；
- `tests/performance/k6-soak.js`；
- 负载测试环境变量和安全保护；
- npm scripts；
- 可手工触发的 GitHub Actions workflow；
- JSON/HTML artifact；
- 文档和状态更新。

重要限制：

- 默认压测缓存命中和应用层，不对第三方 Provider 直接放大压力；
- 强制刷新必须使用极低比例，并验证应用冷却；
- 没有隔离预发布环境时，只提交脚本和 dry-run，不在生产执行；
- 不能把预期 429 计为业务 5xx，但必须单独统计。

## 4. 标准执行流程

```text
读取事实源
→ 确认 main HEAD
→ 确认没有同工作包活动分支
→ 从 main 创建唯一分支
→ 写测试或脚本
→ 运行最小专项测试
→ 运行 npm run check
→ 运行相关 E2E/容器/性能门禁
→ 修复真实问题
→ 更新 tracking/testing/change-log
→ git diff --check
→ 提交远端
→ 创建一个 PR
→ 等待并核对最终 HEAD CI
→ Squash 合并
→ 更新 CHANGE_LEDGER
```

## 5. 文档更新清单

每轮必须检查：

- [ ] `PROJECT_STATUS.md`：状态是否变化；
- [ ] `TEST_BACKLOG.md`：是否追加执行记录；
- [ ] `TEST_STATUS.md`：测试数量、结果、Bug；
- [ ] `CHANGE_LEDGER.md`：合并后 SHA；
- [ ] `engineering-change-log`：目的、修改、验证、回滚；
- [ ] PR 描述：未完成边界是否明确。

## 6. 结果报告格式

```text
WORK_PACKAGE:
BRANCH:
HEAD:
PR:
CHANGED_FILES:
TEST_COMMANDS:
RESULTS:
BUGS_FOUND:
BUGS_FIXED:
MANUAL/BLOCKED/DEFERRED:
MAIN_MERGED:
MAIN_HEAD:
```

如果 CI 仍在运行，报告 `CI_RUNNING`；不要重复提交同内容来“催促”工具返回。

## 7. 禁止事项

- 不删除失败测试来获取绿灯；
- 不仅延长 timeout 掩盖竞态；
- 不降低断言而不解释；
- 不把 WebKit 自动化写成 iPhone 真机通过；
- 不把本地网络测试写成阿里云大陆 ECS 通过；
- 不把 VIIRS 视觉图层写成 SQM/Bortle 现场真值；
- 不在 URL、日志或 artifact 中保存 Token、API Key、精确私人位置；
- 不在同一任务中不断创建新分支。
