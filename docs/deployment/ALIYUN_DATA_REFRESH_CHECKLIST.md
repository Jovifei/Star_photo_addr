# 阿里云数据刷新部署检查清单

> 配套文档：`ALIYUN_DEPLOYMENT.md`。本页聚焦模块复审后新增的数据配置和验收点。

## 1. 构建时变量

```dotenv
NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL=
NEXT_PUBLIC_LIGHT_POLLUTION_ATTRIBUTION=
```

替换默认光污染瓦片时应同时填写真实来源/版权说明。若只填写 URL，页面显示“自定义光污染参考图层”，不会继续错误标注默认供应商。两项均属于 `NEXT_PUBLIC_*`，修改后必须重新构建镜像。

公网瓦片必须使用 HTTPS；只有 `localhost`、`*.localhost`、`127.0.0.1`、`::1` 允许 HTTP 开发源。模板必须包含 `{z}`、`{x}` 和 `{y}` 或 `{-y}`。

## 2. 运行时探测 TTL

```dotenv
DATA_SOURCE_HEALTH_TTL_MS=300000
DATA_SOURCE_WEATHER_PROBE_TTL_MS=300000
DATA_SOURCE_SATELLITE_PROBE_TTL_MS=3600000
DATA_SOURCE_LIGHT_POLLUTION_PROBE_TTL_MS=900000
```

NASA GIBS capabilities 文档体积较大，因此卫星目录默认一小时复检一次；天气保持五分钟，光污染瓦片十五分钟。手动 `refresh=1` 仍受应用冷却、并发合并和 `Retry-After` 保护。

## 3. 构建与启动

```bash
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.aliyun.yml \
  up -d --build
```

## 4. 发布后验收

```bash
curl -fsS http://127.0.0.1:3100/healthz | jq
curl -i 'http://127.0.0.1:3100/api/data-status?refresh=1'
curl -i 'http://127.0.0.1:3100/api/forecast?lat=30.2741&lng=120.1551&days=1&model=icon&refresh=1'
npm run check:data-sources -- http://127.0.0.1:3100
```

检查响应头：

- `X-Refresh-Suppressed`：强刷是否被冷却；
- `Retry-After`：允许再次强刷的等待秒数；
- `X-*-Cache`：memory、coalesced、refresh、stale-memory 或 refresh-cooldown；
- `X-Data-Stale`：是否使用明确标记的旧数据。

## 5. 功能验收

1. `lat=&lng=`、尾逗号和经纬度数量错位应返回 400，不得变成 `(0,0)`；显式 `lat=0&lng=0` 仍应合法。
2. 连续请求卫星目录与 `/api/data-status` 时，不应重复下载同一份 GIBS capabilities。
3. 光污染模式应加载瓦片；自定义源的署名应与配置一致，公网 HTTP 模板应被拒绝。
4. 云量数据必须同时包含总云、低云、中云、高云且与时间轴等长，不能以空数组、字符串或错位数组显示成功。
5. 连续强刷且无缓存时应出现 `429 + Retry-After`，不能绕过冷却反复访问上游。
6. `/healthz` 与第三方状态解耦；上游波动不得触发容器 liveness 重启循环。
