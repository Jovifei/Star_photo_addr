# 全球气压时序与证据资格阶段

父基线 f167501c0f52270d0a6f14268ab6274ca33265bb，工程源6e534c0。保留main文档/Owner笔记。

问题：单点pressure使用ISO墙钟、按墙钟索引剖面，DST重复小时不能区分；详情切换地点/模型未清旧剖面；cache-only矩阵仅把HTTP成功标READ，未核对身份/时序/字段资格，且缺pressure只读入口。

实施：复用absoluteForecastTime；pressure引入epoch-v1与逐epoch剖面，保留唯一墙钟首小时兼容视图，旧ISO按stale只读；单点auto timezone，云海目录批量继续Shanghai日期语义。详情绑定坐标/模型请求，失败/切换不显示旧剖面，选中epoch查对应剖面。pressure API版本key和cache-only不触发供应商。证据工具逐行校验模型/坐标/来源/绝对时序，科学/设备永不自动PASS，遇429停止。

验收：LA回拨两个1时不同剖面、春跳2时缺失、Kathmandu分钟偏移；旧墙钟只读降级；换地点迟到响应隔离；cache-only零供应商调用；伪造HTTP200错模型/坐标/时间不可获资格；429停止。RED/GREEN，完整lint/types/unit/contract/integration/build、Chromium与跨浏览器CI。

风险：云海现有China目录墙钟兼容不能被全球单点迁移打断；旧fixture与真实epoch区分；只增加版本空间不删缓存；不扩大评分字段/能见度门禁。回滚仅回退代码，不清卷。真机/读屏/科学NOT_RUN，供应商本VM受域名策略限制，保留具体执行错误和本地步骤。

研究：Open-Meteo官方openapi forecast timeformat=unixtime为UNIX epoch，官方代码290493ffb9b5ee66fb1336219487a346eb27d191，AGPL-3.0，仅阅读契约；Intl.DateTimeFormat现有内置IANA时区实现，无附加依赖。Temporal/polyfill不采纳：当前需求已有绝对epoch，无需引入另一日期运行时。Next16.3.8随包route文档已读，使用NextRequest/NextResponse和force-dynamic。
