#!/usr/bin/env bash
set -euo pipefail

deadline=$((SECONDS + 600))
until curl --fail --silent http://localhost:8086/health >/dev/null \
  && curl --fail --silent http://localhost:3001/api/health >/dev/null \
  && curl --fail --silent http://localhost:9090/-/healthy >/dev/null \
  && curl --fail --silent http://localhost:13133/ >/dev/null; do
  if (( SECONDS >= deadline )); then
    echo "Observability stack did not become healthy within 10 minutes." >&2
    exit 1
  fi
  sleep 5
done

echo "InfluxDB, Grafana, Prometheus, and OTEL Collector are healthy."
