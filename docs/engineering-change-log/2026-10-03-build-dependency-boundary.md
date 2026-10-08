# Build dependency boundary and production audit recovery

## Scope and baseline

- Baseline: `main@19fcee25643b6b9db2c547ca8f094efd0b7c8fa4`, after PR #48 and its v1.0.26 deployment receipt.
- Continue the existing `codex/overnight-forecast-coverage-20261003` branch, fast-forwarding its former `f2b94fc` tip to the current baseline. No new branch, main update, merge or deployment is part of this change.
- [CI 37093985225](https://github.com/Jovifei/Star_photo_addr/actions/runs/37093985225) failed in `quality` at the unchanged `npm audit --omit=dev --audit-level=high` gate. The other dependent test jobs were skipped, not passed.

## Cause and bounded correction

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) reports stack-exhaustion denial of service in deeply nested `braces` patterns. At verification on 2026-10-03, the advisory lists no patched release and npm latest is 3.0.3. The production audit's six affected package entries were reached through the `shadcn` CLI and its glob/AST tools. The proposed `npm audit fix --force` downgrade to shadcn 1.0.0 is not used.

The only application reference to shadcn is `@import "shadcn/tailwind.css"` in `src/app/globals.css`. Tailwind consumes that stylesheet during the build. There is no JavaScript import of shadcn or its glob/AST tooling in application/worker sources. The Docker build installs all build dependencies; its runner copies Next's standalone output and compiled static assets, not the complete development `node_modules` directory.

Move `shadcn` from dependencies to devDependencies, retaining the original `^4.1.0` range and locked 4.16.2 package. All 811 lockfile package paths, versions, URLs, integrity hashes and platform metadata are preserved. Only the root dependency classification and npm-generated `dev` / `devOptional` metadata change. The CSS, runtime code, package version, Dockerfile and audit severity/omit policy are unchanged.

This corrects the declared production inventory. It does not claim that a remotely exploitable application path was found or patched; the CLI chain was already absent from the standalone output. It also does not fix the upstream advisory. Full development audit still reports eight high-severity entries through shadcn and ESLint tooling; do not pass untrusted glob patterns to those tools, and reassess when an upstream fix is available.

## Regression and verification

- New `tests/contract/buildDependencyBoundary.test.ts`: manifest placement, lockfile exclusion of shadcn/braces/micromatch/fast-glob/ts-morph/@ts-morph/common from production, and absence of JavaScript imports from application/worker sources.
- RED before the move: two failures, one pass. GREEN after the move: all three pass.
- `npm ci`: PASS using a writable temporary npm cache.
- `npm audit --omit=dev --audit-level=high`: PASS, zero vulnerabilities. Full `npm audit --audit-level=high`: eight development high entries remain, explicitly not an all-dependency clean bill.
- `STAR_BUILD_CPUS=2 NEXT_TELEMETRY_DISABLED=1 npm run check`: PASS, ESLint, TypeScript, 73 files / 421 tests, production build.
- Separate clean `npm ci --omit=dev --ignore-scripts` and package scan: PASS; none of the six build-only package families are installed. This checks inventory, not native install-script behavior.
- Built `.next/standalone` package scan and independent `.nft.json` trace inspection: PASS; the CLI/glob/AST chain is absent.
- Independent read-only review: PASS for the dependency-boundary correction and unchanged lock resolutions; suggested broader import guard adopted.
- Local full Chromium: BLOCKED before browser page launch by the environment's `socket() failed: Operation not permitted`; six API-only cases ran successfully, then the browser failures stopped the run. This is not a full E2E pass. Default browser download also returned truncated archives; system Chromium did not remove the socket restriction.
- Local Firefox core smoke: PASS, 3/3 fixture tests. WebKit: BLOCKED before page launch by missing system libraries; remaining two cases did not run. Container smoke: NOT_RUN locally because Docker is unavailable. These checks remain part of the GitHub gate.
- GitHub exact-commit full CI: PENDING, to be recorded after the draft PR run reaches a terminal result.
- No production requests, cache clearing, forced refresh, weather-provider changes, main merge or deployment performed.

## Remaining release boundaries

The v1.0.26 deployment receipt remains the source for historical runtime identity and previous-night scoring evidence. Its production visual acceptance is still pending, and `PENDING_REMOTE_PLANNING` remains open. Neither this inventory correction nor local fixture tests close those gates.
