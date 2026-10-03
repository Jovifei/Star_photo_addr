# Narrow automated accessibility gate (A11Y-AXE-001)

## Documented scope

`docs/project-tracking/TEST_BACKLOG.md` lists A11Y-AXE-001 as a secondary quality task, deferred because the axe dependency had not been added. `docs/testing/TEST_PLAN_V1.md` §11 already calls for automated button names, contrast, dialog titles, ARIA relationships and input labels. This change starts that bounded task; it does not turn all deferred work into a new release requirement or claim full accessibility compliance.

The preceding timezone correction is published as `2c143f72f0601da5b2e0559ce96374e67fe7be5d` on the existing draft PR #49. Its [CI 37138879197](https://github.com/Jovifei/Star_photo_addr/actions/runs/37138879197) completed all five jobs successfully, with 74 files / 428 unit, contract and integration tests, Chromium 234 passed / 122 applicability skips, and Firefox/WebKit 12 passed. Those results do not validate this later accessibility candidate.

## Dependency and runtime boundary

- Pin `@axe-core/playwright` to `4.13.0` in devDependencies only. Official npm registry metadata was checked before installation: peer dependency `playwright-core >= 1.0.0`, dependency `axe-core ~4.13.0`, and matching package integrity.
- The current Playwright is 1.62.1. axe-core 4.13.0 was already locked through the development tooling. Only one new package entry is needed.
- Preserve every pre-existing lockfile package entry, including platform/libc constraints. npm's unrelated metadata churn is not retained. Production dependencies and application code are unchanged in this test candidate.
- Use the [maintainer's Playwright integration](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright); do not inject a different accessibility engine or use legacy mode to hide frame limitations.

## Representative fixture states and failure policy

`tests/e2e/accessibility.spec.ts` adds three states to both existing Chromium projects (desktop and mobile), for six checks:

1. Selected homepage forecast with the original-source evidence disclosure open.
2. Data-sources/limitations dialog opened by keyboard. Check initial focus, backward/forward focus wrapping, Escape dismissal and trigger focus return.
3. The `/sites` compatibility path resolved into the current dark-sky view, with its selected point and active navigation preserved.

Use the existing normalized forecast/API fixtures and deterministic map tiles. The API helper already fails closed for unmocked same-origin endpoints; any unmocked external resource is blocked immediately. These checks do not request real weather or consume production provider quota. Readiness assertions include a populated source-update timestamp in both selected-point routes, rather than accepting an empty/loading document as accessibility evidence.

Each scan runs axe's default rules over the complete rendered document. There are no excluded elements, disabled rules, impact downgrades or existing-test removals. Serious and critical violations fail the test with rule IDs and affected nodes. Every completed scan attaches its full JSON results to the Playwright report, including lesser violations, incomplete/manual checks and passes; a green severity gate does not mean those other findings are resolved. The existing CI report upload retains these attachments.

## Verification and remaining limits

- Local aggregate checks pass: lint, TypeScript, 74 files / 428 tests and production build. Playwright discovery lists all six desktop/mobile cases with no applicability skips. Production audit reports zero vulnerabilities. Discovery is not browser execution.
- Local browser execution is BLOCKED in the current cloud executor: Firefox cannot create its SWGL framebuffer; Chromium cannot open its required local IPC socket, including through the supported elevated executor. No launch flags, permission changes or alternate environment are used to evade that restriction. These failures occur before application scanning, and are not accessibility findings.
- The existing draft PR's exact-head hosted CI is the first browser execution of this candidate. No local browser success or accessibility pass is claimed in advance. All pre-existing quality, live-data, container, Chromium and cross-browser gates remain active.
- Mock map tiles limit pixel and imagery-dependent contrast conclusions. The gate checks the UI rendered around those fixtures, not text contrast over every possible live satellite/base-map image. Fireglow/Cloudsea-specific accessibility states, broader interaction coverage, screen readers, forced colors, color-vision simulation, actual browser zoom and physical devices remain outside this first slice. Existing manual and deferred items are not marked passed.
- No merge, main update, production deployment, credentials, provider configuration or external telemetry is introduced.
