# Workload units and measurement

The existing browsing journey uses **arrival iterations/second**. Depending on
fixture behavior it performs article-list, article-detail, comments, profile and
tag requests, and includes think time. A configured 20 iterations/s therefore
does not mean 20 HTTP requests/s. Client retries and redirects can further change
HTTP request counts.

## Migration and compatibility

- Replace `TARGET_RPS` with `TARGET_ITERATIONS_PER_SECOND` for the existing
  journey, retaining the old numeric value and its iteration semantics.
- `TARGET_RPS` is rejected even when another new rate variable is present.
- New summaries name `targetIterationsPerSecond` and `targetRequestsPerSecond`
  separately; journey request targets are null, not inferred from a multiplier.
- The legacy comparison adapter interprets historical `targetRps` only as journey
  iterations. Raw historical summaries/baselines remain unchanged. No historical
  request measurement is manufactured.
- `journey-arrival-v1`, historical `single-request-arrival-v1`, and current
  `single-request-arrival-v2` cannot be compared across schemas. Request
  profiles also require matching rate, VU limit, warm-up, measurement duration and
  minimum achieved fraction; v2 also requires the declared 2s completion drain.
  Missing identities fail instead of assuming defaults.
- Baseline aggregation derives workload identity from input runs and rejects
  mixed identities or explicitly failed/invalid experiments. Environment
  variables cannot relabel input rates. Further statistical/source-provenance
  hardening belongs to the separate regression-study work.

## Dedicated request-rate experiment

Use `npm run load:request-rate` or `npm run load:500rps` after starting the owned
local application. Configure `REQUESTS_PER_SECOND`, `MAX_VUS`, `WARMUP_SECONDS`,
`MEASUREMENT_SECONDS` and `MINIMUM_ACHIEVED_FRACTION` before running. Defaults are
500/s, 100 maximum VUs, 10s warm-up, 60s measurement and a 0.98 minimum fraction.

Each globally numbered scenario iteration performs exactly one direct HTTP GET:
four article-list requests followed by one tag-list request. No retry wrapper,
redirect following, sleep or setup HTTP request is used. Native HTTP/check metrics
are tagged by scenario. Warm-up is followed by a 2s settling gap before an
independently scheduled measurement scenario. Both scenarios allow a bounded 2s
completion drain after arrivals stop. The request timeout remains 1s. No new
arrivals are scheduled during the drain; requests started in the window can finish
and record metrics. A started-attempt counter must equal completed HTTP requests
and iterations, so interrupted requests cannot silently produce a valid summary.

Achieved rates are completed measurement iterations and HTTP requests divided by
the **configured measurement duration**, including drained completions belonging
to that arrival cohort. They are measurement-cohort rates, not
the native summary's entire-test denominator, which includes warm-up and the gap.
Native full-run values remain available as raw metrics. Counts, denominator,
dropped iterations, errors and latency objectives remain visible. Missing counts,
under-driving, dropped iterations, unexpected extra requests or a mismatch between
HTTP requests and completed iterations invalidate the experiment.

The threshold count floor and final `check-achieved-load.cjs` command both enforce
acceptance. A 98% minimum permits a small scheduling/boundary discrepancy; actual
achieved throughput is always reported, and the fraction is not changed after a
failed run. Do not claim application capacity from an invalid experiment or by
adding VUs without reporting the changed generator resources.

## Independently counted transport verification

```bash
npm run build
npm run verify:request-rate
```

Requires the pinned k6 runtime on PATH. This starts a disposable loopback HTTP
fixture and compares server-observed requests with native k6 metrics. It checks
the nominal 5,000-request cohort over 10s at 500 arrivals/s, a 50ms delayed
response boundary probe, an under-driven single-VU profile, a 503 response profile,
and requests exceeding the 1s HTTP timeout. k6 can admit one extra boundary arrival;
the verifier enforces nominal through nominal+1 (the existing native upper bound),
exact received/completed equality, and the exact mix for the actual cohort size.
It reports actual counts without substituting nominal values. The negative profiles must fail
the intended native threshold/check with exit99; timeout, startup failure or an
unrelated nonzero exit does not count as successful negative verification.

See [the drain repair proof](verification/2026-10-04-request-drain.md) for the
native zero-drain control, actual delayed-response results and compatibility checks.

Evidence is written to `reports/request-rate-verification/`: native JSON/Markdown/
HTML summaries, stdout/stderr and independently observed counts. CI uploads it
even when verification fails. This fixture proves executor/count semantics and
error handling only; it has no database or real business work. It does **not**
demonstrate RealWorld capacity, production scale or a statistically rigorous
baseline. The application performance study must still run separately with
pinned target/tool versions, resource limits and repeated raw measurements.

All sustained commands require a loopback local URL or explicit authorization for
an owned remote target; labeling a public URL `TARGET_ENV=local` does not authorize
load. Public demo services remain inappropriate for load experiments.
