# connect-device.ps1
# Connects your wireless Android device via ADB.
#
# FIRST TIME / RE-PAIR:
#   .\connect-device.ps1 -Pair -Ip 192.168.x.x -PairPort <pairing-port> -PairCode <code>
#
# SUBSEQUENT CONNECTS:
#   .\connect-device.ps1                           # uses saved IP, auto-detects port
#   .\connect-device.ps1 -Ip 192.168.x.x          # specify IP, auto-detects port
#   .\connect-device.ps1 -Ip 192.168.x.x -Port N  # fully manual

param(
    [string]$Ip,
    [int]$Port,
    [switch]$Pair,
    [int]$PairPort,
    [string]$PairCode
)

$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
$CacheFile = "$PSScriptRoot\.device-ip-cache"

if (-not (Test-Path $ADB)) {
    Write-Host "[ERROR] adb.exe not found at: $ADB" -ForegroundColor Red
    Write-Host "        Make sure Android SDK platform-tools are installed." -ForegroundColor Yellow
    exit 1
}

# ── Helper: save IP to cache ──
function Save-DeviceIp([string]$ip) {
    $ip | Out-File -FilePath $CacheFile -Encoding utf8 -Force
}

# ── Helper: load cached IP ──
function Get-CachedIp {
    if (Test-Path $CacheFile) {
        return (Get-Content $CacheFile -Raw).Trim()
    }
    return $null
}

# ── PAIR MODE ──
if ($Pair) {
    if (-not $Ip) {
        Write-Host "[ERROR] -Ip is required for pairing." -ForegroundColor Red
        Write-Host "        Check Wireless Debugging screen on your phone for the IP." -ForegroundColor Yellow
        exit 1
    }
    if (-not $PairPort) {
        Write-Host "[ERROR] -PairPort is required for pairing." -ForegroundColor Red
        Write-Host "        Tap 'Pair device with pairing code' on your phone and use the port shown." -ForegroundColor Yellow
        exit 1
    }

    $pairTarget = "${Ip}:${PairPort}"
    Write-Host "[INFO] Pairing with $pairTarget ..." -ForegroundColor Cyan

    if ($PairCode) {
        # Pipe the code to adb pair
        $result = $PairCode | & $ADB pair $pairTarget 2>&1
    } else {
        Write-Host "[INFO] Enter the pairing code shown on your phone:" -ForegroundColor Yellow
        $result = & $ADB pair $pairTarget 2>&1
    }

    if ("$result" -match "Successfully paired") {
        Write-Host "[OK] Paired successfully!" -ForegroundColor Green
        Save-DeviceIp $Ip
        Write-Host "[INFO] IP saved. Now connecting..." -ForegroundColor Cyan
        Write-Host ""
    } else {
        Write-Host "[ERROR] Pairing failed: $result" -ForegroundColor Red
        Write-Host ""
        Write-Host "[TIPS] Make sure:" -ForegroundColor Yellow
        Write-Host "   1. Wireless Debugging is ON" -ForegroundColor Gray
        Write-Host "   2. You tapped 'Pair device with pairing code'" -ForegroundColor Gray
        Write-Host "   3. The pairing code and port are from the CURRENT dialog (they change each time)" -ForegroundColor Gray
        exit 1
    }
}

# ── RESOLVE IP ──
if (-not $Ip) {
    # Check if already connected
    Write-Host "[INFO] Checking for connected devices..." -ForegroundColor Cyan
    $devices = & $ADB devices 2>&1 | Select-String -Pattern "device$"

    if ($devices) {
        Write-Host "[OK] Device already connected:" -ForegroundColor Green
        & $ADB devices -l | Select-String -Pattern "device\s" | ForEach-Object { Write-Host "     $_" -ForegroundColor White }
        Write-Host ""
        Write-Host "[OK] Ready to run: flutter run -d android" -ForegroundColor Green
        exit 0
    }

    # Try cached IP
    $Ip = Get-CachedIp
    if ($Ip) {
        Write-Host "[INFO] Using cached IP: $Ip" -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] No device connected and no cached IP." -ForegroundColor Red
        Write-Host ""
        Write-Host "[USAGE] First time? Pair your device:" -ForegroundColor Yellow
        Write-Host "   .\connect-device.ps1 -Pair -Ip <phone-ip> -PairPort <port> -PairCode <code>" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Find IP and pairing info on your phone:" -ForegroundColor Gray
        Write-Host "   Settings > Developer Options > Wireless Debugging" -ForegroundColor Gray
        exit 1
    }
}

# ── RESOLVE PORT ──
# Wireless debugging connection port is NOT the pairing port.
# It's shown on the main Wireless Debugging screen (not the pairing dialog).
# If not provided, try to discover it.
if (-not $Port) {
    # Try to find the device via mdns
    Write-Host "[INFO] Discovering connection port for $Ip ..." -ForegroundColor Cyan
    $mdnsResult = & $ADB mdns services 2>&1
    # Look for _adb-tls-connect entries matching our IP
    $portMatch = $mdnsResult | Select-String -Pattern "$([regex]::Escape($Ip)):(\d+)" | ForEach-Object { $_.Matches[0].Groups[1].Value } | Select-Object -First 1

    if ($portMatch) {
        $Port = [int]$portMatch
        Write-Host "[INFO] Discovered port: $Port" -ForegroundColor Green
    } else {
        # Common fallback: try well-known ports
        Write-Host "[INFO] mDNS discovery didn't find port. Trying common ports..." -ForegroundColor Yellow
        $commonPorts = @(5555, 37069, 38069, 39085, 40000..40010)
        $found = $false
        foreach ($p in $commonPorts) {
            $testResult = & $ADB connect "${Ip}:${p}" 2>&1
            if ("$testResult" -match "connected to|already connected") {
                $Port = $p
                $found = $true
                Write-Host "[OK] Connected on port $p" -ForegroundColor Green
                Save-DeviceIp $Ip
                & $ADB devices -l | Select-String -Pattern "device\s" | ForEach-Object { Write-Host "     $_" -ForegroundColor White }
                Write-Host ""
                Write-Host "[OK] Ready to run: flutter run -d android" -ForegroundColor Green
                exit 0
            }
            # Disconnect failed attempt to avoid stale entries
            & $ADB disconnect "${Ip}:${p}" 2>&1 | Out-Null
        }

        Write-Host "[ERROR] Could not discover the connection port." -ForegroundColor Red
        Write-Host ""
        Write-Host "[TIPS] On your phone, go to:" -ForegroundColor Yellow
        Write-Host "   Settings > Developer Options > Wireless Debugging" -ForegroundColor Gray
        Write-Host "   The IP & Port shown on the MAIN screen (not pairing dialog) is the connection port." -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Then run:" -ForegroundColor Yellow
        Write-Host "   .\connect-device.ps1 -Ip $Ip -Port <connection-port>" -ForegroundColor Gray
        exit 1
    }
}

# ── CONNECT ──
$target = "${Ip}:${Port}"
Write-Host "[INFO] Connecting to $target ..." -ForegroundColor Cyan

$result = & $ADB connect $target 2>&1

if ("$result" -match "connected to") {
    Write-Host "[OK] Connected to $target" -ForegroundColor Green
    Save-DeviceIp $Ip
    & $ADB devices -l | Select-String -Pattern "device\s" | ForEach-Object { Write-Host "     $_" -ForegroundColor White }
    Write-Host ""
    Write-Host "[OK] Ready to run: flutter run -d android" -ForegroundColor Green
} elseif ("$result" -match "already connected") {
    Write-Host "[OK] Already connected to $target" -ForegroundColor Green
    Write-Host "[OK] Ready to run: flutter run -d android" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to connect: $result" -ForegroundColor Red
    Write-Host ""
    Write-Host "[TIPS] Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Make sure Wireless Debugging is ON in Developer Options" -ForegroundColor Gray
    Write-Host "   2. Check that your phone and PC are on the same WiFi network" -ForegroundColor Gray
    Write-Host "   3. The CONNECTION port is different from the PAIRING port!" -ForegroundColor Gray
    Write-Host "      - Connection port: shown on main Wireless Debugging screen" -ForegroundColor Gray
    Write-Host "      - Pairing port: shown only in the 'Pair with code' dialog" -ForegroundColor Gray
    Write-Host "   4. Try re-pairing:" -ForegroundColor Gray
    Write-Host "      .\connect-device.ps1 -Pair -Ip $Ip -PairPort <pairing-port> -PairCode <code>" -ForegroundColor Gray
    Write-Host "   5. Specify connection port manually:" -ForegroundColor Gray
    Write-Host "      .\connect-device.ps1 -Ip $Ip -Port <connection-port>" -ForegroundColor Gray
    exit 1
}
