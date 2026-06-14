# Visual Performance Evidence

Measured evidence must come from a seeded controlled target. The example panels below document the
expected review format and are intentionally labeled as examples. Release evidence is retained as
workflow artifacts rather than represented by these static illustrations.

## Reviewed Baseline

The committed load aggregate is a reviewed three-run measurement and retains aggregate, endpoint,
and business-metric percentiles plus target, profile, k6 version, and runner provenance.

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
4. Run `npm run observability:capture` to export the overview and endpoint dashboards.
5. Select the matching `environment` and `run_id` in Grafana for any additional review.
6. Retain the PNG, JSON, and Markdown artifacts and link the matching Actions run.

Only replace the example assets with captures whose source summaries and baseline metadata are
retained. The release workflow calls the full stress, spike, breakpoint, and soak jobs and does not
publish until all four complete successfully. Their JSON, Markdown, and HTML summaries are bundled
as `performance-evidence.tar.gz` on the release. Short validation profiles prove wiring only.
