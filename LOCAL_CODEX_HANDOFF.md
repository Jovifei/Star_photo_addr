# Current engineering handoff

Repository: `Jovifei/Star_photo_addr`
Branch: `codex/overnight-forecast-coverage-20261003`
Review: [Draft PR 49](https://github.com/Jovifei/Star_photo_addr/pull/49)

## Published baseline

Exact head `7a1e6b13bfec647591845c7790ea9fb798c75a18`, tree `0b78dffe2183be36419d3fbb4ca9917e6a8b21ff`.
[CI 37343815232](https://github.com/Jovifei/Star_photo_addr/actions/runs/37343815232) finished with Chromium 259 passed / 124 applicability skips / 1 failed. The other four jobs succeeded: quality (82 files / 466 tests; production audit zero), Firefox/WebKit (12 passed), container and live-data smoke.

All desktop/mobile 100%/200% readability and map-retry cases passed. Original-resolution screenshots confirmed the candidate names, timeline controls, map-error copy and layers controls in their tested states. The full run still failed; physical-phone settings and actual browser zoom were not verified.

## Pending repair

The mobile tooltip lifecycle test clicked during an already-running initial map-positioning animation. The test now waits for the expected fixture center, zoom 8, an existing map pane and no zoom/pan animation in one observable snapshot. Its two strict zoom-plus-one checks and every tooltip naming assertion remain unchanged. Product map behavior is unchanged.

This nine-line test repair passed local lint, types, 82 files / 466 tests and production build, plus independent trace and diff review. These checks apply to the unchanged test source in the current candidate; documentation minimization does not establish a new browser result.

## Remaining release gates

Publish the reviewed candidate on the same branch without force, verify its exact SHA/tree and run its full CI. Inspect that run's actual screenshots and metadata before release. Previous successful jobs are not acceptance of a different candidate.

Deployment has not occurred for this repair. Before the approved release, verify the current running version and a usable rollback point through the existing deployment process; preserve application data. See [deployment guidance](docs/DEPLOYMENT.md) and [current repair evidence](docs/engineering-change-log/2026-10-05-candidate-lines-and-map-retry.md).
