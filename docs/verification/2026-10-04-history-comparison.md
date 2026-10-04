# Historical comparison diagnosis and validation

F08 investigates the original audited runs using recovered native artifacts.
The parent revision is `5b9fdc6`; the manifest identifies the tested sources.
Historical measurements, workload identities and the published baseline are preserved.
No latency objective, 20% comparison tolerance or baseline value was changed.

## Demonstrated causes

[Soak run35497856157](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/35497856157)
passed its controlled workload and failed its history comparison. Its retained
artifact contains both `history/soak-summary.json` and `soak-summary.json`.
The candidate framework SHA is `6740414c0c81329c73a8329abc5351a723fb28d5`;
the previous framework SHA is `31a7ba2ffbfcb0545ac2e5a6af61604da67901ac`.
Target SHA, profile, runner class and k6 version agree. Replaying the recovered
pair reproduces the rejection.

The comparator assigned Infinity to every percentile whose previous value was
zero, including unchanged zero-to-zero TLS, connection and unsampled-detail
metrics. Six reported failures were caused by this arithmetic defect. The repair
reports zero change for zero-to-zero, while zero-to-positive still fails. After
the fix the same native pair remains rejected for seven actual threshold breaches.
Examples, using raw values rounded only for display:

| Soak metric/statistic | Previous ms | Candidate ms | Absolute delta ms | Relative change |
|---|---:|---:|---:|---:|
| HTTP duration p95 | 9.3905 | 11.9815 | +2.5910 | +27.59% |
| Tags p95 | 7.6064 | 10.4774 | +2.8710 | +37.74% |
| Articles p95 | 10.7297 | 13.0043 | +2.2746 | +21.20% |
| TLS p95/p99 | 0 | 0 | 0 | 0% |

[Candidate run36103418460](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/36103418460)
also passed its workload and failed its baseline comparison. Its delivered head
is `806205e21a44d6e6b055c761e7d1d269dcd6fe6e`; the actual summary identifies PR
merge `5aa8f28895a224b709a124ce65531577cdb8c67b`. The recovered baseline/candidate
pair reproduces the eight original percentile rejections under the unchanged rule.

| Candidate metric p99 | Baseline ms | Candidate ms | Absolute delta ms | Relative change |
|---|---:|---:|---:|---:|
| Tags | 1.4245 | 2.0774 | +0.6529 | +45.83% |
| Profiles | 0.7203 | 0.9256 | +0.2054 | +28.52% |
| Comments | 1.0403 | 1.3340 | +0.2937 | +28.23% |

These are observed increases under a decision rule, not proof of an application
regression or of harmless CI noise. Absolute differences are now displayed beside
percentages. The original baseline capture API returns zero artifacts, and the
three raw source summaries are absent from the tracked repository. Consequently
their variability cannot be verified here. D04 must gather matched repeated raw
runs and declare a meaningful-difference/noise policy before changing thresholds.
No new baseline was captured or approved in this repair.

## Comparison integrity

Both comparators reject non-finite/negative limits and invalid percentile values;
history rejects missing candidate percentiles instead of silently comparing a
subset. Empty percentile sets cannot pass. Explicitly failed/invalid experiments
cannot become healthy comparisons. History identity now also requires matching
target commit and environment, in addition to its existing workload/profile/tool/
runner identity.

Scheduled lookup and comparison are separate steps. Lookup searches successful
main-branch runs by run ID, allowing useful same-code history; it selects the
primary artifact result rather than a nested `history/` copy, and skips identities
that do not match the current summary. API errors remain failures. Missing,
unretained, nested-only or incompatible inputs emit `available=false` and a
machine-readable **unavailable** selection; the comparison step is skipped.
Passing absolute workload thresholds is not represented as a passed comparison.

The existing breakpoint capacity path remains separate: its artifact selection
does not establish a full capacity workload/provenance identity. D04 must harden
that producer/comparator; this repair does not certify it or claim application capacity.

## Executed checks

- Node24.19.0/npm10.9.4:94 unit tests passed, one Windows-only skip, unchanged
  coverage floors; statements95.71%, branches94.16%, functions95.90%, lines96.58%.
- Build/typecheck, lint, formatting and Bash syntax pass. Actionlint1.7.7 passes
  the changed workflow with optional ShellCheck/Pyflakes integrations disabled;
  no coverage from those missing tools is claimed.
- Native recovered soak pair fails before/after the repair for the documented
  reasons. Candidate replay retains the original endpoint rejection. These expected
  failures are preserved, not reclassified as passing workloads or repaired measurements.
- Regression controls accept unchanged zero values/healthy candidates; reject
  zero-to-positive/degraded candidates, missing/null/negative/non-numeric data,
  changed target/environment and invalid tolerances. Lookup controls exercise a
  compatible fallback, current-run exclusion, primary/nested precedence, missing
  artifacts and API errors.
- A real local lookup against GitHub selected a retained compatible main-branch
  input. It uses synthetic currentRunId0 to indicate local execution, not an actual
  GitHub workflow identity; no new workload was run. Its selection JSON and native
  lookup/comparison logs are retained. Because the candidate is a recovered older
  fixture, this is a lookup integration probe, not a chronological performance
  experiment or a new measurement comparison claim.

Native logs, recovered inputs, capture availability response and source hashes
are in `evidence/2026-10-04-history/`. Remote verification below covers workflow execution. The repeat-run study remains
separate D04 work.

## Exact-revision remote verification

At head `b2083bd6cc8864b9bf606d2512f688334d5ccf77`,
[Quality 37199666025](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37199666025)
and [Security 37199666063](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37199666063)
completed successfully. These used the runtime configured at that revision; they
do not verify the subsequent Node 24 change.

The actual manual [full-profile spike 37199685506](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37199685506)
completed successfully against the owned local target. Native job `111428626475`
ran the controlled test and lookup successfully, then **skipped** the historical
comparison. Artifact `11302272514` records disposition `unavailable`, reason
`no_retained_compatible_primary_input`. This verifies truthful absence handling;
it does not establish a passed regression comparison, new baseline, or calibrated
noise tolerance. Native summary, selection and API metadata with hashes are retained
in `evidence/2026-10-04-history-remote/`.
