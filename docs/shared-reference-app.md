# Shared reference application load profile

The separate `Shared reference app load` workflow builds the immutable public `quality-reference-application` source commit in its own job, then runs a bounded k6 workload against it with a disposable PostgreSQL instance. This keeps the target reproducible without relying on organization GHCR package visibility. It does not change the existing Conduit load, regression baseline, or journey evidence.

The profile targets application commit `21af1f41561a6d83ae44933dd36d9daa5e6a6e4c` and seed fixture `v0.1.0`. The workflow checks out that exact source SHA, verifies the checkout identity, builds it with the source SHA embedded in the image, and requires readiness to report the expected source and fixture before the workload starts. Update the pin only after the candidate app revision passes its own build and verification.

The default experiment schedules 20 iterations per second for 60 seconds, with at most 10 VUs. Each iteration makes one request: a deterministic 70% member-owned policy reads, 25% claim-list reads, and 5% synthetic claim creates with a fixed fictional amount. The 60-second measurement intends 1,200 iterations; the staggered mix permits at most 69 writes across 10 VUs. Session creation is setup traffic and is recorded separately by k6. The run checks HTTP status and response shape alongside latency, and fails on over 1% failed requests, any dropped iterations, contract success at or below 99%, policy/claim read p95 at or above 500 ms, or claim-write p95 at or above 750 ms. Intended rate and duration are recorded separately from observed k6 metrics; the summary reports completed iteration and request rates, so reviewers can distinguish target rate from achieved throughput.

Writes stay in the server-configured run namespace. The workflow creates a unique Compose project and namespace for each run and destroys the app, network, and PostgreSQL volume even after failure. The app is capped at 1 CPU and 512 MiB, PostgreSQL at 0.5 CPU and 512 MiB, and the generator is a GitHub-hosted Ubuntu runner. These are experiment limits, not a claim about application capacity or production infrastructure. The default local Compose target is loopback-only; the script rejects non-loopback hosts and bounds the maximum rate and VUs. Do not point this write workload at a shared or production environment.

Run locally with Docker, git, k6 2.0.0, Node 24.21.0, and npm 10.9.4:

```sh
export APP_IMAGE=quality-reference-application:portfolio-a04
export TARGET_ID=quality-reference-application
export TARGET_COMMIT=21af1f41561a6d83ae44933dd36d9daa5e6a6e4c
export FIXTURE_VERSION=v0.1.0
export APP_NAMESPACE="k6-$(openssl rand -hex 8)"
export COMPOSE_PROJECT_NAME="k6-shared-$(openssl rand -hex 6)"
export APP_PORT=4300
export BASE_URL=http://127.0.0.1:4300
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export TEST_CONTROL_TOKEN="$(openssl rand -hex 24)"
git clone https://github.com/qa-test-automation-frameworks/quality-reference-application.git .reference-app
git -C .reference-app checkout "$TARGET_COMMIT"
docker build --build-arg "APP_SOURCE_SHA=$TARGET_COMMIT" --tag "$APP_IMAGE" .reference-app
docker compose -f docker/shared-app.compose.yaml up -d db app
curl --fail http://127.0.0.1:4300/health/ready
npm run load:shared-app
docker compose -f docker/shared-app.compose.yaml down --volumes --remove-orphans
```

If the run is interrupted, remove only its unique Compose project and volume. Never reuse the namespace for a second experiment. The shared-target profile is intentionally a small read-dominated service profile; it is not the D04 saturation study, and no cross-run capacity conclusion should be drawn from one hosted-runner sample.
