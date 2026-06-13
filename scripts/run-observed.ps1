$ErrorActionPreference = 'Stop'
$grafanaUrl = $env:GRAFANA_URL ?? 'http://localhost:3001'
$runId = $env:K6_RUN_ID ?? (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssZ')
$scenario = $env:K6_SCENARIO ?? 'articles-load'
$credentials = [Convert]::ToBase64String(
  [Text.Encoding]::ASCII.GetBytes("$($env:GRAFANA_USER ?? 'admin'):$($env:GRAFANA_PASSWORD ?? 'admin')")
)

function Add-Annotation([string]$text) {
  Invoke-RestMethod -Method Post -Uri "$grafanaUrl/api/annotations" `
    -Headers @{ Authorization = "Basic $credentials" } `
    -ContentType 'application/json' `
    -Body (@{ text = $text; tags = @('k6', $scenario, $runId) } | ConvertTo-Json)
}

Add-Annotation "k6 start: $scenario ($runId)"
try {
  $env:K6_RUN_ID = $runId
  docker compose -f docker/docker-compose.yml --profile test run --rm k6 `
    run --out xk6-influxdb=http://influxdb:8086 --out opentelemetry dist/load/articles-load.js
} finally {
  Add-Annotation "k6 end: $scenario ($runId) status=$LASTEXITCODE"
}
