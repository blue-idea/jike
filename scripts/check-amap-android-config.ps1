param(
  [string]$DeviceId = "A3SRBB1A12006328",
  [string]$PackageName = "com.manbudezhu.jike"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[amap-check] $Message" -ForegroundColor Cyan
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path "artifacts/maestro" "amap-android-check-$timestamp"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

$summaryPath = Join-Path $runDir "summary.txt"
$manifestCheckPath = Join-Path $runDir "manifest-check.txt"
$dumpsysPath = Join-Path $runDir "dumpsys-package.txt"
$logcatPath = Join-Path $runDir "logcat-location.txt"

$defaultJavaHome = "D:\Program Files\Microsoft\jdk-17"
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  if (Test-Path (Join-Path $defaultJavaHome "bin\java.exe")) {
    $env:JAVA_HOME = $defaultJavaHome
  } else {
    throw "JAVA_HOME is invalid and fallback JDK is missing: $defaultJavaHome"
  }
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) { throw "adb not found in PATH" }
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) { throw "keytool not found in PATH" }

$adbState = (& adb -s $DeviceId get-state 2>$null).Trim()
if ($adbState -ne "device") {
  throw "Device $DeviceId is not ready (state: '$adbState')."
}

$keystorePath = Join-Path $repoRoot "android\app\debug.keystore"
if (-not (Test-Path $keystorePath)) {
  throw "Missing debug keystore: $keystorePath"
}

Write-Step "Collecting debug keystore SHA1..."
$quotedKeystore = '"' + $keystorePath + '"'
$keytoolCommand = "keytool -list -v -keystore $quotedKeystore -alias androiddebugkey -storepass android -keypass android 2>&1"
$shaOutput = cmd /c $keytoolCommand
if ($LASTEXITCODE -ne 0) {
  throw "keytool failed with exit code $LASTEXITCODE"
}
$shaLine = ($shaOutput | Select-String -Pattern "SHA1:" | Select-Object -First 1).ToString().Trim()

Write-Step "Checking AndroidManifest metadata..."
$manifestPath = Join-Path $repoRoot "android\app\src\main\AndroidManifest.xml"
$manifestLines = Select-String -Path $manifestPath -Pattern "com.amap.api.v2.apikey|expo.modules.gaodemap.AMapLocationService|com.amap.api.location.APSService" -CaseSensitive
$manifestLines | ForEach-Object { $_.Line } | Set-Content -Path $manifestCheckPath -Encoding utf8

Write-Step "Reading installed package info..."
& adb -s $DeviceId shell dumpsys package $PackageName > $dumpsysPath
$codePathLine = Select-String -Path $dumpsysPath -Pattern "codePath="
$versionLine = Select-String -Path $dumpsysPath -Pattern "versionName=|versionCode="

Write-Step "Launching app and collecting location diagnostics..."
& adb -s $DeviceId logcat -c
& adb -s $DeviceId shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 | Out-Null
Start-Sleep -Seconds 10
& adb -s $DeviceId logcat -d > $logcatPath
$diagLines = Select-String -Path $logcatPath -Pattern "gaode-native-key-missing|gaode-location-success|amap-ip-location-success|amap-regeo-success|Unable to load script"

@(
  "run_dir=$runDir",
  "device_id=$DeviceId",
  "package_name=$PackageName",
  "java_home=$env:JAVA_HOME",
  "keystore=$keystorePath",
  "sha1=$shaLine",
  "manifest_source=$manifestPath",
  "manifest_hits=$($manifestLines.Count)",
  "code_path=$($codePathLine.Line)",
  "version=$($versionLine | ForEach-Object { $_.Line } | Out-String)".Trim(),
  "diag_hits=$($diagLines.Count)"
) | Set-Content -Path $summaryPath -Encoding utf8

if ($diagLines) {
  Add-Content -Path $summaryPath -Value ""
  Add-Content -Path $summaryPath -Value "diag_lines:"
  $diagLines | ForEach-Object { Add-Content -Path $summaryPath -Value $_.Line }
}

Write-Step "Done. Artifacts: $runDir"
