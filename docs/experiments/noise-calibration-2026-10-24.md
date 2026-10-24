# Noise calibration observation — 24 October 2026

**Disposition: rejected calibration cohort; the regression comparison remains advisory.**

Source workflow: [retained run](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/40086572262); framework SHA `1eb12f5a2e621b30bd7328e9afc43ffb3c2ed117`.

Every sample passed the unchanged native load thresholds and used a zero-delay loopback proxy. The existing baseline compatibility check refused the cohort because the hosted runner images differed. No measured baseline or tolerance was accepted, no independent validation or degraded cohort was collected, and blocking mode was not enabled.

| Sample | Runner image | Article-list p95 (ms) | Article-list p99 (ms) | Native result |
|---|---|---:|---:|---|
| sample-1 | ubuntu24-20261023.334.3 | 2.9452 | 3.4347 | PASS |
| sample-2 | ubuntu24-20261012.334.1 | 2.2540 | 2.7737 | PASS |
| sample-3 | ubuntu24-20261023.334.3 | 2.6770 | 3.6096 | PASS |
| sample-4 | ubuntu24-20261023.334.3 | 2.8580 | 3.2433 | PASS |
| sample-5 | ubuntu24-20261023.334.3 | 2.5281 | 2.8838 | PASS |

Observed aggregate refusal: `Incompatible optional identity field runnerImage`.

The samples run on separate shared hosts with the target and generator on the same host. Host image rollout is an observed compatibility limitation, rather than a latency regression. The original bytes, proxy counters, native exits and generated SHA256SUMS are retained beside this report. The rejected set is kept separate from baseline/sources and the historical baseline remains unchanged.

## Proposed next protocol

The owner approved a later guarded attempt. Once the hosted image rollout has settled, collect a new cohort with an expected-image preflight. Reject a sample before measuring if its actual image differs; do not retry, replace or cherry-pick samples. Retain every attempt. Only a complete compatible five-sample calibration, independent five-sample validation and three degraded samples meeting the original criteria can support blocking mode. This proposal has not been executed.

## Reproduction

`node scripts/report-calibration-observation.cjs` verifies the native outcomes, source identity, proxy arm and expected aggregate refusal, then regenerates this report and the hash manifest. This verification runs in GitHub CI.
