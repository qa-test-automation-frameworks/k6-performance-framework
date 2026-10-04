# Performance Baseline

**Raw-source availability checked 2026-10-04:** the three named source summaries
are not retained in this repository or the named capture run's artifact API.
The aggregate below is historical; its hashes do not substitute for inspectable
raw runs or a verified variability estimate. A new capture belongs to the
controlled regression study and must be reviewed, not used to clear a red gate.

This directory stores a reviewed aggregate baseline produced from at least three full controlled
load runs. The previous baseline was invalidated after the controlled target gained deterministic
seed data and endpoint sample-presence gates.

The current baseline links its successful capture workflow, records hashes for all three source
summaries, and retains common aggregate, endpoint, and business metrics. The regression workflow
rejects missing, bootstrap, or single-sample baselines and compares every retained p95/p99 value.
Generate candidate summaries with the controlled local RealWorld target, aggregate them with
`scripts/aggregate-baseline.cjs`, and review the source summaries before committing
`baseline/load-summary.json`.
