# 接力 Prompt：逐星主线整理后验收（2026-10-08）

你接手的是 Jovifei/Star_photo_addr，唯一工作目录 E:/project/Star_photo_addr，使用 main，不新建C盘工作树。先读AGENTS.md、LOCAL_CODEX_HANDOFF.md顶部、tasks/todo.md和docs/MAIN_BRANCH_RECONCILIATION_20261008.md；核对dirty、HEAD、origin/main与实际线上SHA，不覆盖Owner修改。

## 项目目标与技术路线
四个同等入口：今夜观测、暗夜选址、火烧云、云海。提供可追溯的摄影天气、地点和时间决策，紧凑桌面/手机布局；缺失、过期和上游失败不得输出伪评分或伪推荐。
技术栈Next.js 16/React19/TypeScript、Leaflet地图、Open-Meteo模型天气、astronomy-engine天文计算；服务器天气代理、持久快照和worker分离。地点身份/坐标、模型、sourceFetchedAt、stale、绝对epoch、时区/DST须一致。修改Next代码前读本项目node_modules/next/dist/docs相关指南。

## 已完成
最新云端e0573b83ef0ccb7af9847eed097635044a85960a（PR52）已纳入整合；覆盖四入口地点上下文、坐标冲突、快照来源时间谱系、epoch/DST和旧缓存只读迁移。九个历史tip已审计：有效功能相同或已替代，通过保留当前tree的祖先合并记录，未恢复失败旧实现。
本地修复320px日期栏超高和重试测试时钟竞态。lint/types/build PASS；91文件516单元PASS；Chromium272PASS/126适用跳过/0FAIL；Firefox/WebKit12PASS。细节、分支证据见主线整理报告。
删除8张无引用中间截图；4个废旧接收工作树先备份再移除，独有文件和Owner补丁在tmp/preserved-reception-evidence-20261008。必要测试、fixtures、生产数据和回滚引用保留。

## 当前卡点与未完成验收
自动审批拒绝生成目录的递归删除；原.next、playwright-report*和部分旧deploy拷贝仍在，禁止换引擎绕过。真机全流程、TalkBack/VoiceOver和完整科学准确率未完成；测试与HTTP200不能代替生产真实天气验收。
生产历史部署是5fbf7bac2c925d068f4c04274cbdbe79b0672ead，https://photo.joviluma.com；本轮没有部署，接手须重新只读核实线上版本。供应商冷却期间禁止强制请求、清缓存、改网络。不要把旧交接的候选当成新现网。

## 下一步
1. 核实原目录main与GitHub一致，读取本次测试日志tmp/main-integration-evidence-20261008。
2. 按实际目标逐项验收数据来源/有效评分、四入口身份/日期/滚动和真机，不得把SKIPPED当PASS。
3. 发现缺陷先明确证据及最小修复范围，测试再提交；部署须遵守当时用户授权及保留原卷/回滚。
4. 远端主导流程按授权恢复：完整阶段审核/修复/规划/实施→实际GitHubcommit/PR→本地精确SHA验证→GitHub回传。不要把普通网页只读建议当云端实施。自动化当前PAUSED，不自行恢复。
5. 更新tasks账本和Hub，仅工程文档可进已批准知识库，排除私有部署/环境/凭据。

## 远端参考
GitHub：https://github.com/Jovifei/Star_photo_addr
阶段PR：https://github.com/Jovifei/Star_photo_addr/pull/52
云端CI：https://github.com/Jovifei/Star_photo_addr/actions/runs/37638770508
原Project：https://chatgpt.com/g/g-p-6a758ed08fcc8191b7e6184c19225bc1/project
审核接力：https://chatgpt.com/g/g-p-6a758ed08fcc8191b7e6184c19225bc1-zhu-xing/c/6ac5c47d-2a7c-83ea-ad99-696dba6482b8
实际云端任务：01a11684-3875-717a-8ef4-9562b3d0c01a（durable）。沿用已有绑定，勿重复创建任务。

建议技能：handoff、verification-before-completion；具体数据缺陷用systematic-debugging；恢复远端循环时用codex-with-chatgpt。