# Visual Performance Evidence

Measured evidence must come from a seeded controlled target. The example panels below document the
expected review format; they are intentionally labeled as examples and are not release evidence.

## Reviewed Baseline

The current aggregate baseline was produced by
[workflow run 27465074415](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/27465074415)
from three full seeded runs against target commit `c8c66858a436a6e07f445fffe2253a65ff6dcb58`.
All three runs passed checks and thresholds with zero request failures. The aggregate and source
hashes are retained in `baseline/load-summary.json`.

## Overview

![Example performance overview](images/performance-overview-example.svg)

The release overview should identify the run, target commit, framework commit, workload profile,
request rate, p95/p99 latency, error rate, dropped iterations, and threshold status.

## Soak Stability

![Example soak stability trend](images/soak-stability-example.svg)

The soak review should show latency and error-rate stability across the complete sustained period,
not only the final aggregate.

## Failed Threshold

![Example failed threshold report](images/threshold-failure-example.svg)

Failure evidence must show the metric, expected threshold, actual value, and breach magnitude.

## Capture Procedure

1. Start the controlled RealWorld target and seed at least five articles.
2. Run `npm run docker:up` and `npm run docker:health`.
3. Run `K6_RUN_ID=<commit-or-ticket> npm run load:observed`.
4. Select the matching `environment` and `run_id` in Grafana.
5. Capture the overview and soak dashboards with the run metadata visible.
6. Retain the JSON/Markdown summaries and link the matching Actions run.

Only replace the example assets with captures whose source summaries and baseline metadata are
retained.
