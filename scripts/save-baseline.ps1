$ErrorActionPreference = 'Stop'
$env:TEST_PROFILE = $env:TEST_PROFILE ?? 'validation'
npm run load
Copy-Item reports/load-results.json "baseline/load-$((Get-Date).ToString('yyyyMMdd-HHmmss')).json"
