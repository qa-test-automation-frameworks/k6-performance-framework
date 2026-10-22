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

The aggregate and source-run review rule are documented in
[`docs/baseline-provenance.md`](../baseline-provenance.md). A future report must
retain the three source summaries, target/framework SHAs, baseline compatibility
decision, and artifact-retention state; if those inputs expire, the evidence state
must become `evidence-unavailable` rather than silently reusing this snapshot.

## Workload

| Field | Value |
| --- | ---: |
| Profile | `full` |
| Workload | `load` |
| Target arrival iterations/s (historical `targetRps`) | `20` |
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

## Generated Report Statuses

The generated report site publishes `site/report-manifest.json` alongside its
HTML page. Each row uses the same disposition object in both artifacts. The
manifest records the source filename and SHA-256 so reviewers can identify the
exact summary that was classified.

| Status | Meaning |
| --- | --- |
| `PASS` | At least one native threshold was reported and passed, the producer explicitly emitted an empty `failures` array, the summary is structurally valid, and required achieved-load evidence is valid. |
| `FAIL` | A native threshold failed or the producer emitted a nonempty failure string. |
| `INVALID_LOAD` | The summary is structurally valid but its achieved-load evidence explicitly says the load experiment is invalid. |
| `INCOMPLETE` | Required evidence is absent, including empty native threshold maps, a missing `failures` array or workload schema, or missing achieved-load evidence for a request-rate workload. |
| `INVALID_INPUT` | The summary or a displayed metric is malformed, including non-boolean native threshold results and invalid JSON. |

`thresholdStatus` is `PASS`, `FAIL`, `INCOMPLETE`, or `INVALID_INPUT` and
describes the native threshold records only. `loadStatus` is `VALID`, `INVALID`,
`MISSING`, `NOT_APPLICABLE`, or `INVALID_INPUT`. A journey workload with an
explicit `achievedLoad: null` is `NOT_APPLICABLE`; request-rate workload schemas
`single-request-arrival-v1` and `single-request-arrival-v2` require a valid
achieved-load object. An older aggregate such as `baseline/load-summary.json`
does not contain per-run native thresholds, so it is visibly marked as a
historical aggregate and cannot receive `PASS` from this classifier. Its source
provenance is reviewed separately in [`baseline-provenance.md`](../baseline-provenance.md).

The report builder isolates parsing per file: invalid JSON appears as an
`INVALID_INPUT` row with a diagnostic, while other summaries remain available.
Summary text is escaped before it is placed in HTML. Displayed values are for
review only; the classifier trusts the summary's native threshold `ok` values
and does not recompute thresholds from rounded display metrics.
