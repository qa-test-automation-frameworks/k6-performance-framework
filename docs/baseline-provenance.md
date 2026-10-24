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


## Calibration workflow

`Noise calibration` supersedes the removed `Capture performance baseline` workflow.
It runs each full-profile sample on a separate hosted runner through an explicitly
enabled loopback proxy. A/A requires at least five zero-delay samples; the degraded
arm requires at least three samples and a positive delay. Both use
`TARGET_ID=realworld-local-proxied`, as does the regression candidate.

The aggregate artifact contains original summaries, SHA-256 digests, measured
median aggregate, per-metric tolerance derivation, schema-v2 provenance and run URL.
Only latency metrics used by the comparator enter the derivation. Native load
thresholds remain active; failed native experiments cannot become a baseline.
The comparator requires both the relative and absolute measured limits to be
exceeded, refuses missing tolerance entries with exit 3, and preserves the
error-rate check. Fixture tolerances in tests are synthetic and are not evidence.

The gate remains advisory. First retain a five-sample calibration cohort in a
separate PR, moving the June baseline and provenance unchanged into history.
Then run an independent five-sample A/A cohort and three degraded samples against
that committed baseline. All five clean samples must pass and all three degraded
samples must fail naming the article-list p95; proxy counters must prove injection.
Only a later reviewed PR with the real results can enable blocking. A failed
validation leaves advisory mode in place and requires an owner decision on the
next measurement strategy. No calibration result is claimed by this tooling PR.
