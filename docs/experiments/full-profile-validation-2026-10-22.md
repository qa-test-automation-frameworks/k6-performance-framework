# Full-profile validation results — 22 October 2026

**Disposition:** the three-run healthy cohort is complete. Every run passed the unchanged native thresholds and authenticated validation. This is a descriptive variability study, not a production-capacity claim.

## Run identity and native results

The three separately dispatched samples used the frozen `full` profile, 20 iterations per second for eight minutes, k6 2.0.0, the same framework SHA `f5cba3a3b136c0376ca5099c1698a42ce4efb153`, and target SHA `c8c66858a436a6e07f445fffe2253a65ff6dcb58`. Each run built and seeded a fresh target with five articles. The supplemental merge-triggered run is not part of this cohort.

| Sample | Workflow run / total run window (UTC)                                                                                                 | Fresh seed      | Native load result | Iterations / requests | Failed requests / dropped / interrupted | Overall p95 / p99 (ms) | Auth validation                            |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------ | --------------------: | --------------------------------------: | ---------------------: | ------------------------------------------ |
| 1      | [39739132415](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/39739132415) · 07:14:55–07:23:09 | `39739132415-1` | PASS               |        9,599 / 32,245 |                               0 / 1 / 0 |        3.5997 / 4.1705 | PASS · 5 iterations, 35 requests, 0 failed |
| 2      | [39740373441](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/39740373441) · 07:25:54–07:34:08 | `39740373441-1` | PASS               |        9,599 / 32,245 |                               0 / 1 / 0 |        2.3675 / 2.7269 | PASS · 5 iterations, 35 requests, 0 failed |
| 3      | [39742063368](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/39742063368) · 07:40:21–07:48:35 | `39742063368-1` | PASS               |        9,600 / 32,250 |                               0 / 1 / 0 |        1.6951 / 1.8806 | PASS · 5 iterations, 35 requests, 0 failed |

All runs used the `ubuntu24-20261018.339.1` GitHub-hosted X64 image with an npm cache hit. Bun cache was not configured. The workload had 100 maximum VUs and no separate warmup. The full-profile checks passed at 100%; there were no producer failures or failed HTTP requests. One dropped iteration per run is below the unchanged limit of ten.

## Runner and target health

| Sample | CPU allocation / peak          |    Memory peak / limit (bytes) | Throttled seconds / max consecutive | Target probes / failures | Stop reason |
| ------ | ------------------------------ | -----------------------------: | ----------------------------------: | -----------------------: | ----------- |
| 1      | 4-core cgroup cpuset / 52.427% | 1,862,537,216 / 16,760,340,480 |                               0 / 0 |                   80 / 0 | None        |
| 2      | 4-core cgroup cpuset / 74.468% | 1,724,735,488 / 16,760,344,576 |                               0 / 0 |                   81 / 0 | None        |
| 3      | 4-core cgroup cpuset / 47.661% | 1,716,310,016 / 16,760,344,576 |                               0 / 0 |                   81 / 0 | None        |

Resource counters were observable for all three runs. Each had a 493-second monitoring window, no accumulated CPU-throttling time, no consecutive throttling, no target probe failures, and no stop condition. The CPU peak varied, but no run breached the protocol's stop rules.

## Required run-level percentiles and observed ranges

Values are milliseconds. The sample columns preserve each run's own percentile; range columns show `minimum / median / maximum` across the three runs. Requests were not pooled and no cross-run percentile was calculated.

| Metric                                                 |         p95 S1 / S2 / S3 |   p95 min / median / max |         p99 S1 / S2 / S3 |   p99 min / median / max |
| ------------------------------------------------------ | -----------------------: | -----------------------: | -----------------------: | -----------------------: |
| `http_req_duration`                                    | 3.5997 / 2.3675 / 1.6951 | 1.6951 / 2.3675 / 3.5997 | 4.1705 / 2.7269 / 1.8806 | 1.8806 / 2.7269 / 4.1705 |
| `http_req_duration{name:GET /articles}`                | 3.8945 / 2.5892 / 1.8171 | 1.8171 / 2.5892 / 3.8945 | 4.6855 / 2.9996 / 2.2756 | 2.2756 / 2.9996 / 4.6855 |
| `custom_tag_duration_ms`                               | 2.3977 / 1.3406 / 0.4325 | 0.4325 / 1.3406 / 2.3977 | 3.1141 / 1.8278 / 0.7496 | 0.7496 / 1.8278 / 3.1141 |
| `custom_comment_duration_ms`                           | 1.4902 / 0.9532 / 0.6336 | 0.6336 / 0.9532 / 1.4902 | 1.8739 / 1.2185 / 1.0397 | 1.0397 / 1.2185 / 1.8739 |
| `http_req_duration{name:GET /articles/:slug}`          | 3.5121 / 1.9708 / 0.8736 | 0.8736 / 1.9708 / 3.5121 | 4.4671 / 2.2954 / 1.3512 | 1.3512 / 2.2954 / 4.4671 |
| `http_req_duration{name:GET /profiles/:username}`      | 1.0536 / 0.7002 / 0.4901 | 0.4901 / 0.7002 / 1.0536 | 1.2498 / 0.8382 / 0.6172 | 0.6172 / 0.8382 / 1.2498 |
| `http_req_duration{name:GET /articles/:slug/comments}` | 1.4902 / 0.9532 / 0.6336 | 0.6336 / 0.9532 / 1.4902 | 1.8739 / 1.2185 / 1.0397 | 1.0397 / 1.2185 / 1.8739 |
| `http_req_duration{name:GET /tags}`                    | 2.3977 / 1.3406 / 0.4325 | 0.4325 / 1.3406 / 2.3977 | 3.1141 / 1.8278 / 0.7496 | 0.7496 / 1.8278 / 3.1141 |
| `custom_profile_duration_ms`                           | 1.0536 / 0.7002 / 0.4901 | 0.4901 / 0.7002 / 1.0536 | 1.2498 / 0.8382 / 0.6172 | 0.6172 / 0.8382 / 1.2498 |
| `custom_article_read_duration_ms`                      | 3.8255 / 2.5300 / 1.7791 | 1.7791 / 2.5300 / 3.8255 | 4.6447 / 2.8963 / 2.0306 | 2.0306 / 2.8963 / 4.6447 |

## Historical comparison and interpretation

The separate historical comparator flagged 20 of 20 p95/p99 rows in sample 1, with increases from 46.8% to 118.6%; two rows in sample 2 (the tag p99 metrics, both +28.3%); and no rows in sample 3. This does not change the native PASS result for any run. The historical aggregate's raw inputs are unavailable, so this comparison is descriptive and its cause remains undetermined.

The samples are compatible with the declared cohort: all three used the same workload, framework and target revisions, image, and resource-monitoring protocol, and all remained healthy with no stop event. The spread is still material: overall p95 ranges from 1.6951 to 3.5997 ms and overall p99 from 1.8806 to 4.1705 ms. With only three runs, these are descriptive min/median/max values, not confidence intervals or a stable capacity estimate. The cohort shows no native SLO failure; why the historical comparison changed across runs remains inconclusive. No degraded cohort was collected.

## Artifacts

| Sample |   Artifact ID | SHA-256                                                            |
| ------ | ------------: | ------------------------------------------------------------------ |
| 1      | `12408144501` | `32cf3fb16864637188a5124c2fa5b24a48e51c028c874891c84725f6d7210a47` |
| 2      | `12408784991` | `5a3b4fd4f8c15fff539a5f577fa1125d590526275fcbad731ad6008623e59a90` |
| 3      | `12409634010` | `d54612282d02ca77da375d9f636a506c31965b082641ef943cae53f971e087d3` |

Each artifact is attached to its linked workflow run. The downloaded archives, extracted summaries, runner logs, and cohort calculation are retained locally under `work/audit-2026-10-21/PERF-04/logs/`.
