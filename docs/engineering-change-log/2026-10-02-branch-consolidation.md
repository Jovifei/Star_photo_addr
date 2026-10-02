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

