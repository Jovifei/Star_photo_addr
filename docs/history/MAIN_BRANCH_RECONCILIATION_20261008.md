# 主分支功能整合 — 2026-10-08

Jovi本次授权：按功能合并远端分支、解决冲突、测试后归并main并同步原目录。此前暂停的定时循环保持暂停；本次没有部署授权扩展。

## 基线和最新功能

- 原main/origin/main：48f5562648e5dde086b387fc4065f4679f927c57。
- 原工作目录：f70d2bf，已有完成记录、Owner笔记和待办均已提交保留。
- 最新云端功能：e0573b83ef0ccb7af9847eed097635044a85960a，PR52。
- 精确云端CI37638770508终态SUCCESS为已核实的来源记录，本地整合测试单独记录。
- 正常ort合并最新云端阶段，没有源码冲突；保留本地f70收尾记录。

## 九个历史分支的功能审计

| tip | 功能覆盖/替代证据 |
| --- | --- |
| aa4683e cache-astro | HEAD..branch无独立src/tests提交；剩余交接文档。 |
| a7967fb mapsetup-a11y | fadf68c与已纳入36a9bf9的MapSetup逐字相同；旧tsx测试由可收集的e6b0c64测试替代。 |
| d8e9576 mapsetup-a11y-v2 | 无独立源码提交，仅历史交接。 |
| a5bccbf offset-integrity | 无独立源码提交；forecast.ts与已整合源码相同。 |
| 449ca9b selected-point-timezone-t1 | 旧实现已被clean/final和显式时钟所有权修复替代；不能恢复曾失败的ownership逻辑。 |
| 70e9489 selected-point-timezone-t1-clean | 全部9个源码文件与已纳入478e008相同。 |
| 766f591 selected-point-timezone-t1-final | 无独立源码提交，交接引用已纳入63a3147/478e008。 |
| 947521f v2-stale-fallback | forecast route与已纳入15282da相同，旧v2只读stale规则保留并在最新版epoch边界上延续。 |
| 4045547 v2-stale-fallback-v2 | 无独立源码提交，已保留ed74ff5回归测试。 |

只读独立审计完成后，以保留当前实现的祖先合并记录九个tip。该合并前后tree均为86ffca6f366f0c568968b56a97e7a117e04ac7b4，证明没有用旧实现覆盖最新源码。历史文档可从Git祖先查看，不把旧handoff重新置为当前事实。

## 验证与最终同步

本地lint、types、unit/contract/integration、build、完整Chromium及适用跨浏览器结果，最终main SHA和远端一致性将在完成后补充。测试/科学/设备边界继续明确：主线整合不等于未执行的真机或科学准确率验收通过。

## 本地最终实测

- lint、typecheck、生产 build：PASS。
- Vitest：91 文件、516 测试 PASS。
- 完整 Chromium：272 PASS、126 适用 SKIPPED、0 FAIL（单 worker 9.7 分钟）。
- Firefox/WebKit：12/12 PASS。
- 修复320px日期栏换行导致150px高度：四列紧凑日期布局、保持44px触摸区域。
- 修复瞬态重试测试时钟竞态：59秒检查锚定首次失败时间，不延长超时或删断言。
- 日志复制到原目录 tmp/main-integration-evidence-20261008。上述是本地执行结果；云端 CI 来源记录单独列出。

## 清理与保留

删除8张无引用中间设计截图；保留最终参考、实际测试和fixtures。Docker构建上下文排除tmp、测试报告、环境与助手状态。
四个旧接收工作树已移除；62份独有文件、Owner补丁与回执先备份到 tmp/preserved-reception-evidence-20261008。
自动审批拒绝原目录 .next、playwright-report* 和旧deploy拷贝的递归清理，未绕过执行，仍保留。生产数据卷、备份和回滚引用未触碰。

## 后续边界

原目录必须使用 E:/project/Star_photo_addr 的 main。此次整合后应核对本地main、origin/main、GitHub main相同。
真实设备、读屏和完整科学准确率仍需独立验收；本次无部署，不把构建和测试等同生产天气通过。
主线合并commit：ea635d912bf395e4aad1302d6c960d19841625a4；原目录已切main，源码和依赖清单与已测试95c4597相同。后续文档收尾commit不改变被测源码。

