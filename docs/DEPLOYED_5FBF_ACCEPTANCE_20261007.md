# 逐星 5fbf7ba 发布后验收 — 2026-10-07

状态：已部署，阶段功能验证通过；全站科学、真机/读屏和跨产品身份验收仍未完成。

## 精确版本与测试
- 已部署产品 SHA：`5fbf7bac2c925d068f4c04274cbdbe79b0672ead`，tree `c22eba4d38d8c2757fd7d5fb618c5e0e2b76d7b6`。版本号仍1.0.27。
- 现网：https://photo.joviluma.com
- CI：https://github.com/Jovifei/Star_photo_addr/actions/runs/37607724883 。通过服务器普通 GET 独立核对精确SHA与终态：quality、live-data-smoke、container-smoke、cross-browser-smoke、e2e五任务均SUCCESS。
- 本地应用源代码资格：86文件496测试、lint/typecheck/build通过。最终5fbf精确构建通过。
- 本地完整浏览器运行388 planned：259PASS、3FAIL、126适用SKIP；修正三个旧DOM范围契约后，定向3PASS、1适用SKIP。属于完整运行加失败项复测闭环，不能写成本地单次全绿运行。托管完整CI在5fbf上已SUCCESS，但未读取其测试数量。
- 5fbf相对7e42只改变两份浏览器测试，功能断言保留：兼容链接地点、可见控件、实际地图过滤、存储、键盘阈值和顺序。

## 真实发布缺陷与修复
首次覆盖旧镜像目录后的健康SHA正确，但服务实际首页SHA为0b5e256e…，与打包首页abd95ebe…不同，浏览器仍加载旧前端（地图560px、暗夜10h）。这是真实发布失败，不能以健康200结束验收。

改为在新镜像构建层完整替换应用构建/依赖/静态目录，再复制最终standalone；不清除任何生产缓存、原快照卷或原镜像。修正镜像ID：`sha256:aa57d67d8800467affbf644640dc4c924000b71bf3977d639bb0c89d4b806b4e`。应用和worker均healthy、重启0。`scripts/check-release-frontend.mjs`在覆盖镜像RED、替换镜像GREEN；正式服务首页、火烧云、云海响应与各自打包HTML哈希全部相同。

验收容器必须设置与生产相同的非敏感快照目录。错误地用14天查询任意最新缓存也会造成测试误判；缓存探针按该记录实际覆盖天数查询。匹配目录/查询后，隔离容器cache-only冷读HTTP200、stale=false、保留原始时间；没有请求供应商。

## 真实天气和页面证据
- 一次有界LA/GFS生产请求：sourceFetchedAt `2026-10-07T10:38:41.005Z`，stale=false，72小时/72能见度值，请求坐标34.0522/-118.2437，America/Los_Angeles，offset-25200。
- 原响应候选计算在10:40:22Z通过：score93、go、10采样、暗夜估算9h；时间没有洗新。仅证明该地点/模型和时刻，不代表科学准确率或全站数据通过。
- 修正镜像上线后的504×1244实际网页DOM：地图440px、横向溢出0、GFS原值云5%/雨0mm/风2.1m/s、score93、暗夜估算9h，原始抓取10:55:35.051Z。DOM证据已保存；浏览器截图连续两次失败，没有虚构截图或手机真机验收。
- ICON缺能见度时仍暂缓评分，不能混入GFS/BestMatch字段。有效原始天气和天文几何分别展示。

## 保护和剩余工作
原快照卷保留；一致备份15,242,835bytes，SHA256 `92c904076e8ba11b7862403304105960fc9ff5d600c7284c311c1f289c4d0294`。原378镜像82f5a0ba…与配置回滚引用保留。仅清理本轮临时7e42验收容器/镜像；没有Docker prune或删除用户数据。

Git ls-remote及实际push均成功。gh未登录、公开API本地403限流、网页连接失败是不同问题；通过服务器普通GET已取得完整CI结果，不修改VPN/DNS/代理、不新增凭据。

仍待完整验收：同名牛背山跨入口坐标冲突、Fireglow/Cloudsea快照原始来源时间、DST绝对时序、四入口全地点天气覆盖、真机与读屏。PR49仍Draft、main未合并。本报告和后续验证工具提交属于账本/工具更新，不自动改变已经验证部署的5fbf产品SHA。
