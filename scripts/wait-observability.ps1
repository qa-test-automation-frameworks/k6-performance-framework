$ErrorActionPreference = 'Stop'
$deadline = (Get-Date).AddMinutes(10)
do {
  try {
    Invoke-RestMethod http://localhost:8086/health | Out-Null
    Invoke-RestMethod http://localhost:3001/api/health | Out-Null
    Invoke-RestMethod http://localhost:13133/ | Out-Null
    Write-Host 'InfluxDB, Grafana, and OTEL Collector are healthy.'
    exit 0
  } catch {
    Start-Sleep -Seconds 5
  }
} while ((Get-Date) -lt $deadline)
throw 'Observability stack did not become healthy within 10 minutes.'
