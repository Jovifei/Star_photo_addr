# Current engineering handoff

STATE: READY_FOR_LOCAL_VALIDATION
TASK: starphoto-378-postrelease-acceptance
ITERATION: 1

Repository: `Jovifei/Star_photo_addr`
Remote repair branch: `codex/postrelease-offset-integrity-20261007`

## Exact repair identity

- Accepted base: `378161ffe6aa21989ef48e63c9d077343d276a95`
- Accepted base tree: `5e4a8d6b57fe558bce152dc7b21bf7d0e6575fad`
- Regression-only commit: `1596e376065047342cc96e9b574c8e35e5340745`
- Regression-only tree: `bc3b523aba8c3fff68597897e4714c7bea247d05`
- Repair head: `d543fff637c561da9bc8197ef282495081a6601e`
- Repair tree: `15fb7c20a972d7def4ca60481738cfb41056aad0`

The repair head is the code-under-test. This handoff document is committed separately after it so its documentation commit does not change the repair tree.

## Proven source defect

At the accepted base, `src/lib/forecast.ts` allows an Open-Meteo surface payload to omit `utc_offset_seconds`, then normalizes that unknown value with `?? 0`. For a non-UTC provider timezone such as `Asia/Shanghai`, this can reinterpret provider-local wall-clock hours as UTC and feed the wrong instant into astronomy/recommendation scoring.

The repair does not derive an offset from a timezone name. It fail-closes if the provider offset is absent or non-finite, while preserving an explicit numeric zero as a valid UTC offset.

## Changed code

1. `tests/unit/forecast.test.ts`
   - Adds a regression that requires missing `utc_offset_seconds` to reject instead of becoming UTC.
   - Adds a guard that explicit `utc_offset_seconds: 0` remains valid in both the location result and provenance.
2. `src/lib/forecast.ts`
   - Adds one shared runtime validator for the provider UTC offset.
   - Runs it after existing cloud/time contract checks.
   - Removes both `?? 0` coercions from normalized forecast/provenance output.

No changes were made to pressure forecast handling, global night-date selection, UI/a11y code, deployment, credentials, network configuration, Draft PR49, Owner task notes, or the local acceptance ledger.

## Test status and required local proof

Remote ChatGPT has no command executor for this workspace. Therefore all command-based tests below are **NOT_RUN remotely** and must not be treated as passed.

Local Codex should:
1. Check out `1596e376065047342cc96e9b574c8e35e5340745` and run the focused forecast unit file. The new missing-offset regression is expected to FAIL on this test-only commit; capture the exact failure.
2. Check out `d543fff637c561da9bc8197ef282495081a6601e` and rerun the same focused file; it must PASS.
3. On the repair head run at minimum:
   - `npm run lint`
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`
4. Inspect the diff from `378161ffe6aa21989ef48e63c9d077343d276a95` to `d543fff637c561da9bc8197ef282495081a6601e` and confirm only the two code/test files above changed.
5. Do not deploy or merge Draft PR49. Return exact command output, exit statuses, and any failures to the remote review layer.

## Remaining acceptance gates

Still open and not claimed by this repair: physical-phone UX; broad keyboard/focus/screen-reader/contrast/dynamic-status accessibility; slow/interrupted/repeated-operation UX; live weather units/elevation/7-14 day coverage; overseas/DST global-night-date consistency; production/device proof.

`src/lib/pressure.ts` also contains timezone/offset fallbacks, but this review found no current scoring consumer of its `utcOffsetSeconds`; it is intentionally left as a separate audit item rather than bundled into this proven surface-forecast repair.
