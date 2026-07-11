# Baseline Provenance and Review Decision

The published baseline is an aggregate, not a single run. A reviewer should trace
the report card to the three source summaries named in `baseline/load-summary.json`,
then verify the target SHA, framework SHA, runner/profile, workload, metric set,
aggregation rule, and compatibility decision. A baseline is approved only when the
three runs use the same target/profile and no safety or setup error invalidates the
comparison. If source artifacts expire, the card must say `evidence-unavailable`
until a new reviewed capture is committed.
