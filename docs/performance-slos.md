# Performance Service-Level Objectives

The table below applies to the pinned controlled local target under the full load profile. The
hosted read-only smoke test uses wider network-facing guardrails because public-network latency is
not comparable with the GitHub-hosted controlled baseline.

| Endpoint group |       p95 |       p99 | Error rate |
| -------------- | --------: | --------: | ---------: |
| Authentication |  < 800 ms | < 1500 ms |       < 1% |
| Article reads  |   < 10 ms |   < 20 ms |       < 1% |
| Article writes | < 1000 ms | < 2000 ms |       < 2% |
| Comment reads  |    < 5 ms |   < 10 ms |       < 2% |
| Profiles       |    < 5 ms |   < 10 ms |       < 1% |
| Tags           |    < 5 ms |   < 10 ms |       < 1% |

## Realistic-Scale Read Path

The separate request-rate experiment configures 500 one-request arrivals/s:

```bash
npm run load:500rps
```

It is an 80/20 article-list/tag-list mix, with no client retries, redirects or think
time. The default is 10s warm-up, a 2s settling gap and a 60s measurement window.
Measurement-scoped objectives are p95 <80ms, p99 <150ms, error rate <1%, all status
checks passing, no dropped iterations and at least 98% of the configured arrival
count. The report exposes both configured and achieved rates. This is a distinct
workload from the multi-request journey; no comment/profile coverage is claimed.

The predeclared 98% fraction is an engineering counting tolerance, not a
statistical confidence interval. A valid measured 490/s result is reported as
490/s, never relabeled as achieved 500/s. See [units and measurement rules](workload-units.md).

Smoke tests abort quickly when checks, latency, or request failure thresholds breach. Load tests
enforce the primary p95 and p99 objectives; stress and breakpoint tests intentionally identify the
point at which these objectives degrade.

## Provenance And Ownership

These objectives are engineering guardrails for the pinned RealWorld target, not contractual
production SLAs. The Performance Engineering owner reviews them quarterly and whenever the target,
workload model, or hosting class changes. Controlled read objectives use approximately 3-10x
headroom over the three-run endpoint p95/p99 measurements retained in
`baseline/load-summary.json`. The wider authentication and write objectives are conservative safety
limits; they must not be described as baseline-calibrated until a three-run authenticated baseline
is retained.

The journey profile schedules eight minutes at the configured iteration-arrival rate after target startup
and deterministic seeding. Endpoint objectives assume the default local profile and bounded request
tags. Results from other environments require a separate reviewed baseline.

Relative regression comparison applies a 20% limit to every aggregate, endpoint, and business
latency percentile retained in the baseline. Absolute thresholds remain authoritative when a metric
has no compatible historical baseline.

## Error Budget

The aggregate load budget permits fewer than 2 failed requests per 100 requests. Endpoint groups
with a 1% objective permit fewer than 1 failure per 100 requests; write and comment groups permit
fewer than 2. Functional checks have no failure budget because a broken transaction invalidates its
latency result. A run that exhausts any error budget is rejected and cannot update the baseline.
