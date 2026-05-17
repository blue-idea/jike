param(
  [string]$DeviceId = "A3SRBB1A12006328",
  [string]$Email = "manbudezhu@163.com",
  [string]$Password = "welcome44."
)

$ErrorActionPreference = "Stop"
$scriptPath = Join-Path $PSScriptRoot "run-location-debug-real.ps1"

if (-not (Test-Path $scriptPath)) {
  throw "Missing script: $scriptPath"
}

& $scriptPath -DeviceId $DeviceId -Email $Email -Password $Password -KeepMetroRunning
exit $LASTEXITCODE
