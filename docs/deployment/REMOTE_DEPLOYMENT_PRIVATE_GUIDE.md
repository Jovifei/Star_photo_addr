# 逐星 (Star Photo) 生产服务器私有远程部署指南

> ⚠️ **保密与安全提醒**：本文档包含生产服务器 IP、密钥配置、容器拓扑与敏感环境参数，**已被 `.gitignore` 严格忽略，禁止提交至公开 GitHub 远端仓库**。

---

## 1. 基础设施与服务器拓扑概览

| 配置项 | 详细信息 | 说明 |
| :--- | :--- | :--- |
| **服务器提供商** | 阿里云 ECS (Alibaba Cloud Elastic Compute Service) | 华东大陆节点 |
| **公网 IP** | `120.55.64.11` | 绑定生产流量与 SSH 管理通道 |
| **绑定域名** | `photo.joviluma.com` | 支持 HTTPS (TLS 1.2/1.3) 与 HTTP ACME 校验 |
| **操作系统** | Alibaba Cloud Linux 3 / CentOS Stream 兼容内核 | 支持 systemd、Docker Compose Plugin |
| **规格配置** | 2 vCPU · 1.8 GiB 物理内存 · 2.0 GiB 虚拟交换内存 (Swap) | 部署有 2G `/swapfile` 防止编译 OOM |
| **部署根目录** | `/opt/star-photo` | Git 权威工作树，由 Docker Compose 管理 |
| **内部代理端口** | `127.0.0.1:3100` | 仅绑定回路地址，由主机 Nginx 反向代理 |

```text
公网用户 (Internet)
    │  HTTPS 443 / HTTP 80
    ▼
阿里云 ECS 安全组 (允许 80/443 入方向，SSH 22 仅可信源)
    │
    ▼
Nginx (TLS 终止 / API 速率限制 12r/s / Let's Encrypt 证书轮转)
    │  反向代理至 127.0.0.1:3100
    ▼
Docker Compose 项目: star-photo
    ├─ star-photo-star-weather-1 (Next.js Standalone 生产服务，端口 3000 -> 3100)
    └─ star-photo-star-weather-worker-1 (后台定时观星快照预热服务)
         ↕ 共享 Named Volume (star-weather-snapshots -> /app/data/snapshots)
```

---

## 2. 自动化部署方式（推荐）

### 方式 A：对话内通过 AI 自动部署
由于开发机已配置 SSH 免密凭证，您在对话中直接发送：
- **“部署”**、**“上线”**、**“把代码部署到服务器”**
- AI 将全自动执行：
  1. 本地代码质量校验（Lint + TypeCheck + Unit Tests）；
  2. 自动 Git Commit 并 Push 到 GitHub `main` 分支；
  3. 通过本地 SSH 驱动阿里云服务器无感拉取并执行增量构建；
  4. 校验 `http://127.0.0.1:3100/healthz` 存活状态；
  5. 自动在本地 `deploy/logs/` 归档部署摘要，并在对话中汇报结果。

### 方式 B：本地 PowerShell 脚本一键部署
无需登录云服务器，直接在本地终端执行项目自带的自动化部署脚本：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-remote.ps1
```

- 该脚本会自动连接 `root@120.55.64.11`，在云端执行标准构建流水线；
- 部署日志会自动保存在本地 `deploy/logs/YYYY-MM-DD_HH-mm-ss-deploy-summary.md`，不会泄漏到远端。

---

## 3. 手动登录服务器部署流程

如果您需要手动登录服务器排查或进行底层运维，标准执行步骤如下：

### 步骤 1：SSH 登录服务器
```bash
ssh root@120.55.64.11
```

### 步骤 2：进入项目目录并配置 Git 信任
```bash
cd /opt/star-photo

# 避免 root 用户与目录属主不一致触发 Git dubious ownership 报错
git config --global --add safe.directory /opt/star-photo
```

### 步骤 3：拉取最新主分支代码
```bash
git pull --ff-only
```

### 步骤 4：注入版本哈希并重新编译启动容器
```bash
# 获取当前最新的 Git 提交哈希作为版本号
export BUILD_REVISION="$(git rev-parse --short=12 HEAD)"

# 联合应用通用配置与阿里云资源限制配置重新构建
docker compose -f docker-compose.yml -f docker-compose.aliyun.yml up -d --build
```

### 步骤 5：验证服务健康状态
```bash
# 1. 检查容器是否运行且状态为 (healthy)
docker compose -f docker-compose.yml -f docker-compose.aliyun.yml ps

# 2. 调用健康检查接口
curl -s http://127.0.0.1:3100/healthz

# 期望返回：
# {"status":"ok","app":"star-weather-planner","version":"0.3.1","buildRevision":"<当前Git SHA>"}
```

---

## 4. 生产环境配置文件与核心参数字典 (`.env`)

服务器生产配置文件位于 `/opt/star-photo/.env`，以下为各参数详细作用及推荐设置：

```dotenv
# ==========================================
# 1. 基础服务网络参数
# ==========================================
# 绑定回路地址（强烈建议设为 127.0.0.1，禁止暴露 0.0.0.0 到公网）
APP_BIND=127.0.0.1

# 容器对外映射端口（由主机 Nginx 反向代理）
APP_PORT=3100

# 生产环境运行模式
NODE_ENV=production

# 当前构建版本号（由构建脚本通过 git rev-parse 自动注入）
BUILD_REVISION=4add87d8c75b

# ==========================================
# 2. 气象模型与快照预热参数
# ==========================================
# 观星推荐快照主气象模型：可选 best_match、icon、gfs、aifs
SNAPSHOT_MODEL=gfs

# 快照 Worker 刷新请求全局超时（毫秒），建议 >= 120000 保证跨国网络稳定
SNAPSHOT_WORKER_REQUEST_TIMEOUT_MS=150000

# 快照 Worker 自动刷新轮询间隔（毫秒），默认 30 分钟 (1800000)
SNAPSHOT_WORKER_INTERVAL_MS=1800000

# 强制刷新冷却时间（防频繁点击刷爆 Open-Meteo 配额）
FORECAST_FORCE_REFRESH_COOLDOWN_MS=180000

# ==========================================
# 3. 第三方地图与商业数据源 Token
# ==========================================
# 天地图中文注记 API 密钥（用于国内高精度中文地名标注）
NEXT_PUBLIC_TIANDITU_TOKEN=

# 自定义基础底图瓦片 URL（留空时自动回退为暗色 OSM 瓦片）
NEXT_PUBLIC_BASEMAP_TILE_URL=

# 自定义光污染瓦片模板 URL
NEXT_PUBLIC_LIGHT_POLLUTION_TILE_URL=

# Open-Meteo Pro/商业授权密钥（如果有购买 Pro Key 可填写，提高并发配额）
OPEN_METEO_API_KEY=
```

> **注意**：所有以 `NEXT_PUBLIC_*` 开头的变量会在 Next.js 构建阶段打包进浏览器前端静态代码。修改任何 `NEXT_PUBLIC_*` 变量后，必须重新运行 `docker compose ... up -d --build` 重新打包镜像，仅重启容器不会生效。

---

## 5. Docker 编排与系统资源约束

生产环境同时引用 `docker-compose.yml` 与 `docker-compose.aliyun.yml`：

- **`star-weather` 服务**：
  - 内存限制：`1200M` 上限，防止 Node.js 内存泄漏拖垮 ECS 主机；
  - 开启 `tini` 作为 1 号进程，负责正确的子进程回收与信号处理；
  - 挂载安全只读或临时卷：`/tmp` 为 tmpfs（`size=64M,noexec`）；
  - 配置定期健康检查：`curl -f http://127.0.0.1:3000/healthz || exit 1`。
- **`star-weather-worker` 服务**：
  - 内存限制：`384M` 上限；
  - 定时执行快照抓取与物理推算，生成的 JSON 文件存入持久化数据卷 `star-weather-snapshots`。

---

## 6. Nginx 生产反向代理配置

主机 Nginx 配置文件位于 `/etc/nginx/conf.d/star-photo.conf`（参考仓库 `deploy/nginx/star-photo-live.conf`）：

```nginx
# 接口速率限制：单个 IP 允许 12 请求/秒，突发 30
limit_req_zone $binary_remote_addr zone=star_photo_api:10m rate=12r/s;
limit_conn_zone $binary_remote_addr zone=star_photo_conn:10m;

upstream star_photo_app {
    server 127.0.0.1:3100;
    keepalive 32;
}

server {
    listen 80;
    server_name photo.joviluma.com;
    # Let's Encrypt ACME 证书校验通道
    location ^~ /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name photo.joviluma.com;

    ssl_certificate /etc/letsencrypt/live/photo.joviluma.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/photo.joviluma.com/privkey.pem;

    # 健康检查通道（关闭访问日志避免刷屏）
    location = /healthz {
        proxy_pass http://star_photo_app;
        proxy_set_header Host $host;
        access_log off;
    }

    # API 接口路由与防刷限制
    location /api/ {
        limit_req zone=star_photo_api burst=30 nodelay;
        proxy_pass http://star_photo_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 前端主应用与静态资源代理
    location / {
        proxy_pass http://star_photo_app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

- **证书自动续期**：服务器已配置 certbot 定时任务：
  ```bash
  certbot renew --dry-run
  ```

---

## 7. 低内存服务器运维避坑守则

由于云服务器内存为 1.8 GiB，在运行 Next.js 生产编译打包时需注意以下事项：

1. **务必保持 Swap 交换空间开启**：
   - 当前已配置 2.0 GiB `/swapfile`。
   - 检查命令：`free -h`
   - 若重启后丢失 Swap，按以下命令快速恢复：
     ```bash
     swapon /swapfile
     ```
2. **极小概率遇到 OOM 时的构建顺序**：
   - 若构建非常卡顿，可先临时停止 worker 容器释放内存：
     ```bash
     docker compose stop star-weather-worker
     docker compose up -d --build
     docker compose start star-weather-worker
     ```

---

## 8. 紧急回滚与常用诊断命令

| 需求场景 | 执行命令 |
| :--- | :--- |
| **实时查看应用日志** | `docker compose logs -f --tail=100 star-weather` |
| **实时查看后台 Worker 日志** | `docker compose logs -f --tail=100 star-weather-worker` |
| **回滚至上一个 Git 提交版本** | `git checkout HEAD~1 && export BUILD_REVISION=$(git rev-parse --short=12 HEAD) && docker compose up -d --build` |
| **检查系统内存与 CPU 负载** | `top -b -n 1 | head -n 20` 或 `free -h` |
| **检查端口 3100 监听情况** | `ss -tulpn | grep 3100` |
| **测试已部署数据源完整链路** | `npm run check:data-sources -- http://127.0.0.1:3100` |
