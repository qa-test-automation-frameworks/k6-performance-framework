# Changelog

## Unreleased

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

## 0.1.0 - 2026-06-09

- Initialized Phase 0 repository scaffold.
- Added TypeScript, ESLint, Prettier, and esbuild bootstrap configuration.
- Added roadmap and initial architecture decision records.
