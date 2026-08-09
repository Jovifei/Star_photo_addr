<#
.SYNOPSIS
    One-click local start for the star-weather-planner Next.js app.

.DESCRIPTION
    Verifies Node.js 24+, installs locked dependencies when they are missing,
    starts `npm run dev`, waits until the dev server answers HTTP 200, and then
    opens the default browser. Any failure stops the dev server, prints the
    captured log tail and exits with a non-zero exit code.

.PARAMETER Port
    Port used by `next dev`. Defaults to $env:PORT or 3100.

.PARAMETER TimeoutSeconds
    How long to wait for the first HTTP 200 answer. Defaults to 180 seconds.

.PARAMETER NoBrowser
    Do not open the browser after the server becomes ready.

.PARAMETER Reinstall
    Force `npm ci` even when node_modules looks complete.

.PARAMETER SmokeTest
    Start the server, wait for HTTP 200, stop it again and exit 0.
    Used to verify this script itself in automation.

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1

.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-local.ps1 -Port 3100 -NoBrowser
#>
[CmdletBinding()]
param(
    [int]$Port = $(if ($env:PORT) { [int]$env:PORT } else { 3100 }),
    [int]$TimeoutSeconds = 180,
    [switch]$NoBrowser,
    [switch]$Reinstall,
    [switch]$SmokeTest
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------
$RequiredNodeMajor = 24
$FallbackNodeDir = "C:\Program Files\nodejs"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$BaseUrl = "http://127.0.0.1:$Port"
$LogDir = Join-Path $env:TEMP "star-weather-planner-start-local"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$StdOutLog = Join-Path $LogDir "dev-$Stamp.out.log"
$StdErrLog = Join-Path $LogDir "dev-$Stamp.err.log"

# Process handle shared between the main body and the cleanup block.
$script:DevProcess = $null
$script:ReusedExistingServer = $false

# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------

function Write-Step {
    param(
        [Parameter(Mandatory = $true)][string]$Message
    )
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Ok {
    param(
        [Parameter(Mandatory = $true)][string]$Message
    )
    Write-Host "    $Message" -ForegroundColor Green
}

function Resolve-NodeToolchain {
    <#
        Ensures node/npm are reachable and new enough. Falls back to the
        well-known Node 24 install directory when PATH does not expose it.
    #>
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue)) {
        if (Test-Path (Join-Path $FallbackNodeDir "node.exe")) {
            $env:Path = "$FallbackNodeDir;$env:Path"
        }
    }

    foreach ($command in @("node", "npm")) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Missing required command: '$command'. Install Node.js $RequiredNodeMajor+ (expected at $FallbackNodeDir) and reopen the shell."
        }
    }

    $nodeVersion = (& node --version).Trim()
    $nodeMajor = 0
    if ($nodeVersion -match '^v(\d+)\.') {
        $nodeMajor = [int]$Matches[1]
    }
    else {
        throw "Unable to parse Node.js version from '$nodeVersion'."
    }

    if ($nodeMajor -lt $RequiredNodeMajor) {
        $onDisk = Join-Path $FallbackNodeDir "node.exe"
        if (Test-Path $onDisk) {
            $fallbackVersion = (& $onDisk --version).Trim()
            if ($fallbackVersion -match '^v(\d+)\.' -and [int]$Matches[1] -ge $RequiredNodeMajor) {
                $env:Path = "$FallbackNodeDir;$env:Path"
                $nodeVersion = $fallbackVersion
                $nodeMajor = [int]$Matches[1]
            }
        }
    }

    if ($nodeMajor -lt $RequiredNodeMajor) {
        throw "Node.js $RequiredNodeMajor or newer is required (package.json engines.node >=24). Current: $nodeVersion"
    }

    $npmVersion = (& npm --version).Trim()
    Write-Ok "Node $nodeVersion / npm $npmVersion"
}

function Set-NodeMemoryOption {
    <#
        Guarantees --max-old-space-size is present in NODE_OPTIONS without
        discarding flags the caller already set (for example --use-system-ca).

        A plain "if NODE_OPTIONS is empty then overwrite" check is wrong: when
        the environment already carries an unrelated flag the OOM guard would be
        silently skipped, and `next build` runs out of memory on this project.
    #>
    param(
        [Parameter(Mandatory = $true)][int]$MegaBytes
    )

    $desiredFlag = "--max-old-space-size=$MegaBytes"
    $current = $env:NODE_OPTIONS

    if ([string]::IsNullOrWhiteSpace($current)) {
        $env:NODE_OPTIONS = $desiredFlag
        return
    }

    # Respect an explicit heap size chosen by the caller; only fill the gap.
    if ($current -match '--max[-_]old[-_]space[-_]size') {
        return
    }

    $env:NODE_OPTIONS = "$($current.Trim()) $desiredFlag"
}

function Get-MissingDependencyMarker {
    <#
        Returns the first missing marker path, or $null when node_modules looks
        like a completed install.

        node_modules/.package-lock.json is npm's own "install finished" marker.
        Its absence means the tree is stale or an install was interrupted, which
        is exactly when a fresh `npm ci` is required.
    #>
    $markers = @(
        "node_modules",
        "node_modules\.package-lock.json",
        "node_modules\next\package.json",
        "node_modules\react\package.json",
        "node_modules\react-dom\package.json",
        "node_modules\.bin\next.cmd"
    )

    foreach ($relativePath in $markers) {
        if (-not (Test-Path (Join-Path $RepoRoot $relativePath))) {
            return $relativePath
        }
    }

    return $null
}

function Test-AppHealth {
    <#
        Returns $true only when the response identifies this application. An
        HTTP 200 from Grafana or another local service is not sufficient.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [int]$TimeoutMs = 5000
    )

    try {
        $request = [System.Net.HttpWebRequest]::Create("$Url/healthz")
        $request.Method = "GET"
        $request.Timeout = $TimeoutMs
        $request.ReadWriteTimeout = $TimeoutMs
        $request.Proxy = $null
        $request.AllowAutoRedirect = $true
        $request.UserAgent = "start-local.ps1"
        $response = $request.GetResponse()
        $statusCode = [int]$response.StatusCode
        $body = (New-Object System.IO.StreamReader($response.GetResponseStream())).ReadToEnd()
        $response.Close()
        if ($statusCode -ne 200) { return $false }
        $payload = $body | ConvertFrom-Json
        return ($payload.status -eq "ok" -and $payload.app -eq "star-weather-planner")
    }
    catch {
        return $false
    }
}

function Get-PortOwnerDetails {
    param([Parameter(Mandatory = $true)][int]$TcpPort)

    $details = @()
    try {
        $connections = Get-NetTCPConnection -State Listen -LocalPort $TcpPort -ErrorAction Stop
        foreach ($connection in $connections) {
            $process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue
            $name = if ($process) { $process.ProcessName } else { "unknown" }
            $details += "PID $($connection.OwningProcess) ($name)"
        }
    }
    catch {
        $details += "Unable to read the process listening on port $TcpPort."
    }
    if ($details.Count -eq 0) { return "unknown process" }
    return ($details -join ", ")
}

function Test-PortInUse {
    <#
        Reports whether something is already listening on the local port.

        This matters because `next dev` silently falls back to the next free
        port when the requested one is taken, which would make the readiness
        probe wait for a URL the server never binds to.
    #>
    param(
        [Parameter(Mandatory = $true)][int]$TcpPort
    )

    try {
        $connections = Get-NetTCPConnection -State Listen -LocalPort $TcpPort -ErrorAction Stop
        return ($null -ne $connections)
    }
    catch [System.Management.Automation.CommandNotFoundException] {
        # Older hosts without the NetTCPIP module: fall back to netstat.
        $netstatOutput = & netstat.exe -ano
        foreach ($line in $netstatOutput) {
            if ($line -match "^\s+TCP\s+\S+:$TcpPort\s+\S+\s+LISTENING") {
                return $true
            }
        }
        return $false
    }
    catch {
        # Get-NetTCPConnection throws when no matching connection exists.
        return $false
    }
}

function Get-LogTail {
    <#
        Collects the tail of both dev-server log files so failures keep context.
    #>
    param(
        [int]$Lines = 40
    )

    $chunks = @()
    foreach ($entry in @(@{ Label = "stdout"; Path = $StdOutLog }, @{ Label = "stderr"; Path = $StdErrLog })) {
        if (Test-Path $entry.Path) {
            $content = Get-Content -Path $entry.Path -Tail $Lines -ErrorAction SilentlyContinue
            if ($content) {
                $chunks += "--- dev server $($entry.Label) (last $Lines lines) ---"
                $chunks += $content
            }
        }
    }

    if ($chunks.Count -eq 0) {
        return "(dev server produced no output; see $LogDir)"
    }
    return ($chunks -join [Environment]::NewLine)
}

function Stop-DevServer {
    <#
        Kills the npm wrapper together with the spawned node child processes.
    #>
    if ($null -eq $script:DevProcess) {
        return
    }

    $processId = $script:DevProcess.Id
    try {
        if (-not $script:DevProcess.HasExited) {
            Write-Step "Stopping dev server (PID $processId)..."
            & taskkill.exe /PID $processId /T /F 2>&1 | Out-Null
            $null = $script:DevProcess.WaitForExit(10000)
        }
    }
    catch {
        Write-Warning "Failed to stop dev server PID ${processId}: $($_.Exception.Message)"
    }
    finally {
        $script:DevProcess = $null
    }
}

# --------------------------------------------------------------------------
# Main
# --------------------------------------------------------------------------
try {
    Push-Location $RepoRoot
    try {
        Write-Host "star-weather-planner - local one-click start" -ForegroundColor Magenta
        Write-Host "Repository: $RepoRoot"

        # [1/5] Toolchain -------------------------------------------------
        Write-Step "[1/5] Checking Node.js toolchain..."
        Resolve-NodeToolchain

        Set-NodeMemoryOption -MegaBytes 2048
        Write-Ok "NODE_OPTIONS=$env:NODE_OPTIONS"

        # [2/5] Dependencies ----------------------------------------------
        Write-Step "[2/5] Checking dependencies..."
        $missingMarker = Get-MissingDependencyMarker
        if ($Reinstall -or $null -ne $missingMarker) {
            if ($Reinstall) {
                $reason = "-Reinstall requested"
            }
            else {
                $reason = "missing '$missingMarker'"
            }
            Write-Host "    $reason -> running 'npm ci'..."
            $global:LASTEXITCODE = 0
            & npm ci
            if ($LASTEXITCODE -ne 0) {
                throw "'npm ci' failed with exit code $LASTEXITCODE. Fix the dependency errors above and retry."
            }
            Write-Ok "Dependencies installed."
        }
        else {
            Write-Ok "node_modules is present, skipping 'npm ci'."
        }

        # [3/5] Dev server -------------------------------------------------
        Write-Step "[3/5] Starting dev server on $BaseUrl ..."
        if (Test-AppHealth -Url $BaseUrl -TimeoutMs 2000) {
            $script:ReusedExistingServer = $true
            Write-Ok "This app is already healthy on port $Port; reusing it."
        }
        else {
            # `next dev` silently switches to another port when this one is
            # taken, so fail fast instead of probing a URL that never binds.
            if (Test-PortInUse -TcpPort $Port) {
                $owner = Get-PortOwnerDetails -TcpPort $Port
                throw "Port $Port is already in use by $owner, but /healthz is not the star-weather-planner app. Stop that process or start on another port: -Port <number>."
            }

            if (-not (Test-Path $LogDir)) {
                $null = New-Item -ItemType Directory -Path $LogDir -Force
            }

            $npmCommand = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)
            if ($null -eq $npmCommand) {
                $npmCommand = (Get-Command "npm" -ErrorAction Stop)
            }

            $script:DevProcess = Start-Process -FilePath $npmCommand.Source `
                -ArgumentList @("run", "dev", "--", "--port", "$Port") `
                -WorkingDirectory $RepoRoot `
                -RedirectStandardOutput $StdOutLog `
                -RedirectStandardError $StdErrLog `
                -NoNewWindow -PassThru

            Write-Ok "Dev server process started (PID $($script:DevProcess.Id)). Logs: $LogDir"

            # [4/5] Readiness probe ---------------------------------------
            Write-Step "[4/5] Waiting for star-weather-planner health on $BaseUrl/healthz (timeout ${TimeoutSeconds}s)..."
            $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
            $ready = $false
            while ((Get-Date) -lt $deadline) {
                if ($script:DevProcess.HasExited) {
                    throw "Dev server exited early with code $($script:DevProcess.ExitCode).`n$(Get-LogTail)"
                }
                if (Test-AppHealth -Url $BaseUrl -TimeoutMs 5000) {
                    $ready = $true
                    break
                }
                Start-Sleep -Milliseconds 750
            }

            if (-not $ready) {
                throw "Dev server did not expose the star-weather-planner health response on $BaseUrl/healthz within ${TimeoutSeconds}s.`n$(Get-LogTail)"
            }
            Write-Ok "Dev server is ready and identified as star-weather-planner."
        }

        # [5/5] Browser ----------------------------------------------------
        Write-Step "[5/5] Opening the app..."
        if ($NoBrowser -or $SmokeTest) {
            Write-Ok "Browser launch skipped. Open $BaseUrl/ manually."
        }
        else {
            Start-Process "$BaseUrl/" | Out-Null
            Write-Ok "Browser opened at $BaseUrl/"
        }

        if ($SmokeTest) {
            Write-Host ""
            Write-Host "Smoke test passed: $BaseUrl/healthz identifies star-weather-planner." -ForegroundColor Green
            exit 0
        }

        if ($script:ReusedExistingServer) {
            Write-Host ""
            Write-Host "Reused a dev server that this script does not own; nothing to keep alive." -ForegroundColor Green
            exit 0
        }

        Write-Host ""
        Write-Host "Dev server is running at $BaseUrl/ - press Ctrl+C to stop." -ForegroundColor Green
        Write-Host "Useful routes: / , /viirs , /api/geocode?q=hangzhou&count=5&language=zh"
        $script:DevProcess.WaitForExit()
        $devExitCode = $script:DevProcess.ExitCode
        $script:DevProcess = $null
        if ($devExitCode -ne 0) {
            throw "Dev server terminated with exit code $devExitCode.`n$(Get-LogTail)"
        }
        exit 0
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host ""
    Write-Host "Local start failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Full dev server logs: $LogDir" -ForegroundColor Yellow
    Stop-DevServer
    exit 1
}
finally {
    if ($null -ne $script:DevProcess) {
        Stop-DevServer
    }
}
