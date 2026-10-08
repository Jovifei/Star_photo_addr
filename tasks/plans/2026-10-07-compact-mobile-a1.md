# 紧凑手机与数据修复执行计划

执行目录：tmp/acceptance-offset-20261007，分支codex/compact-mobile-a1-local-20261007。原目录78f9858与Owner dirty笔记不覆盖。已将远端478e008合入隔离候选作修复基础；该版本不能发布。

远端原Project/接力恢复，但实际工具只有读取能力；本地根据已有授权执行，远端继续审核。所有本地代码明确标记LOCAL_CODEX_AUTHORED。

- [ ] T1：store点位时钟auto/explicit来源；保留请求前/请求中/换地点/缓存/URL时间；CandidateList→PerseidsApp传目录日期。先添加失败测试，再修复；tests/unit/storeHydration、nighttime、ProductStateBridge相关门禁。
- [ ] A1：独立nightAstronomyFacts，点位/timezone/合法provider时间为输入，ObservationDetails/CloudTimeline/HomeDataSheet/PerseidsApp集成；ICON缺visibility不隐藏天文，评分仍暂缓；旧不可信偏移/stale不变成可信天文，unknown海拔仍未知。单元与组件契约验证。
- [ ] UI：mobile-map-first.css/MobileDataSheet compact摘要与单portrait文档滚动；half保留核心数据，full提供完整数据；地图约40svh/短横屏单独处理；常用标题14–16px、数据13–14px，touch区域/200%文字放大保留；不添加全局!important叠层。
- [ ] 本地：定向tests，完整lint/types/locked tests(maxWorkers2原超时)/build；现有Playwright fixture及504/375/390/412布局、200%、四入口与滚动。真实手机只在仍显示本项目时操作，不干扰其他任务。
- [ ] GitHub：独立候选提交/完整证据和交接，远端读取精确SHA审核。未完成全阶段、真实数据/现网测试前不合并Draft49或部署。

已知保留问题：牛背山25km目录冲突未有权威坐标来源，不猜修；专题缺原始sourceFetchedAt需单独补来源继承；全球DST canonical instant后续阶段。失败即停止相应发布门禁、修复具体失败；回滚目标为现网378与保留原卷/备份镜像。
