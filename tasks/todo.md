# Branch consolidation correction

- [x] Compare every visible development branch by tree, ancestry, and unique commits
- [x] Select the latest complete product tree and define the single surviving branch topology
- [ ] Consolidate the required branches without losing unique work
- [ ] Re-run relevant validation and verify local/remote branch refs

## Review

- Latest complete product tree: local `main@6645856`; it is tree-identical to local `codex/product-integration-final@62387c9`.
- Surviving branch: `main` (current remote default). The accidental parallel `master` and all historical development refs will be merged as ancestry, then removed.
- `feature/20260807/local-run-finalization` is stale and polluted with agent/OpenSpec runtime files; preserve its commits as ancestry but do not apply its tree over the current product.
