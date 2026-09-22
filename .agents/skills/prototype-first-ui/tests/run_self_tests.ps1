param(
  [string]$Report = "",
  [string]$Python = "python"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$Arguments = @((Join-Path $ScriptDir "run_all.py"), "--python", $Python)
if ($Report) {
  $Arguments += @("--report", $Report)
}
$env:PYTHONDONTWRITEBYTECODE = "1"
& $Python @Arguments
if ($LASTEXITCODE -ne 0) { throw "Self-tests failed" }
