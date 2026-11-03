# 当前交接 — 2026-11-03 火烧云未评分状态修复

状态：REMOTE_AUTHORED / CODE_COMMITTED / CI_VALIDATION_IN_PROGRESS / NOT_DEPLOYED。
本条仅属于 PR66；不调用本地 agent，不合并 PR65，不部署，不操作 Owner 工作目录。旧交接中的部署权限不适用于本次任务。

## 精确身份

- 仓库：`Jovifei/Star_photo_addr`
- 基线 main：`d2e42ede7f73b35ab5dae746608b2a7d321dfa5e`
- 基线 tree：`7dd36993fe0bb0eaccb8fe37579ddfee6e089279`
- 独立分支：`codex/fireglow-window-status-20261103`
- Draft PR：https://github.com/Jovifei/Star_photo_addr/pull/66
- 行为回归 RED：`010a6e4499c25509652c821dae62b2e61f09cbb8`
- CODE_HEAD：`03e77efa73f78aeec332ce683221b38ed8546e2c`
- CODE_HEAD tree：`91b2e444fc9a2ebbd9cb729665043464e1e09969`
- 本文件在 CODE_HEAD 之后单独提交；最终分支文档 head/tree 见 PR66。不得把文档 SHA 和上面的产品/测试 SHA 混为一谈。

## 已复核的缺陷

原 `fireglow.ts` 在有效晨昏时次全部因降水 >0.3 mm 被排除时，返回 null 分数及全部为空的天气指标。`fireglowQuality.ts` 又将所有 null 分数当作数据不足；详情没有显示真实原因。前端及 API 还把“没有数值评分”当作“没有可用快照”，造成全雨结果被误判为上游失败或被旧晴天缓存替代。

本轮在当前 main 源码及真正执行的 RED 测试中核实，不沿用旧 378/5fbf 运行版本。

## 修改与不变量

1. `src/lib/fireglowWindowStatus.ts`：统一 scored / rain-excluded / no-solar-window / insufficient 状态和文案。旧快照仅兼容两种已知的精确原因；未知 null 仍为 insufficient。
2. `src/lib/fireglow.ts`：降水排除保留真实单一时次的低/中/高云、能见度、降水、referenceTime。参考样本按距地平线最近的有效太阳高度选取，不称“最佳时刻”；score、probability、vividness、peakTime 仍为 null。原 <=0.3 mm 门槛、太阳高度区间、云权重、数值评分公式不变。
3. `src/lib/fireglowQuality.ts`：分开数据资格和气象排除；原始来源时间、模型、provider、stale、refresh failure 验证仍在前。
4. `src/app/api/fireglow/snapshot/route.ts`：有效快照计数包括数据支持的排除结果，不等于有推荐分。原缓存键、保留时长、强刷冷却和70%数据覆盖保护不变；不删除缓存，不改源时间，不增加供应商请求。
5. `src/app/fireglow/FireglowApp.tsx`：摘要、地图 popup、图例、三日选择和 API 空结果处理使用同一状态语义；null 不参与数值排行或色面插值。
6. `src/app/fireglow/FireglowSiteDetail.tsx`：显示真实原因和原始天气参考时间；旧缓存丢失的原值明确“未保存”，绝不补零。无太阳窗口不再显示“关键云层数据不足”；降水排除不出现拍摄推荐或最佳时刻。

新增测试：
- `tests/unit/fireglowWindowStatus.test.ts`：9项，包含晨/晚降水、0.3边界、缺字段、无太阳窗口、缺日期、旧缓存、真实0和来源门禁。
- `tests/integration/fireglowWindowStatusRoute.test.ts`：5项，真实scorer到API；全雨可缓存、晴转雨不被旧晴结果替代、无窗口/缺字段区分、冷却零新增请求、旧源时间不洗新。
- `tests/e2e/fireglow-window-status.spec.ts`：1440px和500px，雨/缺字段/无太阳窗口/旧雨缓存；页面事实与原因、null不变0、无横向溢出；仅fixture，不能当真机或生产复核。

## 已读执行证据（写入此文档时）

### RED，实际执行
- CI 41567441431 / quality job 125692259877
- head `010a6e4499c25509652c821dae62b2e61f09cbb8`，CI checkout 为 PR test-merge `3b7cdfe8a32dee44136086a001e1148dc8f9c0d0`。
- lint/typecheck PASS；Vitest 4.1.11 新回归 **7 FAIL / 2 PASS**，全套 7 FAIL / 789 PASS。失败是行为断言，不是测试发现失败或依赖缺失。

### 修复中间代码，已执行
- CI 41568827453 / quality job 125696756631
- head `0549877e043edeeb28178edcb46b922783589ad0`。
- `npm audit --omit=dev --audit-level=high` PASS；`npm run check` PASS，119文件/801测试，lint/typecheck/build PASS。新单元9项和API集成5项全通过。
- live-data-smoke、cross-browser-smoke、container-smoke 已完成SUCCESS；Chromium完整运行因后续两行无太阳窗口文案修复而被新提交替代，其结果不得宣称最终全绿。
- CODE_HEAD `03e77ef...` 在此后只补无太阳窗口云层说明及对应浏览器断言；最终完整CI以 PR66 最新精确head检查为准，不能拿旧head代替。

### 执行边界

本会话云端命令环境无法解析外部依赖主机，因此 cloud-shell lint/test/build 为 NOT_RUN；上述执行全部来自已读取的 GitHub Actions 原始日志。未调用本地 agent。GitHub PR CI 的临时容器不属于生产部署。

真实设备、修复后大明山生产DOM/API对照、每日供应商额度根治、PR65云海问题：NOT_RUN / OUT_OF_SCOPE，不能用本次单元测试或provider smoke代替。

## 接收与发布门禁

1. 核对本分支精确 head/tree、PR66最终CI；仅接收本PR，不附带PR65。
2. Node24与项目lock依赖；需要重验时使用：
   - `npm run test -- tests/unit/fireglowWindowStatus.test.ts tests/integration/fireglowWindowStatusRoute.test.ts`
   - `npm run check`
   - `npm run test:e2e -- tests/e2e/fireglow-window-status.spec.ts tests/e2e/fireglow-site-quality.spec.ts`
   - `npm run test:e2e:cross-browser`
3. 分别核对真正缺数据、无符合太阳高度的时次、降水条件排除，所有null仍为null。查看旧快照时允许原始天气仍未知，不清缓存或强刷供应商来掩盖这一事实。
4. 没有本次部署授权，不更换生产容器、不合并主分支。后续获授权发布后再按既有前端资源一致性/回滚流程核对大明山同日晨晚接口、桌面及500px，记录来源时间和部署SHA。
5. 物理手机、390px及实际读屏单独验收，未运行明确标注。

## 历史交接

本PR之前的完整交接原文保持在不可变基线：
https://github.com/Jovifei/Star_photo_addr/blob/d2e42ede7f73b35ab5dae746608b2a7d321dfa5e/LOCAL_CODEX_HANDOFF.md
本分支未触及 `tasks/lessons.md`、`tasks/todo.md`、部署配置、依赖锁或其他产品代码。
