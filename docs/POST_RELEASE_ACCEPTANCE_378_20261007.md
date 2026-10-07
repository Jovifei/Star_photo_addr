# 378 发布后验收接手账本（2026-10-07）

状态：**已部署、完整验收未完成 / DEPLOYED_ACCEPTANCE_INCOMPLETE**。不重复部署，不以Draft合并、测试数量或health200替代产品验收。

## 当前独立核查
- 原目录授权分支codex/overnight-forecast-coverage-20261003已快进21提交到378161ffe6aa21989ef48e63c9d077343d276a95，tree5e4a8d6b57fe558bce152dc7b21bf7d0e6575fad，parent944bed3637c02df0a6b08a4a3360b0e3effd7097。origin/main仍48f5562，DraftPR49未合并。
- 当前公网health实际返回378161f；app/worker实际镜像sha256:82f5a0bace4696aaa6428542befc921fdfd9ee64c460babdd9f4428c2251fe9f，均healthy，restart0，原star-photo_observing-snapshots卷保留。
- 真实读取tmp/candidate-378161f/LOCAL_ACCEPTANCE_378161F_20261006.md：其466测试/CI37502652418/nativetransform/24浏览器通过为该发布执行器记录或历史CI，当前父会话不冒称已重新全部执行。
- 原一致性备份gzip校验通过，sha2567fdbb37bcede6660cc75f4c9a766e634af838d68e6ed7e31b6485f031cec0835。回滚镜像实际ID f6c25b629feba6af1e176c6fde62d101f34a60ec5fc27f5179b2c7eea29ed02a。
- Owner两处追加文档修改先保存在本地快照分支codex/owner-notes-preserved-20261007@9331bd0及tmp/owner-preserved-20261007/owner-notes-before-sync.zip，再按追加方式保留，没有覆盖候选文档或丢弃Owner内容。

## 剩余验收与缺陷
- 当前物理手机触摸、小屏地图/预测/tooltip/滚动/返回、慢网/中断/重复操作：PENDING/物理手机NOT_RUN。
- 广泛键盘/焦点/读屏名称/对比度/动态提示：PENDING，不能用focused axe代表全站。
- 真实云雨海拔、7/14天覆盖时效、日期时区、缺失及建议来源：PENDING，health不是该门禁。
- 只读源码发现：forecast.ts允许utc_offset_seconds缺失并默认为0，Asia/Shanghai缺字段可能导致8小时时间偏移；待父会话最小复现和远端独立修复。
- 全球地点的日期选择固定Shanghai、上游timezone=auto之间存在不一致；生产海外复现未做，保持假设而非已证实生产故障。

## 远端接力
Jovi已授权同Project接力聊天；Project保持6a758ed08fcc8191b7e6184c19225bc1。新聊天6ac5c47d-2a7c-83ea-ad99-696dba6482b8已调用workspace_info并读取README，确认Star_photo_addr与378161f/原授权分支。C2C doctor bridge/mcp/tunnel green，无需重建连接器。继续远端真实修复commit→本地验证→GitHub回传→远端审核；无实际工具能力须BLOCKED，建议不能伪称已执行。

## 本地接收远端修复（待远端审核，不部署）
远端实际分支codex/postrelease-offset-integrity-20261007：RED1596e376065047342cc96e9b574c8e35e5340745，repaird543fff637c561da9bc8197ef282495081a6601e/tree15fb7c20a972d7def4ca60481738cfb41056aad0，handoffa5bccbf6a2e4a2a0b5d9b3b6e6ebe169486dbff7。Git真实获取并独立diff：只改src/lib/forecast.ts和tests/unit/forecast.test.ts。修复拒绝缺失/非有限offset，真实UTC0保留；不猜DST偏移。
本地隔离tmp/acceptance-offset-20261007使用锁定Vitest4.1.11：1596定向1FAIL/12PASS(exit1)，d543定向13PASS(exit0)；d543完整lint/typecheck82文件468测试/buildPASS(exit0)。首次npx误用未锁定5.0.3的结果弃用并保留日志，不计验收；已安装隔离目录精确锁依赖并重跑。
独立诊断：删除归一化forecast.utcOffsetSeconds后，磁盘shape检查虽接受，但scoring.ts:46拒绝评分，未证明此路径发布错误推荐；不要把这个构造误写成已证实生产错误。旧数据已被补成0且timezone非UTC的迁移风险仍待远端评估。
实际现网桌面：12行84评分，无候选请求错误，BestMatch源2026-10-07T04:30:23.908Z；无横向溢出。375x812只是尺寸模拟，物理手机仍NOT_RUN。上海14天响应360时次、offset28800、单位C/mm/m/s，前7夜各10小时有分；最后14th晚只有4小时，正确不给分。字段/时效一致性证据不证明预测准确率或全站科学资格。
