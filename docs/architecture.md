# Architecture

## Boundaries

- `tests/` contains executable k6 entry points and workload options.
- `src/scenarios/` composes business journeys without transport details.
- `src/api/` owns RealWorld endpoint paths and typed request/response envelopes.
- `src/utils/http-client.ts` owns retries, environment tags, stable request names, and read-only
  production protection.
- `config/` owns environments, timeouts, traffic limits, and threshold sets.
- `docker/` provides local telemetry storage, routing, and visualization.

## Data Flow

1. A k6 entry point selects stages and thresholds.
2. The scenario invokes typed API services.
3. The HTTP client resolves the target, applies stable tags, and records the request.
4. k6 enforces thresholds and sends optional telemetry to InfluxDB and OpenTelemetry.
5. `handleSummary` writes aggregate JSON and Markdown artifacts.
6. CI compares aggregate latency metrics with the reviewed baseline and publishes evidence.

## Target Policy

The hosted RealWorld API is used only by the short read-only smoke workflow. Main load, regression,
and soak workflows provision the backend at pinned commit
`c8c66858a436a6e07f445fffe2253a65ff6dcb58`. Local write tests require tokens supplied through
`K6_USER_TOKENS`; no credentials are stored in the repository.

## Failure Model

- Functional failures are visible through k6 checks.
- SLO failures are enforced through thresholds.
- Relative regressions compare p95 and p99 with a 20% tolerance.
- Breakpoint runs abort when latency or error thresholds breach.
- CI always retains summaries and diagnostics for failed performance jobs.
