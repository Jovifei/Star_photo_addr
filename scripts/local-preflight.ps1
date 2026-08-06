$ErrorActionPreference = "Stop"

Write-Host "[1/6] Checking required commands..." -ForegroundColor Cyan
foreach ($command in @("git", "node", "npm")) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $command"
    }
}

Write-Host "Git:  $(git --version)"
Write-Host "Node: $(node --version)"
Write-Host "npm:  $(npm --version)"

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 22) {
    throw "Node.js 22 or newer is required. Current: $(node --version)"
}

Write-Host "[2/6] Installing locked dependencies..." -ForegroundColor Cyan
npm ci

Write-Host "[3/6] Running unit and Sites Worker tests..." -ForegroundColor Cyan
npm test

Write-Host "[4/6] Calling the real Open-Meteo API..." -ForegroundColor Cyan
npm run test:live

Write-Host "[5/6] Building production assets..." -ForegroundColor Cyan
npm run build

Write-Host "[6/6] Checking Docker Compose when available..." -ForegroundColor Cyan
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker compose version
    docker compose config --quiet
    Write-Host "Docker Compose configuration is valid. Containers were not started." -ForegroundColor Green
} else {
    Write-Warning "Docker is not installed or not available in PATH. Docker runtime verification remains pending."
}

Write-Host "Local preflight completed successfully." -ForegroundColor Green
