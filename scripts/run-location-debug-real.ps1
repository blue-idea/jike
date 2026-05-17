param(
  [string]$DeviceId = "A3SRBB1A12006328",
  [string]$Email = "manbudezhu@163.com",
  [string]$Password = "welcome44.",
  [string]$PackageName = "com.manbudezhu.jike",
  [switch]$KeepMetroRunning
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "[location-debug] $Message" -ForegroundColor Cyan
}

function Test-PortListening {
  param([int]$Port)
  $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  return $null -ne $conn
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path "artifacts/maestro" "location-real-device-debug-$timestamp"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

$metroLogPath = Join-Path $runDir "metro.log"
$startupLogPath = Join-Path $runDir "startup-logcat.txt"
$runtimeLogPath = Join-Path $runDir "runtime-logcat.txt"
$summaryPath = Join-Path $runDir "summary.txt"

$defaultJavaHome = "D:\Program Files\Microsoft\jdk-17"
if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  if (Test-Path (Join-Path $defaultJavaHome "bin\java.exe")) {
    $env:JAVA_HOME = $defaultJavaHome
  } else {
    throw "JAVA_HOME is invalid and fallback JDK is missing: $defaultJavaHome"
  }
}

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) { throw "adb not found in PATH" }
if (-not (Get-Command maestro -ErrorAction SilentlyContinue)) { throw "maestro not found in PATH" }
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { throw "npx not found in PATH" }

$adbState = (& adb -s $DeviceId get-state 2>$null).Trim()
if ($adbState -ne "device") {
  throw "Device $DeviceId is not ready (state: '$adbState')."
}

$apkPath = Join-Path $repoRoot "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apkPath)) {
  Write-Step "APK not found, building debug APK..."
  & .\android\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

$metroProcess = $null
$startedMetro = $false
$usingExistingMetro = Test-PortListening -Port 8081
if (-not $usingExistingMetro) {
  Write-Step "Starting Metro on port 8081..."
  $metroCommand = "& { Set-Location '$repoRoot'; `$env:CI='1'; npx expo start --dev-client --port 8081 *> '$metroLogPath' }"
  $metroProcess = Start-Process -FilePath "powershell" -ArgumentList @("-NoLogo", "-NoProfile", "-Command", $metroCommand) -WindowStyle Hidden -PassThru
  $startedMetro = $true

  $metroReady = $false
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 1
    if (Test-PortListening -Port 8081) {
      $metroReady = $true
      break
    }
  }
  if (-not $metroReady) {
    throw "Metro did not start on port 8081 within 60 seconds. Check $metroLogPath"
  }
} else {
  Write-Step "Port 8081 already in use, reusing existing Metro."
}

try {
  Write-Step "Installing debug APK..."
  & adb -s $DeviceId install -r $apkPath | Out-Null
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Step "Binding adb reverse tcp:8081..."
  & adb -s $DeviceId reverse tcp:8081 tcp:8081 | Out-Null
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Step "Cold start app and capture startup log..."
  & adb -s $DeviceId shell am force-stop $PackageName | Out-Null
  & adb -s $DeviceId logcat -c
  & adb -s $DeviceId shell monkey -p $PackageName -c android.intent.category.LAUNCHER 1 | Out-Null
  Start-Sleep -Seconds 8
  & adb -s $DeviceId logcat -d > $startupLogPath

  $bundleErrors = Select-String -Path $startupLogPath -Pattern "Unable to load script|No bundle URL present|Failed to connect to localhost/127.0.0.1:8081|Could not connect to development server" -SimpleMatch
  if ($bundleErrors) {
    throw "White-screen root cause persists: JS bundle failed to load. See $startupLogPath"
  }

  Write-Step "Running Maestro location flow..."
  $env:MAESTRO_TEST_EMAIL = $Email
  $env:MAESTRO_TEST_PASSWORD = $Password

  $maestroArgs = @(
    "test",
    "e2e/maestro/location.yaml",
    "--device", $DeviceId,
    "--debug-output", $runDir,
    "--format", "junit",
    "--output", (Join-Path $runDir "result.xml")
  )
  & maestro @maestroArgs
  $maestroExitCode = $LASTEXITCODE

  & adb -s $DeviceId logcat -d > $runtimeLogPath
  $diagKeywords = Select-String -Path $runtimeLogPath -Pattern "gaode-native-key-missing|gaode-location-success|amap-ip-location-success|Unable to load script|Could not connect to development server"
  $metroMode = if ($usingExistingMetro) { "reuse-existing" } else { "started-by-script" }
  $diagnosticHits = if ($null -eq $diagKeywords) { 0 } else { $diagKeywords.Count }

  @(
    "run_dir=$runDir",
    "device_id=$DeviceId",
    "package_name=$PackageName",
    "metro_mode=$metroMode",
    "keep_metro_running=$($KeepMetroRunning.IsPresent)",
    "maestro_exit_code=$maestroExitCode",
    "startup_log=$startupLogPath",
    "runtime_log=$runtimeLogPath",
    "diagnostic_hits=$diagnosticHits"
  ) | Set-Content -Path $summaryPath -Encoding utf8

  if ($diagKeywords) {
    Add-Content -Path $summaryPath -Value ""
    Add-Content -Path $summaryPath -Value "diagnostic_lines:"
    $diagKeywords | ForEach-Object { Add-Content -Path $summaryPath -Value $_.Line }
  }

  Write-Step "Done. Artifacts: $runDir"
  exit $maestroExitCode
}
finally {
  if ($startedMetro -and -not $KeepMetroRunning.IsPresent -and $null -ne $metroProcess -and -not $metroProcess.HasExited) {
    Write-Step "Stopping Metro process $($metroProcess.Id)..."
    Stop-Process -Id $metroProcess.Id -Force
  }
}
