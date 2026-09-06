# Release Rules
<!-- last-analyzed: 2026-09-06T16:00:00+08:00 -->

## Version Sources

- `package.json`: primary application semver.
- `package-lock.json`: root package metadata must match `package.json`.
- `CHANGELOG.md`: Keep a Changelog entries, newest version first.
- `src/components/ChangelogModal.tsx`: interactive in-app version history; newest item is `current: true`.
- `src/components/ProductHeader.tsx`: visible current-version badge and accessible labels.

## Release Trigger

Manual versioned commit on a `codex/` branch, followed by fast-forward merge to `main` and explicit deployment verification.

## Test Gate

`npm run check` and `npm run test:e2e` on an isolated local port. Live data and deployment gates use `npm run test:live` and `npm run check:data-sources -- <base-url>`.

## Registry / Distribution

No npm package publication. Distribution is the Docker Compose application on Alibaba ECS behind Nginx at `photo.joviluma.com`.

## Release Notes Strategy

Use Keep a Changelog in `CHANGELOG.md` and mirror the newest user-facing summary in `ChangelogModal.tsx`.

## CI Workflow Files

`.github/workflows/ci.yml`.

## First-Time Setup Gaps

No dedicated release workflow; deployment is manual/SSH-driven through the repository's Compose procedure.
