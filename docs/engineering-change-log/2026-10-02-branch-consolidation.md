# 2026-10-02 功能分支归并与原目录主线同步

## 当前结论

Jovi 授权按功能归并分支、更新 GitHub 主线、同步原目录 `main`、测试后部署，并更新本地文档和知识库。本记录是集成中状态，不能作为推送、合并或部署完成凭据。当前源码和最终验收结果优先于本记录中的历史条目。

## 分支功能处置

| 分支 / 提交 | 功能核对与处置 | 当前状态 |
| --- | --- | --- |
| candidate-weather-evidence-20261001 / 768300e | Best Match 候选评分与云图模型分离，保留天气原始事实和来源时间；已进入隔离集成分支 | LOCAL_INTEGRATED |
| 本地 54abd71 | 候选表显示服务端错误和 Retry-After，维持评分门禁；桌面/手机 429 回归已通过 | LOCAL_INTEGRATED |
| production-audit-20261002 / 7ae6483 | Next 16.3.4 升至 16.3.8；已合并到隔离集成分支，需重跑最终门禁 | LOCAL_INTEGRATED |
| location-expansion-20260909 | 地点扩充和选中夜晚时次保护已在当前源码保留；旧依赖版本不能覆盖新依赖 | FUNCTION_PRESERVED |
| model-capability-recovery-20260915 / 4118887 | 移植仍缺失的模型评分能力、健康、压力和 worker 时间/模型校验；旧进程内 quota 实现被当前持久化熔断替代 | PORT_IN_PROGRESS |
| ui-layout-fix-20260915 / 2b3436f | cloudsea 详情卡 flex 修复已有；旧页头移动规则须以当前共享 ProductHeader 验证，不能覆盖现有四栏目布局 | AUDITED_CURRENT_LAYOUT |
| widescreen-dashboard-20260924 / f888a9a、7b4e7c1 | git cherry 显示主线已有等价补丁 | PATCH_EQUIVALENT |
| restore-weather-unify-header-20260930 / 555cdf8 | 无独立功能补丁，已有功能归并历史 | HISTORY_ONLY |
| docs-refresh-20260918 | 保留缺失的模型恢复候选记录、文档刷新记录和开源研究；明确为历史，不覆盖后续工程记录 | HISTORICAL_DOCS_RETAINED |
| Owner snapshot ef15634 | 火烧云空数据保护、日期、手机布局功能已有或被扩展；保留独有历史 UI 记录和过程计划 | BACKED_UP_AND_AUDITED |
| audit/ui-information-architecture-20260829 / a025897 | 历史审查捕获记录；不替代当前源码或发布验收 | HISTORY_ONLY |
| 其他已为 origin/main 祖先的分支 | 功能已归入主线，不重复应用旧树内容 | ALREADY_ANCESTOR |

分支祖先最终归并和远端 main SHA 仍待父任务完成。历史分支不删除；已被当前实现替代的旧补丁须先给出功能依据，再记录历史归并。

## 原目录与 Owner 保护

原目录此前 `main@3334e0c` 落后 origin/main 100 提交。已备份 20 个 dirty/untracked 文件、二进制补丁和 manifest，保存本地保护分支 `codex/owner-preserved-20261002@ef15634ef7de914d6c5ea0a17f1189a666ec5194` 后，原目录 `main` fast-forward 至 `7a572b538caad9a881066cdd8c301a161c1523d1`，工作树干净。后续功能合并完成仍须再同步一次原目录。未提交私有服务器指南、私有部署脚本、凭据或环境文件。

## 测试与真实数据证据

- 候选集成和错误提示版本：lint、typecheck、68 单测文件/399 测试、Next build PASS；桌面/手机 429 E2E 2/2 PASS。这些发生在新依赖和模型能力移植之前，不能冒充最终 SHA 门禁。
- 生产持久化供应商冷却标记读取结果无标记。随后一次有界 Best Match 真实请求返回 fresh、stale=false、sourceFetchedAt=`2026-10-02T05:23:26.681Z`。本地保存该响应后，使用真实评分函数验证两个观测夜通过；未为评分验证再次请求供应商。
- 单点真实证据不证明整套候选表、其他模型或所有专题已经恢复。HTTP 200、健康检查和 fixtures 不构成生产天气通过。
- 当前已部署 revision 仍为 `bd23a7c442e1` / v1.0.22。本次远端 merge、部署及渲染验收待完成。远端 ChatGPT 精确 SHA 审核尚无有效最终结论，不得写成通过。

## 知识库同步门禁

`codex-memory discover-project` 通过 Git remote 识别 `star_photo_addr`，但 `mapped_source_root` 和 `mapping_source` 为 null。因此正式文档镜像仍须先建立明确项目映射。`setup.ps1 -Apply` 会重写 home/company profiles 并清空 mappings，不适用于保留现有配置的增量注册。

安全步骤：读取已批准的 home memory_root 和现有映射；预览仅新增本项目 source_root 的配置差异并备份原配置；保留所有其他 profile 和映射；校验 Vault 标记、项目身份和敏感过滤；文档镜像 DryRun 通过后调用安装的同步 wrapper。不得推断新 Vault、镜像私有部署指南/脚本、原始日志或过程 tasks/plans。本次子任务没有修改知识库配置。

## 下一步验收

完成模型/压力/worker 移植 → 最终集成门禁 → GitHub main 功能归并 → 原目录 main 同步 → 合并 SHA 门禁 → 低内存部署与回滚保护 → exact revision/真实评分/页面证据 → 远端交接审核 → 知识库安全镜像。

## 合并门禁发现并修复的真实页面缺陷

浏览器2项桌面失败定位为 StoreProvider persisted selection hydration race：自身 loading 更新触发 effect cleanup，完整HTTP200天气被丢弃。已移除该自取消标记，保留请求编号/模型/地点归属门禁。新增延迟响应组件测试修复前RED、修复后GREEN；完整检查和浏览器重新验收进行中。


## Remote exact-SHA review follow-up

Remote review base: `a496632630a50b7a11ef940c4d0dde100b80ee3a` (PR #41 head at review time).
Remote repair branch: `codex/candidate-pressure-review-followup-20261002`.

The exact-source audit accepted the main direction of the consolidated tree:

- candidate comparison uses a separate `candidateForecastModel` with Best Match as the new-session default, while the raster `cloudState.model` remains ICON by default;
- six saved candidates fit in one bounded candidate batch (the loader supports up to 64 per request), and an independently selected point uses the same candidate-score model without borrowing the raster forecast;
- fresh same-model ICON weather with missing visibility keeps raw cloud/precipitation/wind and source timestamp but withholds score/rank with an exact visibility blocker;
- stale/model/freshness gates remain fail-closed;
- pressure requests enter the shared Open-Meteo provider slot and propagate typed 429 errors;
- Shanghai 00:00–05:00 belongs to the previous observing night for the snapshot worker, while Fireglow prewarm continues to use the calendar date;
- historical branches are migrated by functional ownership and current-tree precedence rather than overwriting the current tree with old branch contents.

Two bounded defects remained:

1. `StarWindowTable` selected-row rendering still used global raster `state.loading`. A slow ICON selected-location request could therefore keep an already-resolved Best Match candidate row stuck at `…`, violating the intended model/lifecycle separation and matching the observed desktop loading-timeout symptom.
2. `/api/pressure-forecast` used only the local refresh coordinator's short `Retry-After` in its early suppression path. During an active shared provider daily cooldown, a repeated force refresh could expose a shorter retry window than the provider circuit.

The remote follow-up removes those two couplings only. It does not change score weights, required scoring fields, candidate model defaults, raster model defaults, pressure-profile derivation, CloudSea scoring, provider model mapping, historical branch migration, or deployment behavior.

Remote test execution for this follow-up is `NOT_RUN`; local Codex must run the targeted tests plus the full check/browser gates before integrating it. The prior `a496632` local evidence (70 files / 410 tests and build) remains evidence for that exact SHA only. The current PR browser gate was still not green at review time (7 pass / 5 skip / 2 desktop loading failures), so neither PR #41 nor this follow-up is approved for merge/deploy until the local rerun closes those failures.

## 页面性能根因修复

接收远端9c249d5后，同一浏览器门禁定位到日期格式器构造瓶颈。CPU profile显示约11.9秒耗在 localDateKey 每次创建Intl.DateTimeFormat。按时区复用并限制32项，保持日期算法不变；原两个桌面失败场景用原等待阈值分别1.7/2.0秒PASS。43项日期测试、类型和lint通过。临时诊断及非必要天文缓存已移除。最终完整门禁继续执行。


## 2026-10-02 Final pre-merge receipt

- Integrated remote repair/handoff9c249d59c6d21a661d1971f2c53f6e9d7f2dec54 with local hydration and measured date formatter fix42ee347accd53ed37500a0b30afaad3b5fc492e2.
- Final npm run check PASS:72 files413 tests, lint/typecheck/production build.
- Same browser gate plus remote selected-row regression PASS:10 passed6 applicability skips,29.2s. No failing tests, no waits extended. Four-product desktop/mobile header geometry included.
- Production dependency audit:0 vulnerabilities.
- Every local/remote branch ref is an ancestor of the integration head at this receipt; historical branches retained.
- Remote exact-source review returned CHANGES_REQUIRED on a496632 and produced real repairs9c249d5. Repairs now locally tested. Existing remote conversation reached its length limit; next audit requires Jovi's pending same-Project chat handoff decision. Do not claim a later remote DONE verdict.
- Next authorized steps:merge PR41,ff original main,install matching deps,verify merged code,deploy local exact-revision standalone overlay,retain rollbackimage and originalvolume,verify genuine API+page and sync filtered knowledge docs.

## 已部署实证与提示修正

PR41已合并main c669fd501e4e9f8444bf61ed093531aa16d08475。原目录main干净，与origin/main领先/落后0/0；依赖与原目录完整检查72文件413项通过。线上v1.0.23同revision，app/worker健康，原数据卷和rollback镜像保留。真实浏览器12行84个BestMatch有效分，上海取样点今晚45分，源抓取2026-10-02T06:09:55.44Z，stale=false；手机390px四tab均90px/13px字体，header48px，无页面横溢。桌面header65px。

线上验收发现加载完成但ICON缺能见度时主提示仍写正在同步。已增加结束状态的精确字段缺口说明，不改变评分或模型。跟进候选完整检查72文件414项PASS，缺能见度且不声称同步的E2E1/1PASS；待跟进合并部署。

