# Engineering Notes

## Why Functional Correctness Gates Performance

Latency from a failed business transaction is not useful performance evidence. This framework
therefore enforces a perfect check rate for functional workloads and independently marks generated
summaries failed when check failures are present. Absolute SLOs and relative regression comparison
are additional gates, not substitutes for correctness.

## Why Baselines Are Reviewed Artifacts

A baseline is the median of at least three full runs against a pinned, seeded target. Metadata
records source hashes, framework and target commits, runner identity, k6 version, and workload
parameters. Main and regression workflows fail when that reviewed artifact is missing.

## Why Target Authorization Is Initialization-Time

Sustained traffic is rejected before VUs start unless it targets the controlled local service or an
explicitly approved non-local target. Distributed execution adds a protected GitHub environment and
host allowlist so URL syntax alone cannot authorize traffic.
