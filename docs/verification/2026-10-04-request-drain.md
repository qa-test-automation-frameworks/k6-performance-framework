# Bounded request drain and truncation detection

This F04 follow-up repairs a reproduced operating failure rather than accepting a later lucky pass. The parent is `8400ca1`; the evidence manifest hashes the tested sources and actual k6 bundles. Runtime: Node24.19.0, npm10.9.4, k6v2.0.0 / commit8c3be52cc1. All targets below are disposable loopback fixtures, not application-capacity benchmarks.

## Reproduced defect

Historical Quality37182358460 received5,001 measurement requests but completed5,000 in k6. The guard rejected the mismatch. A new 50ms-response fixture reproduced the same failure on the original zero-drain bundle:300 received versus295 completed, native exit0, and the original summary incorrectly valid. The unchanged98% floor could accept295/300; it could not distinguish interrupted attempts from a slightly smaller arrival cohort.

[Grafana's graceful-stop documentation](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/graceful-stop/) describes why duration boundaries can interrupt iterations and skew metrics. This repair allows a fixed2s completion drain after arrivals stop, while retaining the1s HTTP timeout and2s settling gap. No new requests are scheduled during the drain. Measurement rates remain actual completed requests divided by the declared arrival window; they are cohort rates, not whole-run wall-clock throughput.

A custom started-attempt counter now must equal native completed requests and iterations. Missing counters or interrupted attempts make the summary invalid. The documented `load:request-rate` and `load:500rps` commands continue to enforce `check-achieved-load.cjs` after k6 exits. A zero native exit alone is insufficient.

## Boundaries and compatibility

The unchanged native upper threshold already permits one extra boundary arrival. The delayed fixture actually reproduced301 received/completed requests for a nominal300-request window. The verifier now applies the same nominal..nominal+1 bound and checks the exact80/20 sequence for the actual cohort (`tags=floor(count/5)`), rather than assuming a mathematically exact count that the executor does not promise. Received/native equality remains exact; no latency, error, dropped-iteration or98% floor was loosened.

New summaries use `single-request-arrival-v2` with `requestDrainSeconds=2`. Shared workload identity rejects v1/v2 comparisons and missing/unsupported drain declarations; historical evidence remains v1. Journeys retain their existing identity and behavior. No historical baseline was regenerated.

## Actual verification

- Build/typecheck, lint and formatting pass.
- Required coverage:78 tests passed, one existing Windows-only skip; statements95.71%, branches94.16%, functions95.90%, lines96.58%. Existing coverage floors unchanged.
- Full native harness passes: healthy5,001 requests/native0; boundary301/native0; under-driven11/native99; HTTP-error61/native99; timeout15/native99. Each observed count exactly matches the native completed measurement count. Negative controls verify their intended gate/check.
- The stricter negative control changes only both compiled `gracefulStop` options to0s, keeping the new metadata and accounting intact. It records300 received/started versus295 completed, native0, summary INVALID. The independent verifier exits1 with the observer/native mismatch; `check-achieved-load.cjs` exits1 with `Started HTTP attempts did not all complete within the bounded drain`. Thus completion detection is proved independently of k6's own threshold exit.
- The same achieved-load CLI accepts the retained healthy v2 summary and reports actual500.1 requests/s over10s, zero dropped iterations.
- Unit regressions accept a compatible drained identity, reject a v1/v2 comparison, reject unsupported/missing drains, reject missing attempts and truncated attempts, and enforce the existing one-extra-arrival limit.

Evidence is under `evidence/2026-10-04-request-drain/`, including original and accounted zero-drain bundles, exact native JSON, logs and source/native SHA256 values. The control bundle was modified only in the stated drain options. Source hashes printed by the verifier describe the workspace at execution; the separate entrypoint hash identifies the actual overridden bundle.

For reproduction, build the bundle, then run `npm run verify:request-rate`. To run only the delayed probe, set `REQUEST_RATE_VERIFICATION_MODE=boundary`. For a negative control, copy the generated bundle to a temporary file, replace both graceful-stop expressions with `gracefulStop: "0s"`, and set `REQUEST_RATE_ENTRYPOINT` to that copy. Inspect the expected mismatch and invalid summary; do not classify arbitrary nonzero exits as proof.

Remote checks at the delivery revision remain separate until their actual results are inspected. This does not complete F08's historical performance-comparison diagnosis, supported runtime migration, the real application study or sustained operation.
