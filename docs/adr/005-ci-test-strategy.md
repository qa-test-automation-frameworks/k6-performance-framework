# ADR-005: Controlled Performance Testing in CI

## Status

Accepted

## Date

2026-06-12

## Context

Performance gates must be reproducible without placing sustained traffic on a public demonstration
service. Pull requests need fast feedback, while main, regression, and soak runs need stable targets.

## Decision

- Pull requests run a short, read-only smoke test against the hosted RealWorld API.
- Load, regression, and soak workflows start the RealWorld backend pinned to commit
  `c8c66858a436a6e07f445fffe2253a65ff6dcb58` on the GitHub runner.
- Regression checks compare p95 and p99 against a committed controlled baseline with a 20% tolerance,
  while absolute k6 thresholds remain authoritative.
- Workflows use least-privilege permissions, pinned action SHAs, aggregate summaries, and retained
  artifacts. The soak schedule never runs for pull requests.
- The scheduled soak cadence is weekly because it provisions the controlled target and runs a
  long-duration workload; nightly coverage would add cost without materially improving PR feedback.

## Consequences

CI setup takes longer because it provisions a backend, but performance evidence is isolated from
public-service noise and usage concerns. Baselines must identify target, runtime, date, and sample
count, and must only change with reviewed evidence.
