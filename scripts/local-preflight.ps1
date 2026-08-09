$ErrorActionPreference = "Stop"

Write-Host "[1/7] Checking required commands..." -ForegroundColor Cyan
foreach ($command in @("git", "node", "npm")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $command"
    }
}

Write-Host "Git:  $(git --version)"
Write-Host "Node: $(node --version)"
Write-Host "npm:  $(npm --version)"

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 24) {
    throw "Node.js 24 or newer is required. Current: $(node --version)"
}

Write-Host "[2/7] Installing locked dependencies..." -ForegroundColor Cyan
npm ci

Write-Host "[3/7] Running lint, typecheck, unit tests and production build..." -ForegroundColor Cyan
npm run check

Write-Host "[4/7] Calling the real Open-Meteo API..." -ForegroundColor Cyan
npm run test:live

Write-Host "[5/7] Checking Playwright browser tests..." -ForegroundColor Cyan
npm run test:e2e

Write-Host "[6/7] Checking production health route contract..." -ForegroundColor Cyan
Write-Host "The /healthz runtime check is covered by Docker in step 7." -ForegroundColor DarkGray

Write-Host "[7/7] Checking Docker Compose when available..." -ForegroundColor Cyan
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose version
    docker compose config --quiet
    Write-Host "Docker Compose configuration is valid. Containers were not started." -ForegroundColor Green
} else {
    Write-Warning "Docker is not installed or not available in PATH. Docker runtime verification remains pending."
}

Write-Host "Local preflight completed successfully." -ForegroundColor Green
