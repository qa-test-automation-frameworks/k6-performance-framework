#!/usr/bin/env bash
set -euo pipefail

target_dir="${RUNNER_TEMP}/realworld-api"
caller_dir="$PWD"
git clone https://github.com/realworld-apps/nitro-prisma-zod-realworld-example-app.git "$target_dir"
git -C "$target_dir" checkout c8c66858a436a6e07f445fffe2253a65ff6dcb58
cd "$target_dir"
bun install --frozen-lockfile
JWT_SECRET=ci-only-performance-secret bun run db:generate
JWT_SECRET=ci-only-performance-secret bun run db:push
env -u RUNNER_TRACKING_ID JWT_SECRET=ci-only-performance-secret NITRO_PORT=3000 \
  nohup bun run dev >"${RUNNER_TEMP}/realworld-api.log" 2>&1 &
server_pid=$!
ready=false

for attempt in {1..90}; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    echo "RealWorld API exited before becoming ready"
    cat "${RUNNER_TEMP}/realworld-api.log"
    exit 1
  fi
  if curl --fail --silent --max-time 2 "http://localhost:3000/api/articles?limit=1" >/dev/null; then
    echo "RealWorld API is ready"
    ready=true
    break
  fi
  sleep 2
done

if [ "$ready" != true ]; then
  cat "${RUNNER_TEMP}/realworld-api.log"
  return 1 2>/dev/null || exit 1
fi

cd "$caller_dir"
