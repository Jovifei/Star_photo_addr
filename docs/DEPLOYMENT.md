# 部署指南（服务器 + 域名）

> 适用：任意 Linux 服务器（2C2G 起）。项目自带 Dockerfile、docker-compose（应用 + 快照预热 worker）、nginx HTTPS 模板。
> 国内服务器用 `docker-compose.override.yml = docker-compose.aliyun.yml` 的资源限制版即可，无需其它改动。

## 0. 你需要准备的东西

- 一台 Linux 服务器（Ubuntu 22.04/24.04 或 Debian 12，2 核 2G 内存起步；应用容器限制 1G、worker 768M）
- 一个域名，能改 DNS 解析
- （强烈建议）Open-Meteo Pro key——免费匿名额度按 IP 限流，部署到服务器后所有访客共享这一个 IP 的配额，**很容易耗尽**（本地开发就撞过）。购于 open-meteo.com，按量计费很便宜。

## 1. DNS 解析

到域名服务商添加 A 记录：

```
类型: A    主机记录: @（或你想要的子域，如 stars）    值: <服务器公网 IP>
```

生效后 `ping 你的域名` 应返回服务器 IP。

## 2. 服务器初始化（一次性）

```bash
# Ubuntu 为例
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git nginx certbot python3-certbot-nginx
sudo systemctl enable --now docker nginx

# 防火墙只开 SSH / HTTP / HTTPS
sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
```

> 国内服务器需备案；未备案域名走 80/443 会被拦截，只能用 IP+端口或先完成备案。

## 3. 拉代码 + 配置环境变量

```bash
sudo mkdir -p /opt/star-photo && sudo chown $USER /opt/star-photo
cd /opt/star-photo
git clone https://github.com/Jovifei/Star_photo_addr.git .

cat > .env <<'EOF'
# 必填：Open-Meteo Pro key（免配额限制）
OPEN_METEO_API_KEY=你的key

# 应用只绑本机回环，由 nginx 反代对外
APP_BIND=127.0.0.1
APP_PORT=3100
EOF
chmod 600 .env
```

`.env` 全部可用变量见 `docker-compose.yml`（TTL、超时、冷却等均有默认值，不必都写）。
注意：`NEXT_PUBLIC_*` 是**构建期**变量（瓦片地址、本地资产开关），改了要重新 build；`OPEN_METEO_API_KEY` 等是**运行期**变量，改了 `docker compose up -d` 重启即生效。

## 4. 构建并启动

```bash
docker compose -f docker-compose.yml -f docker-compose.aliyun.yml up -d --build
# 查看：应用 + 快照预热 worker 两个容器
docker compose ps
docker compose logs -f star-weather
```

自带内容：
- **star-weather**：Next.js 生产服务（容器内 3000，映射到本机 3100），带 /healthz 健康检查；
- **star-weather-worker**：每 30 分钟预生成未来 7 夜（GFS）观测快照到共享卷，让访客首屏直接命中缓存、不吃上游实时请求；
- `deploy/nginx/star-photo.conf` 是现成的 nginx 模板。

国内网络拉基础镜像慢的话，给 /etc/docker/daemon.json 配 registry-mirrors 后 `sudo systemctl restart docker`。

## 5. nginx + HTTPS

```bash
sudo cp deploy/nginx/star-photo.conf /etc/nginx/conf.d/star-photo.conf
sudo sed -i 's/stars\.example\.com/你的域名/g' /etc/nginx/conf.d/star-photo.conf
# 模板默认把 80 重定向到 443；首次先注释掉那行 return，让 certbot 起站:
sudo nano /etc/nginx/conf.d/star-photo.conf   # 注释 return 301 那行
sudo nginx -t && sudo systemctl reload nginx

# 签发证书（自动改写 nginx 配置）
sudo certbot --nginx -d 你的域名

# 证书自动续期已由 certbot 定时任务接管，验证：
sudo certbot renew --dry-run
```

回到模板把 80→443 的重定向恢复启用，`sudo systemctl reload nginx`。

## 6. 验证清单

```bash
curl -s https://你的域名/healthz          # ok
curl -s https://你的域名/api/data-sources  # 数据源健康
```

浏览器打开：今夜观测地图出图、`/fireglow` 概率色块渲染、观星计划排名加载。持续观察 `docker compose logs` 中 Open-Meteo 是否还有 limit 报错（配了 key 就不应再有）。

## 7. 日常运维

```bash
# 更新版本
cd /opt/star-photo && git pull
docker compose -f docker-compose.yml -f docker-compose.aliyun.yml up -d --build

# 快照数据在命名卷 observing-snapshots，随容器升级保留
# 回滚：git checkout <上一个tag> 后重新 up --build
```

常见问题速查见 `docs/OPERATIONS.md`（配额与降级表现、环境变量表）；测试与门禁见 `docs/TESTING.md`。
