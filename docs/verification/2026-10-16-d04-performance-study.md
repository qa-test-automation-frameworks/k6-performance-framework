# D04 — Reproducible k6 latency regression study

The D04 Performance Study workflow builds the pinned RealWorld API at commit
c8c66858a436a6e07f445fffe2253a65ff6dcb58, seeds five articles, and runs the
existing single-request arrival workload through a loopback-only proxy. Three
healthy samples and three interleaved samples with a fixed 125 ms response delay
use the same application, k6 version, runner, endpoint mix and workload identity.

Each sample requests 15 HTTP requests per second for a 15-second measurement
window after a 5-second warm-up, with a maximum of 30 VUs and the existing
two-second completion drain. The proxy only forwards GET /articles and
GET /tags, binds to loopback, accepts only a loopback HTTP upstream, and caps
the controlled delay at 500 ms. The degraded runs must return non-zero only for
the existing HTTP latency threshold; dropped work, invalid achieved load, HTTP
errors, failed checks, missing endpoint percentiles, or identity drift fail the
experiment.

The healthy aggregate is the median of three measured runs. The verifier
reconciles its source hashes with the raw summaries, reports per-run ranges,
median absolute and relative p95 changes, achieved request rates, dropped
iterations and observed runner resource context. It requires the minimum
degraded p95 to exceed the maximum healthy p95 by at least 75 ms. The n=3 ranges
are descriptive, not confidence intervals. The normal regression comparator
continues to reject failed candidates; this controlled negative experiment uses
its own verifier and does not weaken the release gate.

The target, proxy and generator run on one GitHub-hosted runner. The reported
latencies therefore include possible resource contention and cannot establish
standalone application capacity. The uploaded d04-performance-evidence
artifact is the source for actual run measurements; this document defines the
protocol and must not be treated as a report of successful execution until an
exact-head workflow run and artifact have been inspected.
