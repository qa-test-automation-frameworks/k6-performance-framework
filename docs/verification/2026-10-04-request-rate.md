# F04 — Workload-unit repair and real counting verification

Date: 2026-10-04. Runtime: Linux, Node 24.19.0, npm 10.9.4,
`k6 v2.0.0 (commit/8c3be52cc1, go1.26.3, linux/amd64)`.

The prior `TARGET_RPS` value drove k6 arrival iterations. The browse journey
made multiple requests, so its 500/s label was misleading. The repair preserves
the existing journey under `TARGET_ITERATIONS_PER_SECOND`, rejects the ambiguous
old environment variable, and introduces a separate direct one-request-per-arrival
entry point. Legacy raw baselines are retained and interpreted explicitly as
journey iterations; incompatible request profiles are rejected.

The new profile separates warm-up, a 2s gap and the scheduled measurement cohort.
It predeclares the achieved-load minimum, uses measurement-scoped native metrics,
and rejects missing counts, under-driving, dropped iterations or extra requests.
Functional failure remains failure even when the intended load was achieved.

## Executed validation

- `npm run build`: passed typecheck and generated k6 bundles.
- `npm run lint` and `npm run format:check`: passed.
- `npm run test:coverage`: **74 passed, one skipped**; statements 95.66%, branches
  93.99%, functions 95.90%, lines 96.54%. Existing configured coverage gates passed.
  No test was newly skipped to repair a failure.
- `npm run verify:request-rate`: all three expected outcomes passed against an
  independently counting loopback fixture. The runner's actual version and
  hashes of the tested sources are preserved in each observed record.

| Control | Configured measurement | Independently observed requests | Achieved requests/s | Dropped iterations | Native k6 exit | Interpretation |
|---|---|---:|---:|---:|---:|---|
| Healthy | 500/s for 10s | 5,000 (4,000 articles, 1,000 tags) | 500 | 0 | 0 | Valid counting experiment; functional gates pass |
| Under-driven | 20/s for 3s; one VU, 250ms responses | 10 | 3.333 | 50 | 99 | Invalid achieved-load experiment; intended drop/count gates fail |
| HTTP error | 20/s for 3s; 503 responses | 60 | 20 | 0 | 99 | Load achieved; functional/error gates correctly fail; no hidden retry amplification |

The harness rejects a timeout, startup failure or unrelated nonzero exit. Both
negative cases preserve native threshold diagnostics. [Raw summaries and independent
server counts](evidence/2026-10-04-request-rate/) include source hashes so an
uncommitted validation tree can be compared with the eventual committed files.

The local restricted test attempt could not capture child-process output for
existing comparator tests; the authorized child-process-capable run passed the
unchanged existing cases and new semantic regressions. No comparator was disabled.

## Limits and remaining work

The fixture is intentionally small and has no database/business work. This proves
executor/count behavior and failure classification; it does not prove RealWorld
capacity or production performance. The separate D04 study must measure the pinned
application with repeated raw runs, resource limits and uncertainty. F08 still
requires diagnosis of real historical-comparison failures.

Quality CI now runs this same counting harness and uploads results on failure.
Remote [Quality run 37181546564](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37181546564)
passed at PR head `70892896af889656cc382230f8b9fefab92d4c79`, including the native
counting step and Windows formatting. Its downloaded artifact records tested PR
merge revision `c2222109076e45af651a5d9fc574bbcc5fca49df`; these are different
provenance fields. All three remote source-hash maps match the committed counting
implementation. Remote counts were again 5,000 / 10 / 60 measurement requests and
native exits 0 / 99 / 99 for the respective controls.

PR smoke, segmented execution and performance-regression runs also passed at
this head. Security run 37181546549 failed `npm audit --audit-level=moderate` and
remains R02 work. Current main publication remains separate and unverified.
No latency baseline was renewed
or loosened to make this repair pass. Historical evidence keeps its original
numbers and now explains that `targetRps` referred to iteration arrival.
