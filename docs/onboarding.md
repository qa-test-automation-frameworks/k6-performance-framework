# Contributor Onboarding

## Workstation

Install Node.js 20+, npm, k6 2.0+, Docker Desktop, and Git. Then run:

```bash
npm ci
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run hooks:install
```

## Local Observability

```bash
npm run docker:up
npm run docker:health
```

Grafana: `http://localhost:3001`  
InfluxDB: `http://localhost:8086`  
Prometheus: `http://localhost:9090`
OTLP gRPC/HTTP: `localhost:4317` / `localhost:4318`

Use `npm run docker:down` when finished. The command removes local observability volumes.
Observed runs add Grafana start/end annotations and bounded run tags through
`npm run load:observed`.

The OTEL output is an experimental k6 metrics path and does not guarantee parity with every
standard k6 metric. The InfluxDB output remains the complete dashboard source; Prometheus exposes
the OTLP metric subset for collector and exporter validation.

## Segmented Execution

The `Distributed controlled load` workflow partitions an authorized target across two self-hosted
runners labeled `performance`. It is manual-only and requires an explicit controlled target URL.
Increase the execution-segment matrix only after confirming runner capacity and target authorization.

## Add a Scenario

1. Add endpoint behavior to a typed service when required.
2. Compose the business journey under `src/scenarios/`.
3. Add a k6 entry point under the relevant `tests/` workload directory.
4. Export `handleSummary = createSummary`.
5. Apply stable endpoint names and appropriate thresholds.
6. Add unit tests for parsing, helpers, and service calls.
7. Validate with `TEST_PROFILE=validation` before running full duration.

## Credentials and Targets

Provide tokens only through `K6_USER_TOKENS`. Do not commit `.env` files or generated reports.
Write and high-volume scenarios run locally by default. Set `ALLOW_NON_LOCAL_LOAD=true` only after
confirming authorization and capacity for the selected environment.

### Obtain an Authentication Token

Register a disposable user against the pinned local backend:

```bash
curl -sS -X POST http://localhost:3000/api/users \
  -H 'Content-Type: application/json' \
  -d '{"user":{"username":"perf-user","email":"perf-user@example.test","password":"change-me"}}'
```

Read the `user.token` value from the response and provide it as a JSON array:

```bash
export K6_USER_TOKENS='["your-jwt-token"]'
npm run load:journey
```

## Troubleshooting

- Missing `docker_engine`: launch Docker Desktop and wait for the Linux engine.
- Missing summaries: set `SUMMARY_NAME` and ensure `reports/` is writable.
- Authentication failure: verify the token array is valid JSON and tokens match the target.
- Regression failure: inspect both summaries before proposing a baseline change.
