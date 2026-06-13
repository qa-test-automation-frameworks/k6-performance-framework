# Performance Service-Level Objectives

| Endpoint group |       p95 |       p99 | Error rate |
| -------------- | --------: | --------: | ---------: |
| Authentication |  < 800 ms | < 1500 ms |       < 1% |
| Article reads  |  < 500 ms | < 1000 ms |       < 1% |
| Article writes | < 1000 ms | < 2000 ms |       < 2% |
| Comments       |  < 750 ms | < 1500 ms |       < 2% |
| Profiles       |  < 500 ms | < 1000 ms |       < 1% |
| Tags           |  < 300 ms |  < 750 ms |       < 1% |

Smoke tests abort quickly when checks, latency, or request failure thresholds breach. Load tests
enforce the primary p95 and p99 objectives; stress and breakpoint tests intentionally identify the
point at which these objectives degrade.

## Provenance And Ownership

These objectives are engineering guardrails for the pinned RealWorld target, not contractual
production SLAs. The Performance Engineering owner reviews them quarterly and whenever the target,
workload model, or hosting class changes. The current values were selected from three full seeded
controlled runs, then rounded upward to preserve operating headroom while still detecting material
regression. Baseline source hashes, target commit, runner image, and workload parameters are stored
in `baseline/load-summary.json`.

The load measurement window is eight minutes at the configured arrival rate after target startup
and deterministic seeding. Endpoint objectives assume the default local profile and bounded request
tags. Results from other environments require a separate reviewed baseline.

## Error Budget

The aggregate load budget permits fewer than 2 failed requests per 100 requests. Endpoint groups
with a 1% objective permit fewer than 1 failure per 100 requests; write and comment groups permit
fewer than 2. Functional checks have no failure budget because a broken transaction invalidates its
latency result. A run that exhausts any error budget is rejected and cannot update the baseline.
