# Changelog

## Unreleased

- Calibrated controlled read SLOs from retained endpoint measurements and expanded regression
  comparison to aggregate, endpoint, and business percentiles.
- Made release publication depend on strict full stress, spike, soak, and breakpoint evidence.
- Added retained-run trend comparison for advanced workloads.
- Unified observability credential overrides and validate them with non-default CI credentials.
- Enforced npm 10.9.4 setup and deterministic LF formatting for Windows `.mjs` tests.
- Expanded ownership coverage for release-critical documentation, scripts, and baselines.
- Enforced endpoint-group SLOs with explicit metric ownership and complete business signals.
- Added workload-specific journeys, deterministic setup-user pools, and non-local profile guards.
- Added baseline compatibility provenance, failure-preserving launchers, and richer reports.
- Expanded observability with endpoint dashboards, annotations, validation queries, and PNG capture.
- Added hosted segmented and advanced workload validation plus repeatable release publication.
- Pinned npm and container inputs and raised unit coverage gates.

## 0.4.0 - 2026-06-13

- Made functional checks and target authorization mandatory across sustained workloads.
- Made summaries failure-sensitive and restored mandatory measured regression comparison.
- Added automated observability validation, isolated dashboard queries, and traceable evidence.
- Added typed workload profiles, cross-platform launchers, and supported lint tooling.

## 0.3.0 - 2026-06-13

- Added persistent OTEL metric export through Prometheus and a provisioned Grafana datasource.
- Enforced measured-baseline comparisons in load and quality workflows.
- Centralized workload thresholds and expanded endpoint and business-metric reporting.
- Added cross-platform observability health checks and corrected k6 bundling configuration.
- Added distinct concurrent-reader behavior, API documentation, report charts, and soak dashboards.
- Expanded contributor guidance for authenticated scenarios and observability limitations.

## 0.2.0 - 2026-06-12

- Prepared the v0.2.0 evidence-focused release with measured-baseline workflows, executable endpoint
  SLOs, business metrics, executor diversity, strict configuration, and contributor guardrails.
- Added controlled PR smoke, main load, regression, scheduled soak, quality, security, and Pages workflows.
- Added aggregate JSON/Markdown summaries, baseline comparison, and static performance reports.
- Upgraded vulnerable development tooling and reached zero moderate-or-higher npm audit findings.
- Added CycloneDX SBOM generation, OSV scanning, CODEOWNERS, Dependabot, and a PR template.
- Completed architecture, onboarding, ADR index, release notes, and portfolio self-assessment docs.
- Added typed service objects for every RealWorld API endpoint group.
- Added SharedArray token distribution, checks, target guards, and generated fixtures.
- Added smoke, load, stress, spike, soak, breakpoint, and authenticated CRUD scenarios.
- Added JSON reporting commands and validation profiles for all six k6 test types.
- Added a Docker Compose observability stack with InfluxDB v2, Grafana, OTEL, and custom k6.
- Added auto-provisioned dashboards plus setup, health, and baseline scripts.
- Restored reproducible npm installs and aligned staging with the official RealWorld API.
- Added typed environment configuration for local, staging, and read-only production targets.
- Added smoke, load, stress, and soak threshold sets.
- Added the tagged, retry-aware HTTP client, structured logger, and custom k6 metrics.
- Added strict Conduit API and scenario contracts.
- Added deterministic unit coverage for configuration, HTTP behavior, retries, tags, and logging.
- Added ADR-003 for the observability stack.
- Corrected esbuild output so test directory paths are mirrored under `dist/`.

## Initial development - 2026-06-11

- Initialized Phase 0 repository scaffold.
- Added TypeScript, ESLint, Prettier, and esbuild bootstrap configuration.
- Added initial architecture decision records.
