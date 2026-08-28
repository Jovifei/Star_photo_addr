# Full product integrity implementation plan

## Current goal

Implement the approved product-integrity design from `docs/superpowers/specs/2026-08-26-full-product-integrity-design.md`, consolidate the accepted behavior on top of `main@bc8a964`, verify locally, publish to `main`, and redeploy the ECS `star-photo` Compose project.

## Evidence and boundaries

- Current base: `main@bc8a964`; PR #14 mobile branch tree is already equal to `main`.
- Existing local edits are user-owned and must be preserved: `src/app/globals.css`, `src/components/useSidePanelWidth.ts`, and `tests/e2e/mobile-panel-dock.spec.ts`.
- No Bortle/SQM licensed payload, token, API key, password, or TLS certificate will be invented or committed.
- Docker deployment must preserve the existing `star-photo_observing-snapshots` volume and use project name `star-photo`.

## Checkable steps

- [ ] Add failing unit/E2E coverage for Bortle chip filtering, unknown score state, nearest-N fallback, Fireglow full-width geometry, and cloud refresh degradation.
  - Expected: each new test fails for the intended missing behavior.
  - Status label: `RED_TESTS_CONFIRMED`.
- [ ] Implement the smallest production changes in the observing control/layer, data status/cloud refresh, planner nearby ranking, and Fireglow layout while preserving current route contracts.
  - Expected: focused tests pass without changing asset/license semantics.
  - Status label: `IMPLEMENTED_TARGETED`.
- [ ] Re-run focused tests, `npm.cmd run check`, and desktop/portrait/landscape Chromium E2E with an isolated identity-checked port.
  - Expected: lint/typecheck/unit/build and targeted E2E pass; any legacy contract mismatch is fixed or explicitly reported.
  - Status label: `LOCAL_VERIFIED`.
- [ ] Review branch diff and graph, stage only intended files, commit once on the implementation branch, merge/push to `main` per the confirmed topology, and recheck `HEAD`/`origin/main`.
  - Rollback: retain the pre-change `main@bc8a964` SHA and do not delete unique remote branches.
  - Status label: `MAIN_PUBLISHED`.
- [ ] Deploy on ECS using `docker compose -p star-photo -f docker-compose.yml -f docker-compose.aliyun.yml up -d --build`, verify both services healthy, `/healthz` build revision, `/api/data-status`, and public HTTP.
  - Rollback: rebuild the previous known-good SHA with the same Compose project name; never use `down -v`.
  - Status label: `ECS_HTTP_VERIFIED`.
