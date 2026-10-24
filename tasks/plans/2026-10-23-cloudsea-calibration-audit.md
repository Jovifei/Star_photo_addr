# 云海算法与数据校准审查计划

目标：核验94以上和30多分与实拍不符的原因，区分实现缺陷、模型地形/云层误差、时间口径、未经校准的条件指数；研究公开数据与可执行校准路径。

权限更新：Jovi已明确授权多层云误判、缺测分母、均分/峰值混用的云海算法/数据结构/UI及回归修改。没有部署授权，不修改生产配置/数据/缓存，不合并推送，不新建Codex Cloud任务。保留原目录现有未跟踪reports。

- [x] 读取AGENTS、lessons与Obsidian项目进度；当前原目录分支codex/data-boundaries-20261012@f40b845，另有Owner未跟踪reports。
- [x] 核对GitHub与线上：Windows原生TLS只读核验main为cd54bc4、分支cc64cde；生产health实际7a2202c/v1.0.27。普通Git TLS初次失败，原生TLS验证成功；不切分支覆盖当前工作。
- [x] 跟踪src/lib/cloudsea.ts、cloudLayers/pressure、快照route及详情/排行显示，比较生产与当前源码。
- [x] 运行既有云海/压力层针对性检查；临时内存输入反例复核，输出到reports/cloudsea-calibration-20261023，区分fixture机制证据与真实预报准确性。
- [ ] 获取Jovi两次事件的地点/有效时间/当时预报及拍摄标签。缺事件信息时保留CASE_REPLAY_BLOCKED，不猜地点。
- [x] 只查公开来源：官方历史预报、ERA5/探空/卫星云顶/雾低云数据，及FogPy/Satpy/MetPy；核验中国范围、时间、变量、高度基准、许可/账号与下载大小。
- [x] 形成审查报告：已证实问题、未证实原因、最小修复范围、逐站/季节/提前量校准与独立留出验证；授权后才修改实现。

验证边界：既有单测PASS只证明代码符合既有假设，不代表科学概率校准；历史再分析不能替代当时发出的预报，卫星顶云不能直接证明山谷可见云海。任何生产429停止扩展请求，不refresh。
回滚/失败：本轮不变更业务/生产，无需数据迁移；外部数据不可得保留NOT_RUN，不生成经验校准数字。Hub revision本次WinError10061，保留待处理说明，不自动重试/冒称上报。

修复完成：602项Vitest、源码lint、辅助类型检查、dev离线浏览器16PASS/14SKIP、独立复核无阻断；canonical lint/types/build受既有Owner诊断报告阻断。没有部署或概率拟合。详见docs/audits/CLOUDSEA_CALIBRATION_AUDIT_20261023.md。
