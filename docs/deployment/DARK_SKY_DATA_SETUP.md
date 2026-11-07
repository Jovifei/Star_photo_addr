# 本地 Bortle / SQM / 行政边界数据安装说明

> 目的：解释页面中的“未安装 / 无数据”，并给本地与阿里云部署者一条可审计的启用路径。

## 1. 为什么仓库默认不带数值栅格

仓库默认只启用有明确在线来源的 VIIRS 2023 视觉夜光瓦片。视觉夜光可以帮助观察人工光源分布，但不能直接冒充现场 Bortle 或 SQM。

下列本地资产没有随仓库发布：

- World Atlas / 天空亮度栅格；
- 中国 VIIRS 数值瓦片；
- 国家、省、市县行政边界 GeoJSON；
- 候选城市离线包。

原因是当前没有确认这些具体文件版本的再分发许可或审图合规信息。页面显示“未安装”是安全降级，不是 Open-Meteo 天气接口故障。

## 2. 可用功能与不可用功能

未安装本地资产时仍可用：

- Open-Meteo 总云量、高云、中云、低云；
- NASA GIBS Himawari 卫星云观测；
- VIIRS 2023 视觉夜光参考；
- 当前视野推荐、地点排行与观星计划。

不可声明：

- 现场 SQM 实测；
- 精确 Bortle 真值；
- 基于未授权栅格生成的天顶亮度。

## 3. 约定目录

取得许可后，按现有代码约定放置：

```text
public/images/perseids/data/world-atlas-2015.webp
public/images/perseids/data/vnp46a4/2024/
public/images/perseids/data/vnp46a4/2024-values/
public/images/perseids/data/world-country-boundaries.geojson
public/images/perseids/data/china-province-boundaries-wgs84.geojson
public/images/perseids/data/china-prefecture-boundaries.index.json
public/images/perseids/data/boundaries/prefectures/<adcode>.geojson
```

文件必须与代码读取格式一致；不要只改开关而不放文件，否则会形成 404。

## 4. 构建变量

在 `.env` 中按实际拥有的资产启用：

```dotenv
NEXT_PUBLIC_ASSET_VIIRS_TILES=true
NEXT_PUBLIC_ASSET_WORLD_ATLAS=true
NEXT_PUBLIC_ASSET_BOUNDARIES=true
```

只启用真实存在且许可可核验的组。`NEXT_PUBLIC_*` 会写入浏览器构建产物，修改后必须重新构建：

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.aliyun.yml \
  up -d --build
```

单纯 `docker restart` 不会生效。

## 5. 行政边界的推荐方式

更推荐配置天地图开发令牌：

```dotenv
NEXT_PUBLIC_TIANDITU_TOKEN=你的令牌
```

当前页面会使用天地图 `ibo_w` 境界图层与 `cia_w` 中文注记，国家、省市边界会随缩放级别自然显示。没有令牌时仅显示少量中文方向标签，不绘制来源不明的国界或省界。

申请和权限配置应在天地图开发者控制台完成。令牌属于构建时公开客户端令牌，应在控制台限制域名与调用权限。

## 6. 验证

部署后执行：

```bash
curl -fsS http://127.0.0.1:3100/healthz
curl -fsS 'http://127.0.0.1:3100/api/data-status?refresh=1'
```

浏览器检查：

1. “数据源状态”中的本地 Bortle/SQM 从“未安装”变为“可用”；
2. 点击地图时不出现 404；
3. 天顶亮度、Bortle 只在 `status=ok` 时显示；
4. 行政边界在不同缩放级别显示且不遮挡云量图层；
5. 数据来源、许可、版本和生成流程写入工程记录。

## 7. 仍需本地完成的内容

远端代码可以完成界面、读取逻辑、诊断和测试，但不能替你取得或上传有许可的栅格，也不能代替天地图账号申请令牌。需要你本地/服务器提供的只有：

- 合法数据文件；
- 天地图令牌；
- 阿里云服务器环境变量与重新构建权限。
