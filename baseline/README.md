# Performance Baseline

This directory stores a reviewed aggregate baseline produced from at least three full controlled
load runs.

The regression workflow rejects missing, bootstrap, or single-sample baselines. Generate candidate
summaries with the controlled local RealWorld target, aggregate them with
`scripts/aggregate-baseline.cjs`, and review the source summaries before committing
`baseline/load-summary.json`.
