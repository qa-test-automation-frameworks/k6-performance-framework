$ErrorActionPreference = 'Stop'
$started = Get-Date
docker compose -f docker/docker-compose.yml up -d --build
& "$PSScriptRoot/wait-observability.ps1"
$elapsed = (Get-Date) - $started
Write-Host "Observability ready in $([math]::Round($elapsed.TotalSeconds)) seconds: http://localhost:3001"
