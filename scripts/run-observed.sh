#!/usr/bin/env bash
set -euo pipefail

grafana_url="${GRAFANA_URL:-http://localhost:3001}"
run_id="${K6_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)}"
scenario="${K6_SCENARIO:-articles-load}"
script="${K6_SCRIPT:-dist/load/articles-load.js}"

annotate() {
  if [[ "${SKIP_ANNOTATIONS:-false}" == "true" ]]; then return; fi
  local text="$1"
  curl --fail --silent --show-error \
    -u "${GRAFANA_USER:-admin}:${GRAFANA_PASSWORD:-admin}" \
    -H "Content-Type: application/json" \
    -d "{\"text\":\"${text}\",\"tags\":[\"k6\",\"${scenario}\",\"${run_id}\"]}" \
    "${grafana_url}/api/annotations" >/dev/null
}

finish() {
  local status=$?
  trap - EXIT
  annotate "k6 end: ${scenario} (${run_id}) status=${status}"
  exit "$status"
}

annotate "k6 start: ${scenario} (${run_id})"
trap finish EXIT

K6_RUN_ID="$run_id" docker compose -f docker/docker-compose.yml --profile test run --rm k6 \
  run --out influxdb=http://influxdb:8086 --out opentelemetry "$script"
