# 阿里云 ECS 部署与数据源运维指南

> 适用：`Jovifei/Star_photo_addr` 的 Next.js standalone + Docker Compose 部署。  
> 目标：应用端口只监听本机，由 Nginx/Caddy/ALB 提供 HTTPS；天气、卫星、光污染等上游异常时可观测、可降级，不触发容器重启循环。

## 1. 推荐拓扑

```text
公网 80/443
    ↓
阿里云安全组
    ↓
Nginx / Caddy / ALB（TLS、限流、访问日志）
    ↓ 127.0.0.1:3100
star-weather（Next.js）
    ↕ 共享 named volume
star-weather-worker（观测点评分快照）
```

默认 `docker-compose.yml` 将 `3100` 绑定到 `127.0.0.1`。安全组只需对公网开放 `80/443`；SSH 端口仅允许可信源 IP。不要把 `3100`、Docker daemon 或管理面板直接暴露到公网。

仓库提供：

- `docker-compose.yml`：通用服务定义；
- `docker-compose.aliyun.yml`：阿里云资源限制、日志轮转和 `/tmp` 限制；
- `deploy/nginx/star-photo.conf`：Nginx HTTPS、API 限流和静态资源缓存模板。

## 2. ECS 建议

个人或低流量起步建议：

- 2 vCPU；
- 2–4 GiB 内存；
- 20 GiB 以上系统盘；
- Alibaba Cloud Linux 3/4 或 Ubuntu LTS；
- Docker Engine 与 Docker Compose plugin；
- 域名、备案和 HTTPS 按实际地域与公开访问方式准备。

地图瓦片和数值天气依赖外部 HTTPS。ECS 必须具备稳定出网能力；若配置严格的出方向规则，至少允许 DNS、HTTPS，以及实际使用的 Open-Meteo、NASA GIBS、NOAA、地图和光污染源。

## 3. 拉取和配置

```bash
git clone https://github.com/Jovifei/Star_photo_addr.git
cd Star_photo_addr
git checkout main
git pull --ff-only
cp .env.example .env
```

至少检查：

```dotenv
APP_BIND=127.0.0.1
APP_PORT=3100
BUILD_REVISION=<当前 Git SHA>
SNAPSHOT_MODEL=gfs
SNAPSHOT_WORKER_REQUEST_TIMEOUT_MS=150000
```

可选配置：

- `NEXT_PUBLIC_TIANDITU_TOKEN`：天地图中文注记；
- `NEXT_PUBLIC_BASEMAP_TILE_URL` / `NEXT_PUBLIC_BASEMAP_ATTRIBUTION`：自有或授权基础底图；留空时使用 OSM 标准瓦片暗色回退；
- `NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL`：自有或授权光污染瓦片模板；
- `NEXT_PUBLIC_ASSET_*`：只有真实资产已放入 `public/images/perseids/` 后才设为 `true`；
- `OPEN_METEO_*`、`GIBS_CAPABILITIES_URL`、`NOAA_KP_URL`：企业代理或内部缓存；
- `*_TTL_MS`、`*_TIMEOUT_MS`、`*_FORCE_REFRESH_COOLDOWN_MS`：数据缓存、超时和公开刷新保护。

`NEXT_PUBLIC_*` 在 `next build` 阶段写入浏览器包。修改此类值后必须重新构建镜像，单纯重启容器不会生效。

> 基础底图提示：默认 OSM 回退用于消除匿名 CARTO 的 `API KEY REQUIRED` 水印，适合个人低流量验证。公开流量增长后应切换到符合授权/用量政策的自有瓦片、受控服务或后续 OpenFreeMap/PMTiles 方案，并保留可见署名。

### 光污染模板要求

模板必须使用 HTTP(S)，包含：

```text
{z}
{x}
{y} 或 {-y}
```

可选支持：

```text
{s}
{r}
```

系统会在浏览器加载和 `/api/data-status` 探测前校验模板。禁止把账号或密码直接写在 URL 中。

## 4. 构建前检查

```bash
npm ci
npm run check
npm run test:live
```

`test:live` 直接检查：

- Open-Meteo 总云量、低云、中云、高云；
- ICON、GFS、AIFS 与 Best Match；
- 气压层云量；
- 地理编码；
- 空气质量；
- NASA GIBS Himawari 与 Black Marble 图层目录；
- NOAA Kp；
- 默认光污染视觉瓦片（第三方源失败会明确报告为可选降级项）。

服务器无法访问上游时，优先排查 DNS、ECS 出方向规则、代理和跨境链路，不要以空数组或固定值伪装成功。

## 5. 构建与启动

```bash
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"

docker compose \
  -f docker-compose.yml \
  -f docker-compose.aliyun.yml \
  up -d --build
```

检查：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.aliyun.yml \
  ps

curl -fsS http://127.0.0.1:3100/healthz | jq
curl -fsS http://127.0.0.1:3100/api/data-status | jq
```

完整应用接口验收：

```bash
npm run check:data-sources -- http://127.0.0.1:3100
```

绑定域名后：

```bash
npm run check:data-sources -- https://stars.example.com
```

该脚本通过应用自己的 Next.js 路由检查：

- `/healthz` 应用身份和进程存活；
- `/api/forecast?refresh=1` 是否返回总、低、中、高云量；
- `/api/data-status?refresh=1` 的天气、卫星和光污染状态；
- `/api/satellite/times` 的 Himawari 云图、Black Marble 夜光和瓦片模板。

## 6. Nginx

复制模板：

```bash
sudo cp deploy/nginx/star-photo.conf /etc/nginx/conf.d/star-photo.conf
sudo sed -i 's/stars.example.com/你的域名/g' /etc/nginx/conf.d/star-photo.conf
```

在证书签发前，不要启用模板中的 443 server；先临时把 80 server 改为反向代理。证书准备完成后恢复 80 → 443 跳转，并确认路径：

```text
/etc/letsencrypt/live/你的域名/fullchain.pem
/etc/letsencrypt/live/你的域名/privkey.pem
```

检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

模板已经配置：

- 应用只回源 `127.0.0.1:3100`；
- `/api/` 边缘限流；
- API 最长读取超时 150 秒，覆盖首次 242 点快照；
- `/_next/static/` 一年 immutable 缓存；
- `/healthz` 关闭访问日志；
- TLS 1.2/1.3 和安全响应头。

HSTS 仅应在最终域名和 HTTPS 链路验证后启用。

## 7. 健康检查职责

### `/healthz`

只检查：

- Next.js 进程能够响应；
- 应用身份和构建版本可读。

它故意不依赖 Open-Meteo、NASA、NOAA 或光污染服务。第三方短时故障不应触发 Docker、SLB 或 ALB 重启正常容器。

### `/api/data-status`

检查：

- Open-Meteo 总、低、中、高云量字段；
- NASA GIBS Himawari 与 VIIRS 图层目录；
- 光污染瓦片模板及实际图片响应；
- 天地图令牌配置；
- 可选本地 Bortle/SQM 栅格。

人工强制复检：

```bash
curl -fsS 'http://127.0.0.1:3100/api/data-status?refresh=1' | jq
```

`refresh=1` 受到应用级冷却与并发合并保护。冷却窗口内通过 `X-Refresh-Suppressed`、`Retry-After` 和各 `X-*-Cache` 响应头说明实际行为。

## 8. 数据与刷新语义

### 天气和云量

- Open-Meteo 上游请求不使用隐式 Next fetch 缓存；
- 应用内新鲜缓存默认 10 分钟；
- 同一模型、天数和坐标集合的并发请求合并；
- 强制刷新默认 60 秒冷却；
- 上游失败时最多回退默认 6 小时内旧值，并标记 `stale`；
- 总云、低云、中云、高云必须与时间轴对齐且包含数值，才能进入缓存；
- 模型最大预报范围不同，代码会限制无效 `forecast_days`。

### 地图云量网格

- 同一“观测夜 + 模型 + 范围 + 地图边界”只保留一个请求；
- 人工刷新时保留上一张兼容画布，新结果成功后原子替换；
- 地图移动只取消真正过期的边界请求；
- 一次人工刷新 revision 只会触发一次强制请求，后续普通移动不会继续携带 `refresh=1`。

### 卫星云图与夜光

- GIBS capabilities 默认缓存 15 分钟；
- 云图与夜光帧按产品类型隔离；
- 云图原生最大缩放 Level 6，夜光 Level 8；更高地图缩放使用 overzoom；
- 目录暂不可达时，可使用最近成功目录并明确标记降级；
- Himawari 观测时间不能与 Open-Meteo 预报时间混用。

### 光污染

- 默认是 VIIRS 2023 第三方视觉瓦片，只作空间参考；
- 普通图片瓦片不强制第三方返回 CORS 头；
- 单张边缘瓦片失败不会卸载整个图层，连续失败才标记降级；
- 后续成功瓦片会自动恢复；
- Bortle/SQM 仅在安装授权本地栅格后显示，不能根据视觉瓦片伪造。

长期生产建议把光污染数据迁到自有 OSS/CDN 或受控 WMTS。

### 观星点评分快照

- 磁盘快照默认 30 分钟新鲜、6 小时可降级回退；
- 精确缓存仍区分 `days` 和 `focusTime`；
- 强制刷新按 `date + model` family 保护，变化 `days/focusTime` 不能绕过冷却；
- worker 使用串行递归定时器，不会在上一任务未结束时重叠启动；
- worker 请求有独立超时，并响应 SIGTERM/SIGINT。

## 9. 日志与排障

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.aliyun.yml \
  logs --tail=200 star-weather

docker compose \
  -f docker-compose.yml \
  -f docker-compose.aliyun.yml \
  logs --tail=200 star-weather-worker
```

| 现象 | 优先检查 |
| --- | --- |
| 云量全部为空 | `/api/data-status` 的 weather；Open-Meteo 出网；模型时效 |
| 云量刷新闪空或重复请求 | 浏览器 Network 的 `refresh=1`；确认部署版本包含最新修复 |
| 云图时间轴为空 | satellite 状态；GIBS capabilities；服务器时间与 DNS |
| 光污染空白 | `light-pollution` 状态；模板占位符；浏览器直连瓦片域名 |
| 推荐点一直读取中 | worker 日志；volume 权限；模型是否覆盖日期 |
| 手动刷新无变化 | `X-Refresh-Suppressed`、`Retry-After`、`X-*-Cache`、`X-Data-Stale` |
| 容器反复重启 | 先检查 `/healthz`；上游数据故障不应成为 liveness 失败条件 |

## 10. 更新与回滚

更新：

```bash
git fetch origin
git checkout main
git pull --ff-only
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.aliyun.yml \
  up -d --build
curl -fsS http://127.0.0.1:3100/healthz
npm run check:data-sources -- http://127.0.0.1:3100
```

回滚：

```bash
git checkout <known-good-sha>
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"
docker compose \
  -f docker-compose.yml \
  -f docker-compose.aliyun.yml \
  up -d --build
```

快照保存在 named volume `observing-snapshots`。更新镜像不会自动删除；生产环境不要执行 `docker compose down -v`，除非明确要删除快照数据。
