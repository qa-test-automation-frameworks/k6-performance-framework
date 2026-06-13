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
JWT_SECRET=ci-only-performance-secret bun run build
env -u RUNNER_TRACKING_ID JWT_SECRET=ci-only-performance-secret HOST=127.0.0.1 PORT=3000 \
  bun .output/server/index.mjs >"${RUNNER_TEMP}/realworld-api.log" 2>&1 &
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

seed_suffix="${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}"
seed_user="perf-seed-${seed_suffix}"
seed_email="${seed_user}@example.test"
seed_password="ci-performance-seed"
registration_response="$(
  curl --fail --silent --show-error \
    -X POST "http://localhost:3000/api/users" \
    -H 'Content-Type: application/json' \
    -d "{\"user\":{\"username\":\"${seed_user}\",\"email\":\"${seed_email}\",\"password\":\"${seed_password}\"}}"
)"
seed_token="$(
  REGISTRATION_RESPONSE="$registration_response" node -e '
    const response = JSON.parse(process.env.REGISTRATION_RESPONSE);
    if (!response.user?.token) throw new Error("Seed user registration returned no token");
    process.stdout.write(response.user.token);
  '
)"

for article_number in 1 2 3 4 5; do
  curl --fail --silent --show-error \
    -X POST "http://localhost:3000/api/articles" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Token ${seed_token}" \
    -d "{\"article\":{\"title\":\"Performance seed ${seed_suffix}-${article_number}\",\"description\":\"Deterministic CI performance fixture\",\"body\":\"Seeded article body ${article_number}\",\"tagList\":[\"performance\",\"seed\"]}}" \
    >/dev/null
done

seeded_count="$(
  curl --fail --silent --show-error "http://localhost:3000/api/articles?limit=5" |
    node -e '
      let input = "";
      process.stdin.on("data", (chunk) => input += chunk);
      process.stdin.on("end", () => {
        const response = JSON.parse(input);
        process.stdout.write(String(response.articles?.length ?? 0));
      });
    '
)"
if [ "$seeded_count" -lt 5 ]; then
  echo "RealWorld API seed validation failed: expected at least 5 articles, found ${seeded_count}" >&2
  exit 1
fi
echo "Seeded ${seeded_count} articles for performance scenarios"

cd "$caller_dir"
