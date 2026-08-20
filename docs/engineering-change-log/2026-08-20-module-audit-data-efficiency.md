# 工程修改跟踪：模块功能复审、数据接口降载与阿里云部署加固

> 文档编号：`ENG-CHANGE-2026-08-20-MODULE-DATA-EFFICIENCY`  
> 仓库：`Jovifei/Star_photo_addr`  
> 基线：`main@2910b2369beb9163e7efbdbf4d59f7f064e9ac56`  
> 提交策略：不新增任务分支，以直接快进 `main` 的提交完成本轮修复。

## 1. 修改目的

继续按模块复审数据输入、刷新保护、第三方图层和生产部署边界，重点确认：

- Open-Meteo 总云、低云、中云、高云数组是否与时间轴严格对齐；
- 公共同源 API 是否会把空字符串坐标错误解析为 `(0, 0)`；
- NASA GIBS 大体积 capabilities 文档是否在卫星接口与状态接口之间重复下载；
- `refresh=1` 在冷缓存或上游失败后是否仍可绕过冷却；
- 自定义光污染瓦片的 URL、HTTPS 和署名是否一致；
- 新增构建时、运行时参数是否完整进入 Docker 与阿里云 Compose。

## 2. 分模块审计结论

| 模块 | 发现 | 修复/结论 |
| --- | --- | --- |
| 天气与云量 API | `Number("") === 0`，空坐标或列表空 token 可能形成假坐标 | 新增共享坐标解析器；拒绝空值、尾逗号、错位数组和越界坐标；显式 `0` 仍合法 |
| 云量状态诊断 | 只检查“至少一个数字”不足以识别混入字符串或无效值的数组 | 总云、低云、中云、高云必须与时间轴等长，元素只能是 `null` 或有限数，且至少有一个有效值 |
| AQI / 气压 API | 冷却期无旧缓存时仍可能再次请求上游 | 冷却被触发、无 in-flight 且无可用 stale 数据时返回 `429 + Retry-After` |
| NOAA Kp | 与 AQI/气压存在相同冷缓存强刷漏洞 | 使用统一 RefreshCoordinator 语义；冷却期没有回退数据时不再重新打上游 |
| NASA GIBS | 卫星目录接口和数据源状态接口各自下载约 5.8 MB capabilities | 新增共享 catalogue loader；共用一份缓存、一条 in-flight Promise、超时、冷却与 stale 回退 |
| 数据源诊断 | 天气与大体积 GIBS 使用同一个 5 分钟复检周期 | 分源 TTL：天气 5 分钟、光污染 15 分钟、卫星目录 1 小时 |
| 光污染图层 | 自定义 URL 可能继续显示默认供应商署名；公网 HTTP 会被浏览器混合内容拦截 | 新增构建时署名变量；无署名时使用中性文本；公网模板必须 HTTPS，本地开发可使用 HTTP |
| Docker / 阿里云 | 新署名和分源 TTL 未进入构建、运行配置 | Dockerfile、Compose、`.env.example` 同步增加参数，并提供发布后检查清单 |
| 工程结构 | 坐标解析与 GIBS 下载治理分散在多个路由 | 收敛为 `queryParams.ts` 和 `gibsCapabilities.ts` 两个单一职责模块 |

## 3. 关键 Bug 根因与修复

### 3.1 空坐标被误认为有效零坐标

JavaScript 中 `Number("") === 0`。旧接口直接 `Number(searchParams.get(...))`，因此 `lat=&lng=` 或多点参数尾逗号可能被视为合法坐标。

共享解析器现在明确区分：

- 参数缺失或仅空白：非法；
- 列表存在空 token：非法；
- 经纬度数量不一致：非法；
- 超范围或非有限数：非法；
- 显式 `0`：合法。

### 3.2 GIBS capabilities 重复下载

卫星时次路由和数据状态路由原先各自维护缓存。同一页面首开时，两条请求可能并行下载两份 NASA GIBS capabilities。

修复后两者共用：

- process-local XML 缓存；
- in-flight Promise；
- 15 秒请求超时；
- 15 分钟新鲜目录；
- 24 小时 stale 回退；
- 60 秒强刷冷却。

即使第一次强制请求失败且没有缓存，冷却窗口内的再次 `refresh=1` 也返回 429，而不是继续下载。

### 3.3 数据源状态探测频率不分成本

天气 JSON 较轻，而 GIBS XML 体积较大。现在在整体状态缓存之外增加分数据源缓存：

```dotenv
DATA_SOURCE_WEATHER_PROBE_TTL_MS=300000
DATA_SOURCE_SATELLITE_PROBE_TTL_MS=3600000
DATA_SOURCE_LIGHT_POLLUTION_PROBE_TTL_MS=900000
```

常规状态轮询不会每五分钟重新下载卫星目录；手动复检仍受整体冷却与各源缓存保护。

### 3.4 自定义光污染源署名与 HTTPS

新增：

```dotenv
NEXT_PUBLIC_LIGHT_POLLUTION_ATTRIBUTION=
```

自定义 URL 未填写署名时显示“自定义光污染参考图层”，不再错误归功默认供应商。公网 HTTP 模板会被拒绝，避免部署到 HTTPS 域名后出现混合内容空白；localhost 开发源仍允许 HTTP。

## 4. 数据语义边界

- Himawari 是卫星观测，不是未来预报；
- VIIRS 视觉瓦片只用于人工夜光空间参考，不是实时光污染；
- 未安装授权本地栅格时不显示 Bortle/SQM 数值；
- Kp 是全球行星指数，不等于某个具体地点的极光概率；
- 上游失败时只使用明确标记的 stale 数据，不伪造成功。

## 5. 测试变化

新增或更新：

- 坐标空值、尾逗号、数量错位、越界与真实零坐标单元测试；
- GIBS catalogue 并发合并、内存复用和冷缓存失败后强刷冷却测试；
- 光污染自定义署名、Leaflet 占位符和公网 HTTPS 测试；
- 云量通道错位、全空和非法元素测试；
- 保留现有云量人工刷新单请求与无 CORS 光污染瓦片 E2E。

CI 继续执行 production dependency audit、ESLint、TypeScript、单元测试、Next.js build、真实数据源冒烟、桌面/移动端 E2E、Compose/Nginx/生产容器检查。

## 6. 回滚

本轮直接提交到 `main`，未创建新的任务分支。出现回归时按提交顺序回滚；观星快照 named volume 与代码版本独立，不需要删除 `observing-snapshots` 数据卷。
