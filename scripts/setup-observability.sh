#!/usr/bin/env bash
set -euo pipefail
docker compose -f docker/docker-compose.yml up -d --build
until curl -fsS http://localhost:8086/health >/dev/null &&
      curl -fsS http://localhost:3001/api/health >/dev/null &&
      curl -fsS http://localhost:13133/ >/dev/null; do sleep 5; done
echo "Observability ready at http://localhost:3001"
