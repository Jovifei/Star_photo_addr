## ADDED Requirements

### Requirement: Clean clone install
The application SHALL install from a clean clone (no `node_modules`, no `.next`) via `npm ci` on Node 24, producing a dependency tree fully consistent with `package.json` (Next.js 16.2.1, React 19.2.4, project version 0.3.1). `npm ci` MUST complete without MODULE_NOT_FOUND or peer-dependency errors.

#### Scenario: npm ci succeeds on Node 24
- **WHEN** a developer clones the repository fresh and runs `npm ci` with Node 24
- **THEN** the install completes without MODULE_NOT_FOUND / peer-dependency errors and the lockfile matches `package.json`

### Requirement: Local dev launch on port 3000
The application SHALL be launchable via `npm run dev`, serving the Next.js App Router app with same-origin `/api/forecast` and `/api/geocode` route handlers on `http://127.0.0.1:3000`.

#### Scenario: dev server responds on 127.0.0.1:3000
- **WHEN** `npm run dev` is started and the browser opens http://127.0.0.1:3000
- **THEN** `GET /` and `GET /viirs` return 200 and the APIs return weather data

### Requirement: Graceful asset degradation
When optional `/public` assets (world atlas, VIIRS tiles, boundaries, cities) are absent, the app MUST NOT crash or loop on 404; missing layers SHALL be disabled or labeled "无数据/不确定".

#### Scenario: missing dark-sky assets do not crash
- **WHEN** the public dark-sky/VIIRS assets are not installed
- **THEN** the map and weather flows remain usable and `sampleBortle` nodata is shown as "不确定", never as a trusted B9/SQM

### Requirement: CI on main
CI SHALL run on the `main` branch (plus `workflow_dispatch`) using Node 24, `npm ci`, and `npm run check`.

#### Scenario: CI triggers on main
- **WHEN** a push or dispatch targets `main`
- **THEN** the pipeline installs with Node 24 and runs `npm run check` (lint + typecheck + unit + build)
