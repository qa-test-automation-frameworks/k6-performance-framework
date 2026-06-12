#!/usr/bin/env bash
set -euo pipefail

grafana_url="${GRAFANA_URL:-http://localhost:3001}"
run_id="${K6_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
scenario="${K6_SCENARIO:-articles-load}"

annotate() {
  local text="$1"
  curl --fail --silent --show-error \
    -u "${GRAFANA_USER:-admin}:${GRAFANA_PASSWORD:-admin}" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"${text}\",\"tags\":[\"k6\",\"${scenario}\",\"${run_id}\"]}" \
    "${grafana_url}/api/annotations" >/dev/null
}

annotate "k6 start: ${scenario} (${run_id})"
trap 'status=$?; annotate "k6 end: '"${scenario}"' ('"${run_id}"') status='"${status}"'"; exit $status' EXIT

K6_RUN_ID="$run_id" docker compose -f docker/docker-compose.yml --profile test run --rm k6 \
  run --out xk6-influxdb=http://influxdb:8086 --out opentelemetry dist/load/articles-load.js
