# 逐星当前工程指南

> 状态日期：2026-09-16
> 已部署主线：v1.0.18 / `main@3334e0c08f9ab2e481277628ce4ee875e2f1039e`
> 当前候选：`codex/model-capability-recovery-20260915@4118887`，未合并、未部署

## 先确认产品是否“已完成”

逐星不是只有星空首页的半成品。当前正式导航有四个工作区：

- `/` 今夜观测：地点、云量、卫星、逐小时窗口和候选比较；
- `/sites` 暗夜选址：统一首页的兼容入口，使用 B1–B4 目录参考；
- `/fireglow` 火烧云：独立晨昏条件指数和地点排行；
- `/cloudsea` 高山云海：surface + pressure profile 条件指数、层位关系和逆温证据。

云海第一阶段和火烧云页面均已实现并有单元/集成/浏览器回归。文档中出现的“实验能力”“规划中”“未进入正式导航”是早期历史记录，不能作为当前状态；当前仍未完成的是 CloudSea Phase 2 周边谷地采样、真实现场/30–90 天准确率校准、真机/性能和部分部署环境验证。

## 当前模型与数据语义

模型能力恢复候选把新会话、观测快照和 worker 默认设为 GFS；显式 ICON/AIFS 不会被偷偷替换，但缺能见度或其他评分字段时必须显示数据不足。健康接口分别返回 `cloudAvailable` 和 `scoringAvailable`，云量能看不代表可以评分。

火烧云与云海的分数都是 0–100 条件指数，不是经过长期实拍样本校准的事件概率。NASA GIBS 是已经发生的卫星观测，Open-Meteo 是数值模式预报，VIIRS 是年度夜光视觉参考，Bortle/SQM 只有授权栅格或现场仪器证据时才可作为实测。

## 新会话接手顺序

1. 读取本指南和 [`README.md`](../README.md)；
2. 读取 [`01-ARC-项目制造与交付流程.md`](./01-ARC-项目制造与交付流程.md) 与 [`02-REF-项目文档地图.md`](./02-REF-项目文档地图.md)；
3. 读取 [`project-tracking/PROJECT_STATUS.md`](./project-tracking/PROJECT_STATUS.md)、[`testing/TEST_STATUS.md`](./testing/TEST_STATUS.md)；
4. 读取最新 `engineering-change-log/` 文档，而不是只读旧 handoff；
5. 以当前源码、实际测试输出和部署健康检查为证据，旧聊天/截图只作线索。

## 当前候选验证边界

`4118887` 已完成 Node 24 候选 32/32、全仓 65/391、Chromium 122/36、Firefox/WebKit 4/4、真实 GFS 单点和 Finder 282 点批量验收。Docker Desktop daemon 在本机无法启动，容器 build/worker smoke 必须保持 `BLOCKED/NOT_RUN`；候选没有合并 main、没有部署生产、没有修改生产 `.env`。

## 关键文档

| 主题 | 文档 |
| --- | --- |
| 制造、测试、版本和部署流程 | [`01-ARC-项目制造与交付流程.md`](./01-ARC-项目制造与交付流程.md) |
| 工作区职责和 Phase 2 边界 | [`product/WORKSPACE_ARCHITECTURE.md`](./product/WORKSPACE_ARCHITECTURE.md) |
| 当前状态和阻断 | [`project-tracking/PROJECT_STATUS.md`](./project-tracking/PROJECT_STATUS.md) |
| 测试数量和未运行项 | [`testing/TEST_STATUS.md`](./testing/TEST_STATUS.md) |
| 当前模型恢复记录 | [`engineering-change-log/2026-09-15-model-capability-recovery-candidate.md`](./engineering-change-log/2026-09-15-model-capability-recovery-candidate.md) |
| 部署指南 | [`ALIYUN_DEPLOYMENT.md`](./ALIYUN_DEPLOYMENT.md)、[`DEPLOYMENT.md`](./DEPLOYMENT.md) |
