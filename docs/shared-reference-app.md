# Shared reference application load profile

The separate `Shared reference app load` workflow runs a bounded k6 workload against the immutable `quality-reference-application` image digest in its own PostgreSQL instance. It does not change the existing Conduit load, regression baseline, or journey evidence.

The profile targets application commit `e9f438e06a2b092dccfc6e9ab1820ff2562ddad7`, GHCR digest `sha256:284ae3fa4f2a31a4322b74a6f37e38f0d101879389c656bf1d553df7ec616469`, and seed fixture `v0.1.0`. Readiness must report those source and fixture identities before the test starts. Change them only after the new app revision has passed its own build and the image digest is immutable and publicly pullable.

The default experiment schedules 20 iterations per second for 60 seconds, with at most 10 VUs. Each iteration makes one request: a deterministic 70% member-owned policy reads, 25% claim-list reads, and 5% synthetic claim creates with a fixed fictional amount. The 60-second measurement intends 1,200 iterations; the staggered mix permits at most 69 writes across 10 VUs. Session creation is setup traffic and is recorded separately by k6. The run checks HTTP status and response shape alongside latency, and fails on over 1% failed requests, any dropped iterations, contract success at or below 99%, policy/claim read p95 at or above 500 ms, or claim-write p95 at or above 750 ms. Intended rate and duration are recorded separately from observed k6 metrics; the summary reports completed iteration and request rates, so reviewers can distinguish target rate from achieved throughput.

Writes stay in the server-configured run namespace. The workflow creates a unique Compose project and namespace for each run and destroys the app, network, and PostgreSQL volume even after failure. The app is capped at 1 CPU and 512 MiB, PostgreSQL at 0.5 CPU and 512 MiB, and the generator is a GitHub-hosted Ubuntu runner. These are experiment limits, not a claim about application capacity or production infrastructure. The default local Compose target is loopback-only; the script rejects non-loopback hosts and bounds the maximum rate and VUs. Do not point this write workload at a shared or production environment.

Run locally with Docker, k6 2.0.0, Node 24.21.0, and npm 10.9.4:

```sh
export APP_IMAGE='ghcr.io/qa-test-automation-frameworks/quality-reference-application@sha256:284ae3fa4f2a31a4322b74a6f37e38f0d101879389c656bf1d553df7ec616469'
export TARGET_ID=quality-reference-application
export TARGET_COMMIT=e9f438e06a2b092dccfc6e9ab1820ff2562ddad7
export FIXTURE_VERSION=v0.1.0
export APP_NAMESPACE="k6-$(openssl rand -hex 8)"
export COMPOSE_PROJECT_NAME="k6-shared-$(openssl rand -hex 6)"
export APP_PORT=4300
export BASE_URL=http://127.0.0.1:4300
export POSTGRES_PASSWORD="$(openssl rand -hex 24)"
export TEST_CONTROL_TOKEN="$(openssl rand -hex 24)"
docker compose -f docker/shared-app.compose.yaml up -d db app
curl --fail http://127.0.0.1:4300/health/ready
npm run load:shared-app
docker compose -f docker/shared-app.compose.yaml down --volumes --remove-orphans
```

If the run is interrupted, remove only its unique Compose project and volume. Never reuse the namespace for a second experiment. The shared-target profile is intentionally a small read-dominated service profile; it is not the D04 saturation study, and no cross-run capacity conclusion should be drawn from one hosted-runner sample.
