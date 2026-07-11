# Current Verification Record

| Field | Value |
|---|---|
| Repository ref | `main` (refresh after the next reviewed baseline or default-branch run) |
| Fast gate | `pr-smoke.yml` — read-only controlled smoke and threshold summary |
| Full evidence | `main-load.yml`, regression, soak, and scheduled workload workflows |
| Current state | `evidence-stale`; the committed baseline requires a new review record |
| Target/environment | Repository-controlled Conduit-compatible service; public targets remain read-only |
| Evidence class | Controlled load with governed safety checks |
| Report | [Performance reports](https://qa-test-automation-frameworks.github.io/k6-performance-framework/) |
| Known limitations | [Known issues](../known-issues.md) and [SLO interpretation](../performance-slos.md) |

The next record must link the displayed result to its three source runs, target and
framework SHAs, runner/profile, aggregation rule, baseline compatibility decision,
report URL, and retention period. Local controlled SLOs are not production SLOs.
