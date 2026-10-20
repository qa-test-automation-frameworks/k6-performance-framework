# Verification Status and Historical Results

## Latest main-load run observed — 2026-10-17

At the time of this review, the latest successful default-branch full-profile
load run was
[`38938737816`](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/38938737816)
on `main` at `569db4d557d104bea314588aa63fca3ce4f1c29b`; it completed
successfully on 2026-10-16. For a newer run, inspect the
[live evidence dashboard](https://qa-test-automation-frameworks.github.io/.github/)
and follow the k6 source-run link.

The detailed counts below are from the retained July run, not run `38938737816`.
They are kept as historical context and are not a current workload result.

## Historical run — 2026-07-11

This retained July result is historical. The original `targetRps: 20` means
20 journey arrival iterations/s; the journey issues multiple HTTP requests.
It does not prove a 20-request/s or 500-request/s workload. See
[workload-unit correction](../workload-units.md) for current semantics.

| Field | Value |
|---|---|
| Repository ref | `main` @ [`29a5ed9`](https://github.com/qa-test-automation-frameworks/k6-performance-framework/commit/29a5ed9f24ca6bfdf5222d4193e72130a814fe4a) |
| Full evidence gate | [`main-load.yml` run 29137781908](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/29137781908) — full-profile load run; completed 2026-07-11T03:26:58Z |
| Read-only smoke | `pr-smoke.yml` — controlled smoke and threshold summary on pull requests |
| Record status | Historical; superseded by later main-branch load runs |
| Target/environment | Repository-controlled Conduit-compatible service; public targets remain read-only |
| Evidence class | Controlled load with governed safety checks |
| Result counts | 32,250 total requests, 0% `http_req_failed` rate, 481.0s run duration, max 100 VUs, 20 target arrival iterations/s |
| Report | [Performance reports](https://qa-test-automation-frameworks.github.io/k6-performance-framework/) |
| Known limitations | [Known issues](../known-issues.md) and [SLO interpretation](../performance-slos.md) |

The machine-readable record with the exact SHA, run ID/URL, conclusion, and result
counts is retained at [`historical-verification.json`](historical-verification.json). Local
controlled SLOs are not production SLOs.
