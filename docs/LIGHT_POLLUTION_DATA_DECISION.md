# 光污染数据接入决策

更新时间：2026-08-06
状态：数据方案已收敛，生产接入尚未授权

## 结论

当前版本不把夜光卫星图直接换算成 Bortle 或 SQM，也不把光污染加入点位评分。

原因是卫星产品主要测量向上传播到传感器的夜间辐亮度，而摄影者关心的是观测方向的人工天空亮度。两者受到大气传播、地形、积雪、气溶胶、灯具方向和传感器波段等因素影响，不能只靠一个未经校准的阈值表互换。错误换算会产生看似精确、实际不可审计的机位排名。

## 已调查的数据候选

| 候选 | 能表达什么 | 分辨率/范围 | 许可与接入 | 本项目决定 |
|---|---|---|---|---|
| Falchi et al. World Atlas 2015 | 模型化人工天空亮度，可进一步表达相对自然天空亮度 | 约 30 arc-second，全球 | 公开镜像存在 CC BY-NC 4.0 与“联系作者确认”两种说明；商业使用前必须书面确认 | 可用于非商业原型，不直接承诺商业上线 |
| NASA VIIRS VNP46A4 | 年度月光 BRDF 校正夜间灯光辐亮度与质量层 | 15 arc-second，全球，2012 起年度产品 | NASA/LAADS，下载通常需要 Earthdata Token；产品与质量字段可追溯 | 作为“卫星夜光辐亮度”独立图层，不能命名为 SQM/Bortle |
| EOG Annual VIIRS Nighttime Lights | 年度全球辐亮度合成 | 15 arc-second，约 500 m，75°N–65°S | 需按 EOG 下载条款核对具体年份和再分发权限 | 可作 VNP46A4 的工程备选，不与 World Atlas 混用同一标尺 |

参考：

- [NASA VNP46A4 数据目录](https://catalog.data.gov/dataset/viirs-npp-lunar-brdf-adjusted-nighttime-lights-yearly-l3-global-15-arc-second-linear-lat-l)
- [NASA Suomi-NPP AWS Registry](https://registry.opendata.aws/nasa-suomi-npp/)
- [EOG Annual VIIRS Nighttime Lights](https://eogdata.mines.edu/products/vnl/)
- [World Atlas 补充数据元数据](https://cir.nii.ac.jp/crid/1883398392939383936)

## 推荐实施分层

### 1. 原始数据层

- 保留 `dataset_id`、产品版本、观测年份、下载时间、原始单位、许可证 URL 和文件校验和。
- 对 VNP46A4 使用质量标志过滤云、异常观测和低质量像元。
- 全球与中国增强数据分别版本化，不把不同年份、不同模型拼成一个不可比较的分数。

### 2. 瓦片与点查询层

- 原始 GeoTIFF 转 Cloud Optimized GeoTIFF，并生成有明确版本路径的瓦片。
- 前端只请求同域接口，避免暴露 Earthdata 凭证：

```text
GET /api/light-pollution/tiles/{datasetVersion}/{z}/{x}/{y}.webp
GET /api/light-pollution/point?lat=30.18&lon=119.01&datasetVersion=...
GET /api/light-pollution/metadata/{datasetVersion}
```

- 点查询返回字段至少包括：

```json
{
  "dataset": "VNP46A4",
  "version": "001-2025",
  "observedYear": 2025,
  "value": 8.4,
  "unit": "nW/cm2/sr",
  "quality": "good",
  "bortle": null,
  "sqm": null,
  "licenseUrl": "...",
  "updatedAt": "..."
}
```

### 3. 产品展示层

- VNP46A4/EOG 只显示“卫星夜光辐亮度”，有单位、年份和质量状态。
- 只有使用经过验证的天空亮度传播模型或合法的 World Atlas 派生值时，才显示 SQM/Bortle。
- 无数据、过期、质量差必须有独立状态，不能默认为“暗”。
- 光污染进入评分时必须升级 `SCORE_MODEL_VERSION`，记录权重和回归样例。

## 尚需用户/部署方决定

1. 网站是否商业使用；这直接决定 World Atlas 数据是否可用。
2. 是否提供 NASA Earthdata Token，以及是否允许服务端离线加工数据。
3. 托管范围：仅中国或全球；这影响存储、瓦片流量和成本。
4. 是仅展示卫星辐亮度，还是投入大气传播/现场 SQM 校准，产出可解释的天空亮度。

在这四项确认前，继续保留当前“光污染尚未接入”的界面声明是最严谨的降级方案。
