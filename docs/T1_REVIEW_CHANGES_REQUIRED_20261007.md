# T1 selected-point clock review — CHANGES_REQUIRED

Candidate: 478e008e3d8be74b87e114f831ac830737a9a959, based on original branch755a1fe1ee16f2fda47c337b7e6c72255a3bd1d6. Not integrated or deployed. Production remains378161f.

## Actual checks

- Exact RED63a3147: targeted exit1; GREEN478e008:47 targeted tests passed.
- Lint/typecheck passed with two new exhaustive-deps warnings in ObservingMapControl/RecommendationQuickControls.
- Initial complete test run:480 PASS/1 FAIL, existing finder cache test hit unchanged5000ms timeout. Focused rerun6 PASS. Complete rerun with maxWorkers2, unchanged timeout:84 files481 PASS. Production build PASS.
- These checks do not cover all clock ownership cases.

## Blocking reproduction: explicit time chosen before request

In isolated worktree, temporarily reorder the existing storeHydration test actions: click `pin explicit` first, then `select la`. Keep fixed instant2026-10-07T05:58:59.788Z and all original expectations. Actual result is pointNight2026-10-06/pointTime2026-10-06T22:00; user requested2026-10-08/2026-10-08T20:00. Probe exited1, one failed/two passed. Original test file restored byte-for-byte; no product patch made locally.

Root cause: SYNC_LOCATION_CLOCK compares current night/time to values captured at request start. An already explicit value matches its captured value and is overwritten. Existing test protects only edits during the request.

Required remote repair: distinguish automatic from explicit clock ownership, preserve explicit choice before requests, during requests, across location changes, cache hits and model refreshes. Test URL/deep-link hydration separately. Do not use value equality as ownership proof.

## Blocking source audit: catalog date handoff

CandidateList date controls now update catalogSelectedNight only. PerseidsApp candidate onPick still calls sampleAt without passing the selected catalog night to point detail. Looking at Oct9 candidate scores then opening the candidate can show another point date/current night.

Required remote repair: explicitly carry the selected catalog date into point selection and protect it as explicit. Keep catalog's China timezone separate from overseas point automatic clock. Add interaction regression; this second issue is source-audit evidence, not yet a browser reproduction.

## Next full stage

After validated T1, execute compact mobile and independent astronomy/raw-fact display from MOBILE_DENSITY_REDESIGN_20261007.md, actual commits and handoff. ICON missing visibility must withhold score but retain cloud/rain/wind and independently calculable astronomy. Single portrait document scroll, compact visual type, direct date controls, equal four entrances; preserve zoom/touch targets.

Remote relay: original Project6a758ed08fcc8191b7e6184c19225bc1, successor chat6ac5c47d-2a7c-83ea-ad99-696dba6482b8. Page currently failed to load after interrupted reply; one same-chat reload/retry performed. Local C2C doctor remains green; this does not prove the remote chat is available. No new chat/task or network modifications.
