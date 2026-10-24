# Full-profile validation plan

**Status:** protocol executed with three healthy samples. See the [results and disposition](full-profile-validation-2026-10-22.md).

## Purpose and scope

This study will measure the run-to-run spread of the existing full article-load
profile. It will not set production capacity, re-tune SLOs, or replace the
historical baseline. Keep native threshold results separate from the historical
baseline comparison: that baseline is an aggregate whose raw inputs are
unavailable, so its comparison remains descriptive rather than a reproducible
variability estimate.

The existing full-profile comparison passed in workflow run
[38925775044](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/38925775044):
aggregate p99 was 16.2% lower than the baseline while the worst endpoint or
custom p99 was 15.2% higher. A later comparison in run
[38933904782](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/38933904782)
failed all ten p99 comparisons (overall +26.1%, `/articles` +51.7%) while every
p95 delta stayed between -13.3% and +6.0%. The candidate in the latter run
processed 32,250 requests and 9,600 iterations. These are historical
baseline-comparison dispositions, not two samples collected by this protocol.
The cause remains **undetermined**. Preserve both results; do not choose only
the passing result or change a threshold to make either result pass.

The controlled latency study is a separate 15-request/s, 15-second controlled-latency
experiment. It does not calibrate this eight-minute journey profile and must
not be converted into an eight-minute production claim.

## Frozen workload and target

This snapshot was checked against the framework code at
`cf92ee724522bf382983767868b0ccd8c55682f7`. Before collection, record the exact
immutable framework SHA used for all samples; use the same SHA throughout the
healthy cohort. The current profile and capture settings are:

| Field                 | Predeclared value                                                                                                                                                                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework entry point | `tests/load/articles-load.ts`, built as `dist/load/articles-load.js`                                                                                                                                                                                                                         |
| Workload              | `TEST_PROFILE=full`, `TARGET_ENV=local`, `TARGET_ID=realworld-local`                                                                                                                                                                                                                         |
| Arrival model         | Constant arrival rate of 20 **iterations** per second; this is not 20 HTTP requests/s                                                                                                                                                                                                        |
| Duration / warmup     | 8 minutes of measurement; no separate warmup stage; 1 second think time after each journey                                                                                                                                                                                                   |
| VU envelope           | Maximum 100 VUs; `preAllocatedVUs` is `min(20, maxVUs)`                                                                                                                                                                                                                                      |
| k6                    | `2.0.0`                                                                                                                                                                                                                                                                                      |
| Target source         | `realworld-apps/nitro-prisma-zod-realworld-example-app` at `c8c66858a436a6e07f445fffe2253a65ff6dcb58`                                                                                                                                                                                        |
| Target build          | Fresh clone, `bun install --frozen-lockfile`, database generation/push and build; Bun `1.2.15`; no container image is used                                                                                                                                                                   |
| Target state          | Fresh application process and database for each independently dispatched workflow run; seed one run-specific user and five articles before the load. No writes occur in the article-load journey.                                                                                            |
| Runner                | GitHub-hosted `ubuntu-latest`; target, k6 generator, and evidence process share the runner                                                                                                                                                                                                   |
| Runner allocation     | No CPU or memory reservation is configured by the workflow. Record the resolved `ImageOS`/`ImageVersion`, architecture, available parallelism, host memory, cgroup CPU quota, and cgroup memory limit for every sample; do not assume the `ubuntu-latest` alias supplies a fixed allocation. |

The journey uses a deterministic per-VU iteration sequence from
`src/fixtures/browse-behaviors.json`: weights 50/35/15 for quick-reader (article
list limit 5), article-reader (limit 10), and deep-reader (limit 20). Every
iteration requests `GET /articles` and `GET /tags`. The article-reader and
deep-reader iterations also request `GET /articles/:slug`,
`GET /articles/:slug/comments`, and `GET /profiles/:username`, when the seeded
article is present. Report realized endpoint counts from each summary; the
configured weights do not guarantee an exact aggregate share over a finite
run. Retain the endpoint and custom business metrics produced by the current
framework.

Use the existing thresholds in `config/thresholds/load.ts` unchanged. They
include checks at 100%, overall request p95 <20 ms and p99 <40 ms, endpoint
latency and failure limits, custom business-metric limits, dropped iterations
<10, and the existing minimum iteration/request rates. Do not alter thresholds
or workload settings after seeing sample results.

## Collection protocol

1. Collect a healthy cohort of at least three independently started samples
   first. Use one separate `main-load.yml` workflow dispatch per sample, with
   `sample_order` set to 1, 2, and 3, so each starts on a new hosted runner and
   builds a fresh target state. All three planned runs must use the same
   framework SHA, target SHA, k6 version, environment, workload settings, and
   runner class. Record workflow run ID, attempt, run URL, sample order, and
   summary `metadata.runId` separately. Keep an automatic main-push run as
   supplemental evidence; do not substitute it for one of the three
   prospectively numbered dispatches.
2. For every sample, record UTC start and end times, runner image and resource
   allocation, target/framework SHAs, k6 version, workload/profile identity,
   endpoint mix, target seed/reset state, and whether caches were used. Preserve
   the native summary and stdout/stderr artifacts. The application is freshly
   built and seeded for each run. Its in-process state starts cold and warms
   naturally during the workload; do not add a separate warmup stage. Record
   dependency-cache restore status, and do not clear or alter caches between
   samples. Record the Node setup action's npm cache-hit output. The target's
   Bun install has no configured cache restore in this workflow; record that
   as “not configured,” rather than implying it shared a cache.
3. Record native threshold results, producer failures, all endpoint/custom
   p95 and p99 values, checks and HTTP errors, request and iteration counts and
   rates, and dropped iterations. `achievedLoad` is not applicable to this
   journey-arrival profile; do not infer request-rate validity from the nominal
   iteration target. Preserve actual rates and native dropped-iteration
   results. If a future sample unexpectedly carries `achievedLoad.valid=false`,
   stop the cohort and retain that run as invalid. Preserve the raw summary
   even when a run fails.
4. Pre-run runner envelope: `scripts/perf04-runner-monitor.cjs` samples host CPU
   utilization, CPU throttling counters, memory use, and target health while
   the pinned target is installed/built and through the full article workload.
   It writes one-second CSV samples and a JSON envelope to the same artifact as
   the raw summary and stdout/stderr. Use the strictest visible cgroup CPU and
   memory limits; when no cgroup limit is set, record the observed host
   allocation. Stop the active k6 process if memory reaches 90% of its recorded
   limit, if throttled-period counts increase in 30 consecutive one-second
   samples, or if two target health probes fail consecutively. The target
   probe runs every five seconds with a two-second timeout; this adds at most
   0.2 unmeasured GET requests/s and is recorded as monitoring traffic.
   Sampling starts before target dependency install/build and stops after the
   article workload, before the short authenticated validation check. If the
   completed native summary reports failed checks, failed thresholds,
   producer failures, or a dropped-iteration threshold failure, mark the run
   failed and do not rerun it as a replacement. If a CPU or memory allocation
   or CPU-throttle counter cannot be observed, mark the resource result unknown
   and the cohort inconclusive. Keep a stopped or invalid run in the cohort
   with its stop time and reason; never remove it from the denominator without
   explaining the disposition.
5. Do not run a degraded full-profile cohort in this first study. Mark it
   **not collected**. If a later degraded cohort is affordable, write a separate
   prospective amendment, state the single intended intervention, and
   interleave healthy controls with degraded runs. Controlled latency results are not those
   controls.

The stop rules protect the validity of the measurement; they do not redefine
the framework's SLO thresholds. A full-profile SLO failure is an observed
result, not a reason to discard the sample.

## Per-sample report template

Copy one row per started sample, including stopped or invalid runs. Link each
raw summary and its workflow artifact.

| Sample | Order / condition | Workflow run / attempt / URL | Start–end UTC | Framework SHA | Target SHA / seed state | k6  | Runner image / class / arch | CPU allocation / peak / throttling | Memory limit / peak | Profile / iterations/s / max VUs / duration | Warmup / think time / npm and Bun cache state | Native status / failed thresholds / producer failures | Checks / HTTP errors / dropped iterations | Overall p95 / p99 | Endpoint and custom p95 / p99 | Requests / iterations counts and rates | Stop or invalid reason | Resource CSV / JSON, summary and artifact hashes |
| ------ | ----------------- | ---------------------------- | ------------- | ------------- | ----------------------- | --- | --------------------------- | ---------------------------------- | ------------------- | ------------------------------------------- | --------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- | ----------------- | ----------------------------- | -------------------------------------- | ---------------------- | ------------------------------------------------ |
| H1     | 1 / healthy       |                              |               |               |                         |     |                             |                                    |                     |                                             |                                               |                                                       |                                           |                   |                               |                                        |                        |                                                  |
| H2     | 2 / healthy       |                              |               |               |                         |     |                             |                                    |                     |                                             |                                               |                                                       |                                           |                   |                               |                                        |                        |                                                  |
| H3     | 3 / healthy       |                              |               |               |                         |     |                             |                                    |                     |                                             |                                               |                                                       |                                           |                   |                               |                                        |                        |                                                  |
| Push   | supplemental      |                              |               |               |                         |     |                             |                                    |                     |                                             |                                               |                                                       |                                           |                   |                               |                                        |                        |                                                  |
| D1–D3  | degraded          | **Not collected**            |               |               |                         |     |                             |                                    |                     |                                             |                                               |                                                       |                                           |                   |                               |                                        |                        |                                                  |

## Analysis and disposition

For each metric, report every sample's run-level percentile and the observed
minimum, median, and maximum across the healthy runs. Do not average request
latencies or merge requests across runs to claim a pooled-request percentile.
Show the native threshold disposition and the historical-baseline comparison
separately for each run. Report all invalid and stopped samples and the
denominator. With n=3, describe variability only; uncertainty is large and the
range is not a confidence interval.

The final report must state whether the three runs were compatible, whether
each passed the unchanged native thresholds, the run-level percentile ranges,
and whether the data are inconclusive or show an SLO failure. Any threshold
change needs a separate written rationale and review. Do not call this local
colocated application/generator study production capacity, do not call unique
run IDs proof of independent operating conditions, and do not rewrite the June
historical aggregate from this study alone.

## References

- [Full-profile workload](../../tests/load/articles-load.ts)
- [Arrival and VU settings](../../config/environments/local.ts) and [workload stages](../../config/workloads.ts)
- [Endpoint mix](../../src/fixtures/browse-behaviors.json) and [journey implementation](../../src/scenarios/browse-articles.ts)
- [Unchanged load thresholds](../../config/thresholds/load.ts)
- [Main-load workflow](../../.github/workflows/main-load.yml) and [pinned target build](../../.github/scripts/start-realworld.sh)
- [Bounded latency experiment](../verification/2026-10-16-d04-performance-study.md)
- [Historical full-profile outcomes](../capability-status.md)
