<#
.SYNOPSIS
    Build and distribute the Unmissed APK via Firebase App Distribution.

.DESCRIPTION
    Builds a release APK with Flutter, optionally bumps the version,
    and uploads it to Firebase App Distribution.

.PARAMETER ReleaseNotes
    Optional release notes string attached to the distribution.

.PARAMETER SkipBump
    If set, skips the automatic build-number increment.

.PARAMETER DryRun
    If set, builds the APK but does not upload it.

.EXAMPLE
    .\distribute.ps1
    .\distribute.ps1 -ReleaseNotes "Fixed notification sounds"
    .\distribute.ps1 -SkipBump -DryRun
#>
[CmdletBinding()]
param(
    [string]$ReleaseNotes = "",
    [switch]$SkipBump,
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$AppDir = Join-Path $PSScriptRoot "app"
$Pubspec = Join-Path $AppDir "pubspec.yaml"
$AppId = "1:710716776452:android:0e5337493438eff1471551"
$Project = "unmissed-project"
$Testers = "natanaelvf@gmail.com, natasnaelferreira@gmail.com, Teppoauvinen844@gmail.com"
$ServiceAccount = Join-Path $AppDir "android\unmissed-project-firebase-adminsdk.json"

# -- Helpers ----------------------------------------------------------
function Write-Step($msg) { Write-Host "`n[>] $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Err($msg) { Write-Host "  [ERROR] $msg" -ForegroundColor Red; exit 1 }

# -- Pre-flight checks -----------------------------------------------
Write-Step "Pre-flight checks"

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) { Write-Err "flutter not found in PATH" }
if (-not (Get-Command firebase -ErrorAction SilentlyContinue)) { Write-Err "firebase CLI not found in PATH" }
if (-not (Test-Path $Pubspec)) { Write-Err "pubspec.yaml not found at $Pubspec" }
if (-not (Test-Path $ServiceAccount)) { Write-Err "Service account JSON not found at $ServiceAccount" }

Write-Ok "All tools and files present"

# -- Version bump -----------------------------------------------------
$content = Get-Content $Pubspec -Raw
if ($content -match 'version:\s*(\d+\.\d+\.\d+)\+(\d+)') {
    $semver = $Matches[1]
    $buildNum = [int]$Matches[2]
}
elseif ($content -match 'version:\s*(\d+\.\d+\.\d+)') {
    $semver = $Matches[1]
    $buildNum = 0
}
else {
    Write-Err "Could not parse version from pubspec.yaml"
}

if (-not $SkipBump) {
    Write-Step "Bumping build number"
    $newBuild = $buildNum + 1
    $oldVersion = $(if ($buildNum -gt 0) { "$semver+$buildNum" } else { $semver })
    $newVersion = "$semver+$newBuild"
    $content = $content -replace "version:\s*$([regex]::Escape($oldVersion))", "version: $newVersion"
    Set-Content -Path $Pubspec -Value $content -NoNewline
    Write-Ok "$oldVersion -> $newVersion"
}
else {
    $newVersion = $(if ($buildNum -gt 0) { "$semver+$buildNum" } else { $semver })
    Write-Step "Skipping bump - staying at $newVersion"
}

# -- Build release APK ------------------------------------------------
Write-Step "Building release APK (ENV=prod)"
Push-Location $AppDir
try {
    flutter build apk --release --dart-define=ENV=prod
    if ($LASTEXITCODE -ne 0) { Write-Err "flutter build failed" }
}
finally {
    Pop-Location
}

$ApkPath = Join-Path $AppDir "build\app\outputs\flutter-apk\app-release.apk"
if (-not (Test-Path $ApkPath)) { Write-Err "APK not found at $ApkPath" }

$apkSize = [math]::Round((Get-Item $ApkPath).Length / 1MB, 1)
Write-Ok "APK built: $ApkPath (${apkSize} MB)"

# -- Upload -----------------------------------------------------------
if ($DryRun) {
    Write-Step "DRY RUN - skipping upload"
    Write-Ok "APK ready at $ApkPath"
}
else {
    Write-Step "Uploading to Firebase App Distribution"

    # Authenticate via service account
    $env:GOOGLE_APPLICATION_CREDENTIALS = $ServiceAccount

    $uploadArgs = @(
        "appdistribution:distribute", $ApkPath,
        "--project", $Project,
        "--app", $AppId,
        "--testers", $Testers
    )

    if ($ReleaseNotes) {
        $uploadArgs += "--release-notes"
        $uploadArgs += $ReleaseNotes
    }

    firebase @uploadArgs
    if ($LASTEXITCODE -ne 0) { Write-Err "Firebase upload failed" }

    Write-Ok "Uploaded successfully"
}

# -- Summary ----------------------------------------------------------
Write-Host ""
Write-Host "+-----------------------------------------+" -ForegroundColor DarkGray
Write-Host "|  Distribution Summary                   |" -ForegroundColor DarkGray
Write-Host "+-----------------------------------------+" -ForegroundColor DarkGray
Write-Host "|  Version:  $newVersion" -ForegroundColor White
Write-Host "|  APK:      ${apkSize} MB" -ForegroundColor White
Write-Host "|  Testers:  $Testers" -ForegroundColor White
if ($DryRun) {
    Write-Host "|  Status:   DRY RUN (not uploaded)" -ForegroundColor Yellow
}
else {
    Write-Host "|  Status:   [OK] Uploaded" -ForegroundColor Green
}
Write-Host "+-----------------------------------------+" -ForegroundColor DarkGray
Write-Host ""
