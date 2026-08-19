# 阿里云 ECS 部署与数据源运维指南

> 适用：`Jovifei/Star_photo_addr` 的 Next.js standalone + Docker Compose 部署。
> 目标：应用端口只监听本机，由 Nginx/Caddy 提供 HTTPS；天气、卫星、光污染等上游异常时可观测、可降级，不用重启容器。

## 1. 推荐拓扑

```text
公网 80/443
    ↓
Nginx / Caddy（TLS、压缩、访问日志）
    ↓ 127.0.0.1:3100
star-weather（Next.js）
    ↕ 共享 volume
star-weather-worker（观测点评分快照）
```

默认 `docker-compose.yml` 将 `3100` 绑定到 `127.0.0.1`。安全组只需要对公网开放 `80/443`；SSH 端口仅允许可信源 IP。不要把 `3100`、Docker daemon 或管理面板直接暴露到公网。

## 2. ECS 建议

个人/低流量起步建议：

- 2 vCPU；
- 2–4 GiB 内存；
- 20 GiB 以上系统盘；
- Alibaba Cloud Linux 3/4 或 Ubuntu LTS；
- Docker Engine 与 Compose plugin；
- 域名、备案和 HTTPS 按实际地域与公开访问方式准备。

地图瓦片和数值天气都依赖外部 HTTPS。ECS 必须具备稳定的出网能力；若配置了严格出方向规则，请至少允许 DNS、HTTPS 以及所使用的上游域名。

## 3. 拉取和配置

```bash
git clone https://github.com/Jovifei/Star_photo_addr.git
cd Star_photo_addr
git checkout codex/unify-stargazing-theme-20260819
cp .env.example .env
```

至少检查这些值：

```dotenv
APP_BIND=127.0.0.1
APP_PORT=3100
BUILD_REVISION=<当前 Git SHA>
SNAPSHOT_MODEL=gfs
```

可选配置：

- `NEXT_PUBLIC_TIANDITU_TOKEN`：天地图中文注记；
- `NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL`：自有/授权光污染瓦片模板；
- `NEXT_PUBLIC_ASSET_*`：只有真实资产已放入 `public/images/perseids/` 后才设为 `true`；
- `OPEN_METEO_*`、`GIBS_CAPABILITIES_URL`、`NOAA_KP_URL`：用于企业代理或内部缓存；
- `*_TTL_MS`、`*_TIMEOUT_MS`、`*_FORCE_REFRESH_COOLDOWN_MS`：数据缓存、请求超时和公开刷新保护。小流量 ECS 建议先使用 `.env.example` 默认值。

`NEXT_PUBLIC_*` 会在 `next build` 阶段写入前端包。修改这类值后必须重新构建镜像，而不是只重启容器。其余运行时变量由 `docker-compose.yml` 传给 Next.js 容器，可通过重建/重启服务生效。

## 4. 构建前的真实数据源检查

```bash
npm ci
npm run test:live
```

该脚本直接检查：

- Open-Meteo 总云量以及高、中、低云字段；
- 各天气模型的可用范围；
- 气压层云量；
- 地理编码；
- 空气质量；
- NASA GIBS Himawari 与 Black Marble 图层目录；
- NOAA Kp；
- 光污染视觉瓦片（第三方源失败会明确报告）。

如果服务器无法访问这些上游，优先检查 DNS、ECS 出方向规则、代理和跨境链路；不要通过伪造空数组或固定值让页面看起来“正常”。

## 5. 启动与发布后验收

```bash
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"
docker compose up --build -d
```

基础验证：

```bash
docker compose ps
curl -fsS http://127.0.0.1:3100/healthz | jq
curl -fsS http://127.0.0.1:3100/api/data-status | jq
```

完整发布后接口验收：

```bash
DATA_SOURCE_BASE_URL=http://127.0.0.1:3100 npm run check:data-sources
```

该命令会通过实际应用路由检查：

- `/healthz` 的应用身份与进程存活；
- `/api/forecast?refresh=1` 是否返回总云量、低云、中云、高云；
- `/api/data-status?refresh=1` 的天气、卫星和 VIIRS 2023 光污染状态；
- `/api/satellite/times` 的 Himawari 云图与 Black Marble 夜光帧、瓦片模板。

端点职责不同：

- `/healthz`：容器和 Next.js 进程是否存活；供 Docker/Nginx 使用；
- `/api/data-status`：天气、卫星、光污染等上游是否可用；上游故障只让业务降级，不应触发容器重启循环；
- `/api/data-sources/health`：为已有客户端保留的兼容别名，返回与 `/api/data-status` 相同的结果。

需要人工复检时：

```bash
curl -fsS 'http://127.0.0.1:3100/api/data-status?refresh=1' | jq
```

公开的 `refresh=1` 受到冷却保护。在冷却窗口内仍会返回最近结果，并通过 `refreshSuppressed`、`X-Refresh-Suppressed` 和 `X-*-Cache` 标识，不会为每次点击重复冲击上游。

## 6. Nginx 示例

```nginx
server {
    listen 80;
    server_name stars.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name stars.example.com;

    ssl_certificate     /etc/letsencrypt/live/stars.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/stars.example.com/privkey.pem;

    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 130s;
        proxy_send_timeout 130s;
    }

    location = /healthz {
        proxy_pass http://127.0.0.1:3100/healthz;
        access_log off;
    }
}
```

`proxy_read_timeout` 需要覆盖后台首次生成 242 个观测点快照的最长等待时间。正常交互接口仍有更短的内部超时。

## 7. 数据与刷新语义

### 天气与云量

- Open-Meteo 上游请求不使用 Next fetch 的隐式缓存；
- 应用内新鲜缓存默认 10 分钟，可用 `FORECAST_CACHE_TTL_MS` 调整；
- 用户点“刷新数据”会发送 `refresh=1`，同一坐标/模型的并发请求会合并；
- 强制刷新默认有 60 秒冷却，防止公开页面被连续点击或爬虫滥用；
- 上游失败时，默认最多回退到 6 小时内的旧值，并通过 `stale`、`X-Data-Stale` 和页面状态明确标记；
- Open-Meteo 响应只有在总云、低云、中云、高云都与时间轴对齐且含数值时才会进入缓存；
- ICON、GFS、AIFS 的最大预报范围不同，代码会按模型限制请求，不再发送无效 `forecast_days`。

### 卫星云图

- NASA GIBS capabilities 目录默认缓存 15 分钟；
- 地图平移不会重复拉取全球目录，同一时刻的并发目录请求会合并；
- `refresh=1` 同样受到冷却保护；
- 目录暂时不可达时，可使用默认 24 小时内最近成功目录，并标记为降级；
- Himawari 观测时间与 Open-Meteo 预报时间不能混用；
- `lat` 和 `lng` 是兼容参数，必须同时提供，缺少一项不会再被误解析为经度或纬度 0。

### 光污染

- 默认是 VIIRS 2023 第三方视觉瓦片，只用于空间参考；
- 单张边缘瓦片失败不会卸载整个图层；连续失败才标记为降级，后续成功会自动恢复；
- Bortle/SQM 只有安装授权本地栅格后才显示，不能根据视觉瓦片伪造数值；
- 长期生产环境建议把光污染数据迁到 OSS/CDN 或自建 WMTS，并通过 `NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL` 切换。

### 观星点评分快照

- 磁盘快照默认 30 分钟新鲜、6 小时可降级回退；
- 相同日期、模型、时次的并发请求只生成并写入一次；
- `refresh=1` 受到冷却保护；
- `time` 必须是 `YYYY-MM-DDTHH:mm`，格式错误会返回 400，不再静默忽略。

## 8. 日志与排障

```bash
docker compose logs --tail=200 star-weather
docker compose logs --tail=200 star-weather-worker
docker inspect --format '{{json .State.Health}}' star-photo-addr-star-weather-1 | jq
```

常见问题：

| 现象 | 优先检查 |
| --- | --- |
| 云量全部为空 | `/api/data-status` 中 weather；Open-Meteo 出网；模型时效 |
| 云图时间轴为空 | satellite 状态；GIBS capabilities；服务器时间与 DNS |
| 光污染图层空白 | `light-pollution` 状态；浏览器对瓦片域名的访问；自定义模板占位符 |
| 推荐点一直“读取中” | worker 日志；`data/snapshots` 卷权限；所选模型是否覆盖该日期 |
| 手动刷新无变化 | 浏览器 Network 中 `refresh=1`、`X-Refresh-Suppressed`、`X-*-Cache` 与 `X-Data-Stale` |
| 容器反复重启 | 先看 `/healthz`；上游数据故障不应成为 liveness 失败条件 |

## 9. 更新与回滚

更新：

```bash
git fetch origin
git checkout codex/unify-stargazing-theme-20260819
git pull --ff-only
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"
docker compose build --pull
docker compose up -d
curl -fsS http://127.0.0.1:3100/healthz
DATA_SOURCE_BASE_URL=http://127.0.0.1:3100 npm run check:data-sources
```

回滚到已知提交：

```bash
git checkout <known-good-sha>
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"
docker compose up --build -d
```

快照保存在 named volume `observing-snapshots`，更新镜像不会自动删除。执行 `docker compose down -v` 会删除该卷，生产环境不要误用。
