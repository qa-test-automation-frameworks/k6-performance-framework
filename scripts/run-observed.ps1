$ErrorActionPreference = 'Stop'
$grafanaUrl = if ($env:GRAFANA_URL) { $env:GRAFANA_URL } else { 'http://localhost:3001' }
$runId = if ($env:K6_RUN_ID) { $env:K6_RUN_ID } else { (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ') }
$scenario = if ($env:K6_SCENARIO) { $env:K6_SCENARIO } else { 'articles-load' }
$script = if ($env:K6_SCRIPT) { $env:K6_SCRIPT } else { 'dist/load/articles-load.js' }
$grafanaUser = if ($env:GRAFANA_USER) { $env:GRAFANA_USER } else { 'admin' }
$grafanaPassword = if ($env:GRAFANA_PASSWORD) { $env:GRAFANA_PASSWORD } else { 'admin' }
$credentials = [Convert]::ToBase64String(
  [Text.Encoding]::ASCII.GetBytes("${grafanaUser}:${grafanaPassword}")
)

function Add-Annotation([string]$text) {
  if ($env:SKIP_ANNOTATIONS -eq 'true') { return }
  Invoke-RestMethod -Method Post -Uri "$grafanaUrl/api/annotations" `
    -Headers @{ Authorization = "Basic $credentials" } `
    -ContentType 'application/json' `
    -Body (@{ text = $text; tags = @('k6', $scenario, $runId) } | ConvertTo-Json)
}

Add-Annotation "k6 start: $scenario ($runId)"
$status = 1
try {
  $env:K6_RUN_ID = $runId
  docker compose -f docker/docker-compose.yml --profile test run --rm k6 `
    run --out influxdb=http://influxdb:8086 --out opentelemetry $script
  $status = $LASTEXITCODE
} finally {
  Add-Annotation "k6 end: $scenario ($runId) status=$status"
}
exit $status
