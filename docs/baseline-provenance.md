# Baseline Provenance and Review Decision

The published baseline is an aggregate, not a single run. A reviewer should trace
the report card to the three source summaries named in `baseline/load-summary.json`,
then verify the target SHA, framework SHA, runner/profile, workload, metric set,
aggregation rule, and compatibility decision. A baseline is approved only when the
three runs use the same target/profile and no safety or setup error invalidates the
comparison. If source artifacts expire, the card must say `evidence-unavailable`
until a new reviewed capture is committed.

On 2026-10-04 the named capture run's GitHub artifact API returned zero artifacts,
and the three named raw source summaries were absent from the tracked repository.
The aggregate and hashes remain historical evidence; their raw inputs and
run-to-run variability are **evidence-unavailable in the inspected locations**.
No replacement baseline or inferred noise band was created. See
[the historical comparison diagnosis](verification/2026-10-04-history-comparison.md).

## Published Baseline Provenance

`baseline/provenance.json` records the aggregate's SHA-256 and its source-input
disposition. The current June aggregate is `historical-inputs-unavailable`:
three samples and their expected hashes were reported, but the source summaries
were not retained in the inspected repository or workflow artifacts. A digest
does not establish that its source file is still available, so the manifest does
not treat those hashes as revalidated inputs. The aggregate's original
`generatedAt` value and measured values remain unchanged.

The report site classifies the aggregate in a separate historical section. It
shows the recorded date, sample count, target and framework revisions, workload
schema (or that the old aggregate did not record one), limitations, and this
explanation. It is not a current run and is excluded from the current latency
trend chart and current-run statuses.

A future `reproducible-measured` disposition must include each retained source
path and SHA-256. Source paths must resolve inside `baseline/`. The report builder
verifies the files, hashes, source count, aggregate identity, workload, and this
explanation path. A missing file, digest mismatch, unsupported schema version,
or absent explanation makes the provenance `PROVENANCE_INVALID`; hashes alone
never upgrade the historical record.
