$ErrorActionPreference = 'Stop'
if (-not $env:TEST_PROFILE) { $env:TEST_PROFILE = 'validation' }
if (-not $env:SUMMARY_NAME) { $env:SUMMARY_NAME = 'load' }
if (-not $env:K6_RUN_ID) { $env:K6_RUN_ID = "local-$((Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ'))-$PID" }
npm run load
Copy-Item reports/load-summary.json "baseline/load-$((Get-Date).ToString('yyyyMMdd-HHmmss'))-summary.json"
