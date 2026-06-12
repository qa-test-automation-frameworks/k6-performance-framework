#!/usr/bin/env bash
set -euo pipefail

target_dir="${RUNNER_TEMP}/realworld-api"
git clone https://github.com/realworld-apps/nitro-prisma-zod-realworld-example-app.git "$target_dir"
git -C "$target_dir" checkout c8c66858a436a6e07f445fffe2253a65ff6dcb58
cd "$target_dir"
bun install --frozen-lockfile
JWT_SECRET=ci-only-performance-secret bun run db:generate
JWT_SECRET=ci-only-performance-secret bun run db:push
JWT_SECRET=ci-only-performance-secret nohup bun run dev >"${RUNNER_TEMP}/realworld-api.log" 2>&1 &

for attempt in {1..60}; do
  if curl --fail --silent http://127.0.0.1:3000/api/tags >/dev/null; then
    echo "RealWorld API is ready"
    exit 0
  fi
  sleep 2
done

cat "${RUNNER_TEMP}/realworld-api.log"
exit 1
