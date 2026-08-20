# 工程修改跟踪：参考省域攻略优化当前视野推荐

> 文档编号：`ENG-CHANGE-2026-08-20-VIEWPORT-RECOMMENDATIONS`  
> 基线：`main@02281ce71ab7b8a911eb289a2a5ad17b94e7c683`  
> 分支：`feat/province-viewport-recommendations-20260820`

## 1. 修改目的

参考用户提供的省域流星雨观测攻略，吸收“地图编号与地点卡片一一对应、地点层级清楚、推荐理由优先于经纬度”的信息组织方式，在现有首页地图增加**当前视野推荐**。不复制参考图的静态地点排序、素材或未经项目数据支持的结论。

## 2. 功能闭环

```text
放大/移动首页地图
→ 点击“生成区域推荐 / 更新此区域”
→ 读取当前 Leaflet bounds
→ 筛选 242 个整理点位
→ 使用当前时次观星评分排序
→ 地图显示 1–12 编号
→ 卡片使用相同编号
→ 点击卡片或编号进入已有地点详情
```

地图移动本身不会触发上游请求，只会把已生成列表标记为“需要更新”。同一评分时次下再次更新视野会复用组件内快照；只有天气模型、时次或全局数据刷新版本变化时才重新读取快照。

## 3. 排序与信息语义

排序依次使用：

1. 当前时次观星分降序；
2. 推荐档位；
3. Bortle 升序；
4. 海拔降序；
5. 中文地点名稳定排序。

卡片展示的排名、星级、观星分、云量、Bortle、海拔与推荐理由均来自项目已有地点和快照数据。星级只是现有 0–100 分的五档视觉映射，不是第二套评分模型。VIIRS 仍只是人工夜光空间参考，不表示现场 Bortle/SQM 实测。

## 4. 交互边界

- 全国缩放等级不直接生成 242 个卡片；缩放达到 6 级后才允许生成区域排行；
- 每次最多展示 12 个地点；
- 继续服从首页已有 Bortle 上限、推荐门槛、“仅推荐”与评分档位筛选；
- 没有当前时次数据时显示“等待评分”，不使用其他时次颜色或伪造分数；
- 请求失败时保留上一次成功排行并显示错误，不清空已有地图选择；
- 移动端默认折叠，避免遮挡地图；桌面端展开为两列卡片。

## 5. 关键文件

- `src/lib/viewportRecommendations.ts`
- `src/components/ViewportRecommendationPanel.tsx`
- `src/components/ViewportRecommendationMarkers.tsx`
- `src/components/MapStage.tsx`
- `src/app/viewport-recommendations.css`
- `tests/unit/viewportRecommendations.test.ts`
- `tests/e2e/viewport-recommendations.spec.js`

## 6. 验证要求

合并前必须通过：

- TypeScript；
- ESLint；
- viewport recommendation 单元测试；
- 现有天气/云量/光污染测试；
- 桌面和移动端 Playwright；
- Next.js production build；
- GitHub CI。
