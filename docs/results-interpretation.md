# Results Interpretation

See [visual performance evidence](evidence.md) for the expected overview, soak, and threshold
failure review format.

## Release Decision Order

1. Confirm the target, commit, k6 version, profile, duration, and sample count.
2. Treat any failed k6 threshold as a failed run.
3. Review endpoint-scoped p95 and p99 latency before aggregate latency.
4. Review request failure rate and business error counters.
5. Confirm requested arrival rate was sustained without dropped iterations.
6. Compare full controlled runs only; validation profiles are wiring checks, not baselines.

## Regression Rules

The absolute thresholds in k6 remain authoritative. Load comparison rejects any retained aggregate,
endpoint, or business-metric p95/p99 latency that exceeds the reviewed baseline by more than 20%,
and rejects request failure rates at or above 2%. A baseline is valid only when it is the median of
at least three controlled full-profile runs against the pinned RealWorld backend.

The committed baseline is valid only for the recorded target, workload profile, k6 version, and
runner class. `npm run baseline:compare` rejects incompatible candidates before comparing metrics.
Network targets, different profiles, and materially different runner classes require a separate
reviewed file selected with `BASELINE_FILE`.

Full stress, spike, soak, and breakpoint runs enforce strict absolute thresholds and compare
percentile trends with the latest compatible retained artifact when one exists. A missing history
does not weaken absolute thresholds; it only means the first run establishes the comparison source.
Breakpoint history compares `lastHealthyVus` from the binary-search result and rejects a capacity
loss greater than 20%.

## Common Signals

| Signal                                     | Interpretation                                                        |
| ------------------------------------------ | --------------------------------------------------------------------- |
| p50 stable, p99 rising                     | Tail saturation, queueing, or dependency outliers                     |
| latency rising with dropped iterations     | Insufficient VU capacity or target saturation                         |
| checks fail but HTTP errors remain low     | Functional response contract failure                                  |
| business errors rise without HTTP failures | Application-level rejection or invalid workflow state                 |
| throughput falls while latency stays flat  | Client-side capacity, throttling, or arrival-rate configuration issue |
