# Performance Baseline

## Current disposition

As of 2026-10-21, `load-summary.json` is a historical June aggregate. Its three
source summaries are unavailable, so the aggregate cannot be reproduced or
used as evidence of run-to-run variability. Keep that record unchanged. A new
measured baseline needs newly retained, reviewed source runs; do not silently
replace the June record with a relabeled aggregate.

The historical record's provenance is described in `provenance.json`. Its
hashes identify the historical aggregate inputs but do not replace those source
files. The previous baseline was also invalidated after the controlled target
gained deterministic seed data and endpoint sample-presence gates.

## Creating a new measured baseline

Capture at least three current full runs and retain each raw summary. Every run
must pass its native thresholds and producer checks. Request-rate runs must
include valid achieved-load evidence. `scripts/aggregate-baseline.cjs` rejects
mixed target or framework revisions, environments, k6 versions, runner classes,
workloads, failed or incomplete runs, duplicate run IDs, and duplicate source
basenames before it writes an aggregate.

Use the capture workflow's run ID, attempt, and sample ordinal for workflow
captures. For local runs, set `K6_RUN_ID` explicitly or use
`scripts/save-baseline.sh` / `scripts/save-baseline.ps1`, which assign a local
identifier. A unique ID identifies a run; it does not prove that runs had
independent operating conditions. Record the collection design and review the
target, generator, environment, and timing conditions separately.

Run `npm run baseline:aggregate -- <summary-1.json> <summary-2.json> <summary-3.json>`
from the repository root. The command records canonical repository-relative
source paths and SHA-256 digests, along with each run ID. Output identity comes
from the validated summaries. Existing identity environment variables are
assertions only; they cannot relabel mixed runs. Review the aggregate and every
source summary before changing `load-summary.json`. If a new aggregate is
accepted, update `provenance.json` with its actual retained sources and review
the regression workflow's baseline link before committing it.
