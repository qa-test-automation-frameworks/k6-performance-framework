$ErrorActionPreference = 'Stop'
$env:TEST_PROFILE = $env:TEST_PROFILE ?? 'validation'
$env:SUMMARY_NAME = $env:SUMMARY_NAME ?? 'load'
npm run load
Copy-Item reports/load-summary.json "baseline/load-$((Get-Date).ToString('yyyyMMdd-HHmmss'))-summary.json"
