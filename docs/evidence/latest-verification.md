# Current Verification Record

| Field | Value |
|---|---|
| Repository ref | `main` @ [`29a5ed9`](https://github.com/qa-test-automation-frameworks/k6-performance-framework/commit/29a5ed9f24ca6bfdf5222d4193e72130a814fe4a) |
| Full evidence gate | [`main-load.yml` run 29137781908](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/29137781908) — full-profile load run; completed 2026-07-11T03:26:58Z |
| Read-only smoke | `pr-smoke.yml` — controlled smoke and threshold summary on pull requests |
| Current state | `review-ready`; refresh after the next reviewed baseline or default-branch run |
| Target/environment | Repository-controlled Conduit-compatible service; public targets remain read-only |
| Evidence class | Controlled load with governed safety checks |
| Result counts | 32,250 total requests, 0% `http_req_failed` rate, 481.0s run duration, max 100 VUs, 20 target RPS |
| Report | [Performance reports](https://qa-test-automation-frameworks.github.io/k6-performance-framework/) |
| Known limitations | [Known issues](../known-issues.md) and [SLO interpretation](../performance-slos.md) |

The machine-readable record with the exact SHA, run ID/URL, conclusion, and result
counts is published at [`latest-verification.json`](latest-verification.json). Local
controlled SLOs are not production SLOs.
