# 工程修改跟踪：README 图形化使用指南与界面截图

> 文档编号：`ENG-CHANGE-2026-08-19-README-VISUAL`  
> 仓库：`Jovifei/Star_photo_addr`  
> 目标分支：`main`  
> 功能分支：`docs/readme-visual-guide-20260819`  
> 对比基线：`bd833f964eee7b456ddad3484bf29cda50771a5c`

## 1. 修改目的

原 `README.md` 已能说明项目的三个工作区、数据源和部署方式，但存在以下问题：

1. 缺少当前产品界面截图，访问仓库的人无法在克隆前理解产品形态；
2. “今夜观测 / 暗夜选址 / 观星计划”只做了概括，没有说明每一步如何操作；
3. 本地开发端口描述不够准确：`next dev` 默认使用 3000，项目标准端口 3100 需要显式设置；
4. 缺少卫星观测、数值预报、VIIRS 夜光和 Bortle/SQM 之间的直观区别；
5. 缺少缓存、刷新、同源 API、阿里云部署、架构和常见问题的集中说明；
6. 没有可重复生成 README 截图的工程脚本。

本轮目标是把 README 从“项目摘要”升级为“带当前界面截图的完整使用与部署入口”。

## 2. 新增内容

### 2.1 产品截图

新增目录：

```text
docs/images/readme/
```

计划生成并纳入仓库的图片：

- `01-tonight-observation.jpg`：今夜观测桌面界面；
- `02-dark-sky-selection.jpg`：暗夜选址桌面界面；
- `03-observation-plan.jpg`：观星计划桌面界面；
- `04-mobile-overview.jpg`：移动端界面。

截图由当前分支的 production build 和 Playwright 自动生成。截图使用确定性测试数据展示界面结构，避免 README 因第三方上游波动而生成空白或相互矛盾的数据。

### 2.2 详细使用指南

README 新增：

- 三个工作区的使用闭环；
- 每个工作区的分步操作；
- 图层和时间域说明；
- 总云量、高云、中云、低云的语义；
- 数据源状态和人工刷新说明；
- 多地点、多夜计划决策方法；
- 分享 URL 参数示例；
- 移动端说明。

### 2.3 数据与科学边界

集中说明：

- Open-Meteo 数值预报不是卫星实况；
- NASA GIBS Himawari 是已经发生的卫星观测；
- VIIRS 夜光是空间视觉参考，不是现场 Bortle/SQM；
- Bortle/SQM 仅在安装授权本地栅格后展示；
- NOAA Kp 不等于当地极光概率；
- 推荐地点不等于道路和现场安全背书。

### 2.4 开发、接口与部署入口

README 新增或扩展：

- Node.js 24+ 本地启动；
- Bash 与 Windows PowerShell 命令；
- 3000 默认端口与 3100 项目标准端口的区别；
- Docker Compose 主服务、worker 和 volume；
- 同源 API 表；
- 缓存、旧数据回退和强制刷新冷却表；
- 阿里云推荐架构；
- 质量门禁命令；
- 技术架构 Mermaid 图；
- 目录结构；
- 常见问题。

### 2.5 可重复截图脚本

新增：

```text
scripts/capture-readme-screenshots.mjs
```

用途：

- 对当前 production build 运行浏览器；
- 注入与 E2E 一致的确定性数据；
- 分别生成桌面端和移动端截图；
- 把图片写入 `docs/images/readme/`。

## 3. 修复的问题

### 3.1 本地端口说明错误

**现象**

原 README 在执行：

```bash
npm run dev
```

后直接要求访问 `http://localhost:3100`。

**根因**

`package.json` 中 `dev` 为 `next dev`，Next.js 默认监听 3000；除非调用者显式设置 `PORT=3100`。

**修复**

README 改为：

- 不设置 `PORT`：访问 3000；
- Bash：`PORT=3100 npm run dev`；
- PowerShell：`$env:PORT = "3100"; npm run dev`。

### 3.2 运维接口主入口不统一

**现象**

README 主要展示旧兼容入口 `/api/data-sources/health`，而当前界面和推荐运维入口使用 `/api/data-status`。

**修复**

README 将 `/api/data-status` 作为推荐入口，同时保留旧入口的兼容说明。

### 3.3 使用说明无法对应界面

**现象**

原文只描述功能结果，没有告诉用户在哪里切换图层、如何读云量、如何加入候选和如何比较多夜。

**修复**

按实际操作顺序重写，并在对应段落上方放置当前界面截图。

## 4. 验证要求

合并前至少验证：

1. 截图文件在 GitHub README 中可直接渲染；
2. 图片路径大小写与仓库文件一致；
3. README 中的路由、脚本和环境变量存在；
4. Mermaid 图可被 GitHub 渲染；
5. `npm run check` 通过；
6. `npm run test:e2e` 通过；
7. 截图脚本能够在 GitHub Actions Ubuntu + Chromium 环境中完成；
8. 桌面截图覆盖 1440×1000 视口，移动截图覆盖约 390×844 视口；
9. 截图不包含密钥、个人账号、内部域名或本地绝对路径。

## 5. 风险与回滚

### 风险

- README 图片会增加仓库体积；
- 页面结构变化后截图可能过时；
- 第三方徽章在部分网络环境下可能加载缓慢；
- GitHub 对 Mermaid 和 HTML 表格的渲染与其他 Markdown 阅读器可能略有差异。

### 回滚

文档改动不影响运行时。需要回滚时可以：

1. 恢复上一版本 `README.md`；
2. 删除 `docs/images/readme/`；
3. 删除 `scripts/capture-readme-screenshots.mjs`；
4. 删除本变更记录。

## 6. 后续维护规则

当以下任一内容明显变化时，应重新生成截图并更新 README：

- 三个工作区名称或主导航；
- 主地图布局；
- 云量/卫星/光污染图层入口；
- 观星计划详情布局；
- 移动端导航和抽屉；
- 关键数据源或 API；
- 本地启动和部署命令。

更新时继续采用：

```text
界面变化 → 重跑截图脚本 → 检查图片 → 更新 README → 记录工程变更
```
