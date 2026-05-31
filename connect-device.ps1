# connect-device.ps1
# Automatically detects and connects your wireless Android device via ADB.
# Usage: .\connect-device.ps1
#        .\connect-device.ps1 -Ip "192.168.1.100" -Port 39085

param(
    [string]$Ip,
    [int]$Port = 39085
)

$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

if (-not (Test-Path $ADB)) {
    Write-Host "[ERROR] adb.exe not found at: $ADB" -ForegroundColor Red
    Write-Host "        Make sure Android SDK platform-tools are installed." -ForegroundColor Yellow
    exit 1
}

Write-Host "[INFO] Checking for connected devices..." -ForegroundColor Cyan

# Check if device is already connected
$devices = & $ADB devices 2>&1 | Select-String -Pattern "device$"

if ($devices) {
    Write-Host "[OK] Device already connected:" -ForegroundColor Green
    & $ADB devices -l | Select-String -Pattern "device\s" | ForEach-Object { Write-Host "     $_" -ForegroundColor White }
    Write-Host ""
    Write-Host "[OK] Ready to run: flutter run -d android" -ForegroundColor Green
    exit 0
}

# If no IP provided, fall back to last-known paired device
if (-not $Ip) {
    Write-Host "[INFO] No device connected. Using last-known IP..." -ForegroundColor Yellow
    $Ip = "192.168.1.198"
    Write-Host "       Trying: $Ip" -ForegroundColor Gray
}

$target = "${Ip}:${Port}"
Write-Host "[INFO] Connecting to $target ..." -ForegroundColor Cyan

$result = & $ADB connect $target 2>&1

if ($result -match "connected to") {
    Write-Host "[OK] Connected to $target" -ForegroundColor Green
    & $ADB devices -l | Select-String -Pattern "device\s" | ForEach-Object { Write-Host "     $_" -ForegroundColor White }
    Write-Host ""
    Write-Host "[OK] Ready to run: flutter run -d android" -ForegroundColor Green
} elseif ($result -match "already connected") {
    Write-Host "[OK] Already connected to $target" -ForegroundColor Green
    Write-Host "[OK] Ready to run: flutter run -d android" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to connect: $result" -ForegroundColor Red
    Write-Host ""
    Write-Host "[TIPS] Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Make sure Wireless Debugging is ON in Developer Options" -ForegroundColor Gray
    Write-Host "   2. Check that your phone and PC are on the same WiFi network" -ForegroundColor Gray
    Write-Host "   3. Try re-pairing: adb pair <ip>:<pairing-port>" -ForegroundColor Gray
    Write-Host "   4. Specify IP manually: .\connect-device.ps1 -Ip 192.168.x.x" -ForegroundColor Gray
    exit 1
}
