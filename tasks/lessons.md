# Lessons

- 2026-08-30: 模态框焦点循环不能依赖 document 冒泡阶段的 `document.activeElement`；WebKit 可能在监听器运行前更新它。应在对话框捕获阶段按 `event.target` 判断首尾边界，并用真实 WebKit CI 验证 Shift+Tab/Tab 循环。
- 2026-08-30: 接续中断的实施计划时，先以当前分支差异、提交拓扑和现有测试为事实，不从旧功能分支重建；跨浏览器失败要先区分“浏览器二进制未安装”和产品代码失败，并在完整门禁后再推送 PR。

- 2026-08-26: 用户要求合并多个分支时，先以当前 main 的树和提交拓扑为唯一基线；已 squash 到 main 的 PR 分支不能再次原样合并。功能缺口要在当前基线上用行为测试补齐，发布前再核对唯一主线和远端 HEAD。
- 2026-08-26: 地图半径筛选不能把“半径内无点”呈现为空白；对稀疏区域保留严格半径结果，并明确标记最近点兜底，至少补齐 3 个、最多 8 个，关闭后必须恢复基础点位池。

- 2026-08-13: 地图点击或地理搜索的地点可能没有海拔；天文引擎不能接收 `null`。计算边界应使用海平面作为几何兜底，但不能把未知海拔写回地点显示或评分来源。

- 2026-08-12: A cloned Leaflet route needs a real browser screenshot after CSS changes; a descendant selector can miss the same MapContainer element and leave Leaflet's default gray background in place. Verify the computed background and use a same-element scoped rule before accepting a dark map.
- 2026-08-12: Keep a public-site clone on an isolated route when the repository already has an authored product homepage; route isolation preserves the existing product contract and makes visual regression evidence attributable.

- When asked to merge work into the latest branch, verify both tree content and commit topology. Do not create a publication branch from an older base merely because a squash produces the latest tree; that leaves a parallel history line.
- Before publishing a consolidated branch, show the intended surviving ref, whether old refs will remain or be deleted, and the expected post-push graph. Treat branch preservation and branch consolidation as different requirements.
- For map-first interfaces, a dense time-series panel must not be an unconstrained absolute overlay: keep the primary canvas in its own viewport, progressively disclose the detail panel, and give only the panel a bounded vertical scroll region.
- For a live weather homepage, the default night must follow the current local time; fixed astronomical-event dates belong in auxiliary event context and must never become the primary cloud timeline.
- When a visual defect is reported, verify computed geometry and inherited typography in the running browser before changing CSS; DOM source alone cannot distinguish repeated content from line-height overlap.
- Forecast interpolation and satellite imagery must have separate visual semantics: never use additive, point-based forecast heatmaps that can be mistaken for observed satellite clouds.
- A side-panel rail can be geometrically aligned while still being non-functional: acceptance must perform a trusted pointer drag or keyboard resize and assert the panel's actual rendered width and persisted value changed.
- A shared API is not a shared product state: when two routes maintain separate model, location, time and cache state, cross-route navigation must be tested as a state round-trip.
- A side-panel visual alignment is not enough: the acceptance check must drag from the real rail in both directions, compare rendered width and `aria-valuenow`, then reload and verify the persisted width. Synthetic drag helpers may emit a double-click, so drag completion must be protected from accidental reset.
- Forecast controls and timeline cards must read the same selected-location hour. A restored location without a single-point forecast silently falls back to a grid average and makes the UI contradict itself; localStorage hydration needs an explicit forecast fetch.
- E2E planner assertions must use a valid encoded deep link and current semantic shell selectors. A malformed `name=...?...` URL or a stale class assertion can look like an application failure even when the live route is correct; retain the manual route check when the browser reports an intermittent load page.
- 2026-08-09: A matrix showing `—` in every parameter row must be traced through the selected location, ISO time, and forecast hydration before changing null rendering; vertical and horizontal scroll are separate acceptance behaviors and both need browser checks.
- 2026-08-09: A browser cannot load `localhost:3100` when no dev/container process is listening; always verify the port and `/healthz` app identity first. Keep 3000 reserved for the existing local service and use `scripts/start-local.cmd` or `start-local.ps1 -Port 3100` to start the app.
- 2026-08-09: Planner detail drawers can receive a valid location with no valid active hour; any display helper used after async pressure loading must be null-safe, and the empty state must render a marker instead of throwing during render.
- 2026-08-09: Navigation links are part of the hydrated DOM contract; never build first-render hrefs from a clock-dependent store snapshot. Use a deterministic server/client snapshot, then restore browser state after hydration.
- 2026-08-09: A selected point forecast is invalid when its model metadata differs from the active cloud model. Clear stale point data, pass the model through sampling, and discard late responses before updating the shared store.
- 2026-08-09: A planner detail drawer is not resizeable merely because its parent is right-aligned; acceptance must drag its actual left edge, assert rendered width and aria-valuenow, then reload and verify persistence.
- 2026-08-09: E2E weather fixtures must share the acceptance date and time domain with the product's tonight state; a stale fixture start can make a valid matrix selection look broken by triggering the timeline reset guard.
- 2026-08-09: Data-source status must separate required, optional, and unavailable-by-license capabilities; a missing optional map token is configuration guidance, while missing dark-sky assets must remain an explicit no-data state.
- 2026-08-09: A right-edge restore control must be tested together with top-right map controls; when their hit areas overlap, reserve a layout gap instead of relying on z-index or force-clicking tests.
- 2026-08-10: A 1/3/5/7-day selector is not linked merely because it renders more cards. Acceptance must assert the chart dataset/category count changes, the active night changes the single-night chart key, and the selected night/hour propagates to the shared cross-product URL state.
- 2026-08-10: An inbound deep-link location is only the initial selection, not permanent authority. After the user selects another planner location, cross-product links must prefer the current detail; selecting a no-data night must also clear the previous forecast ISO time.

- 2026-08-12: A public-site clone is not complete when the shell only has demo markers. Import the verified location and boundary snapshots first, then assert the exact Bortle-filter counts and stable IDs across map, detail, review, and export.
- 2026-08-12: Never leave a full weather description as a permanent tooltip on every dense map marker. Keep permanent labels to the target site's compact name label and move rating, source, and risk detail to hover/click/detail surfaces; always review a real screenshot after marker fan-out.
- 2026-08-12: A refresh button must reach the cache boundary. Passing a changing query parameter to a route is insufficient if the server cache key ignores it; thread an explicit force-refresh flag through route, client, and fetcher, then verify a real API response.
- 2026-08-12: Dynamic local dates must also be used by E2E assertions. A stale `2026-08-09` expectation failed correctly on the current `2026-08-12` Shanghai date; update the test to compute the runtime date instead of weakening the product's tonight-first behavior.
- 2026-08-12: For wide data exports, an “Excel” button should include the actual hourly fields and status semantics, not only a summary CSV. An Excel-compatible HTML workbook with full hourly columns is a useful dependency-free fallback when no XLSX library is installed.
- 2026-08-12: Dense map labels must never permanently expose per-location rain/cloud/rating prose. The map is for spatial orientation; move weather detail to the selected-location panel and keep the permanent label name-only.
- 2026-08-12: “只显示地点”也包括地点旁的风险徽标；如果用户要看牵牛岗、太子尖等名称，地图常驻层只保留名称和非文字定位点，警告与天气解释必须进入详情面板。
- 2026-08-12: “Complete clone” needs an explicit audit, not a blanket claim. Compare the live target's controls and states, mark intentional exclusions separately, and expose the remaining fidelity gaps in a reviewable route such as `/integration-plan`.
- 2026-08-13: A mobile matrix click can expose a time-domain race that desktop timing hides. Keep the E2E forecast fixture anchored to the runtime Asia/Shanghai date and do not let the forecast first-frame guard overwrite a valid selected night-hour ISO time.
- 2026-08-13: A Playwright web server wrapper must not spawn a second long-lived Node process on Windows. Run the Next standalone server inside the wrapper process so Playwright can terminate it and the full-suite exit code remains authoritative.
- 2026-08-13: A Docker worker built from the Web image inherits its HTTP healthcheck unless Compose overrides it. Give background workers a process-appropriate healthcheck and verify both services become healthy, not merely that the worker printed one successful refresh.
- 2026-08-13: Cross-page shortlist acceptance should select a marker that is actually inside the current map viewport, then assert the selected location name survives navigation. DOM order and Leaflet-generated accessibility attributes are not stable proxies for a user's clickable map point.
- 2026-08-13: GIBS time dimensions are identified by an OWS child element, not necessarily a `name="time"` attribute. Expand only the published ISO ranges and preserve gaps; subtracting fixed intervals from the latest timestamp fabricates observations.
- 2026-08-13: Recommendation validity must be gated by the field that drives the score. Wind or precipitation availability cannot make a night scoreable when most cloud-cover samples are missing.
- 2026-08-13: A location-only forecast cache can silently cross model boundaries. Every consumer must verify metadata.model or use a model-qualified key before displaying or scoring cached data.
- 2026-08-13: 全国地图在 200+ 个点位上不能使用永久 Leaflet Tooltip；即使 Tooltip 文本只有名称，也会形成白色气泡墙。默认只显示小型评分点，选中点才显示名称，评分档位必须连接真实过滤状态。
- 2026-08-13: “无法刷新”必须同时核对浏览器目标端口和 `/healthz` 应用身份；3100 正常而 3190 无监听时，先修复启动入口或提示用户，不要把连接失败归因于组件渲染。

- 2026-08-13: 评分门槛的数量不能只绑定整晚快照；地图时间滑窗必须传递完整 ISO 时次，使用独立缓存键和 focusScores，并在请求切换期间拒绝沿用上一时次的颜色与数量。
- 2026-08-13: 多个组件同时请求同一时次时，AbortError 或旧请求失败可能晚于新请求返回；加载/降级状态必须绑定请求代次（时次、模型、夜晚），不能只看最后一次响应是否曾失败。
