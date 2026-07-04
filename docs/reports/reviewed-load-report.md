# Reviewed Load Report

This report summarizes the committed three-run reviewed baseline in
[`baseline/load-summary.json`](../../baseline/load-summary.json). It is intended
as a human-openable evidence artifact; generated run outputs remain ignored
under `reports/`.

## Run Provenance

| Field | Value |
| --- | --- |
| Generated | `2026-06-14T07:07:46.553Z` |
| Status | `measured` |
| Sample count | `3` |
| Target | `realworld-local` |
| Target commit | `c8c66858a436a6e07f445fffe2253a65ff6dcb58` |
| Framework commit | `d9d8295beadbd1ba7085a3bddd902cbb31f2fc58` |
| k6 version | `2.0.0` |
| Runner | `ubuntu24-20260607.184.1` (`github-hosted`) |
| Workflow run | <https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/27474987004> |

## Workload

| Field | Value |
| --- | ---: |
| Profile | `full` |
| Workload | `load` |
| Target RPS | `20` |
| Max VUs | `100` |
| Iterations | `9,599` |
| Iteration rate | `19.96/s` |
| HTTP requests | `32,245` |
| HTTP request rate | `67.04/s` |
| Dropped iterations | `1` |

## Aggregate Results

| Metric | Value |
| --- | ---: |
| HTTP duration p95 | `2.44 ms` |
| HTTP duration p99 | `2.73 ms` |
| HTTP failure rate | `0%` |
| Article read success rate | `100%` |
| Comment success rate | `100%` |
| Profile success rate | `100%` |
| Tag success rate | `100%` |

## Endpoint Percentiles

| Endpoint | p95 | p99 | Failure rate |
| --- | ---: | ---: | ---: |
| `GET /articles` | `2.65 ms` | `2.88 ms` | `0%` |
| `GET /articles/:slug` | `1.92 ms` | `2.10 ms` | `0%` |
| `GET /articles/:slug/comments` | `0.86 ms` | `1.04 ms` | `0%` |
| `GET /profiles/:username` | `0.66 ms` | `0.72 ms` | `0%` |
| `GET /tags` | `1.31 ms` | `1.42 ms` | `0%` |

## Scope Note

These numbers describe a controlled local API path and are used to detect
regressions against the reviewed baseline. They are not production service
objectives, capacity claims, or internet-facing latency guarantees.

