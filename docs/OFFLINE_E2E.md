# Offline browser regression

Build the production server first, then run the existing E2E matrix with local
fixtures and provider egress disabled:

```powershell
npm run build
# Optional: select an already installed Chromium executable.
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
$env:E2E_OFFLINE_OUTPUT_DIR = 'tmp/offline-e2e/my-run'
npm run test:e2e:offline
```

The default matrix is the repository's desktop Chromium and Pixel 7 Chromium
emulation. The configured Firefox desktop / WebKit iPhone smoke matrix is:

```powershell
$env:E2E_OFFLINE_OUTPUT_DIR = 'tmp/offline-e2e/my-cross-browser-run'
npm run test:e2e:offline -- --cross-browser
```

Use installed browsers; these commands never install them. Missing executables
are a real execution blocker, not a passed or skipped browser result. Normal
Playwright arguments (file filters, `--project`, `--grep`, `--list`) are supported.

## Isolation

- Every spec imports `offline-test.ts`. Outside the offline runner it exports the
  ordinary Playwright test object. In offline mode its automatic fixture installs
  the existing local API/weather/geocoding fixtures at browser-context scope.
- A test's explicit page routes take precedence, retaining error, quota, stale,
  and recovery scenarios. An API without an explicit fixture returns the existing
  fixture helper's 503, rather than reaching a real provider through Next.
- The local `/api/geocode` route runs under the server guard so browser tests can
  exercise its real catalogue lookup. Explicit page geocoding fixtures still
  take precedence. Unmatched queries cannot reach the remote geocoder.
- Other external browser images receive a one-pixel PNG; other external requests
  and WebSockets are blocked. Service workers are disabled to prevent bypassing
  context routing. The browser report attaches host/count-only network evidence.
- The runner preloads `offline-network-guard.cjs` into Playwright workers and the
  Next server. Fetch, HTTP(S), and socket connections to non-loopback hosts fail
  before connecting. The guard refuses to load outside `E2E_OFFLINE=1` and writes
  only host/transport/PID records when it blocks an attempted server connection.

The runner uses the prebuilt standalone server on the reserved local port and
does not reuse an existing server. Each selected output directory receives the
JSON result, HTML report, failure traces, and any server-egress audit. Choose a
new directory for each round to preserve failed-run evidence.
TypeScript excludes these generated output directories, matching the existing
lint exclusions. Retained trace-viewer JS bundles must not become compiler input.

## Meaning of results

Project guards remain active and their skips must be reported separately from
passes. A test title mentioning Firefox/WebKit does not establish those browsers
ran: use the actual project/browser in the JSON result. Mobile browser emulation
does not establish physical-device behavior.

Offline results verify application behavior against controlled local contracts.
They do not verify live-provider availability, real forecast freshness/coverage,
scientific accuracy, physical devices, or production deployment. PR creation is
separate because the current PR workflow includes real-provider smoke tests.
