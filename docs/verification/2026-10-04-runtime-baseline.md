# Node 24 runtime and clean bootstrap verification

The supported baseline is Node 24.21.0 plus npm 10.9.4. `.nvmrc`, engines,
installation guard, README/onboarding and every setup-node workflow use the same
policy. All 399 non-root lock entries remain unchanged; no workload, target,
baseline or tolerance was regenerated.

The official Linux x64 archive was checked against its publisher SHA256 manifest:
`fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`.
This is checksum verification, not signature validation.
[Publisher release files](https://nodejs.org/download/release/v24.21.0/) and
[Node lifecycle](https://nodejs.org/en/about/previous-releases) establish the
selected release and lifecycle context.

## Actual checks

- Normal `npm ci` lifecycle, build/typecheck, lint and format passed. Unit coverage:
  106 passed, one existing Windows-only skip; statements95.71%, branches94.16%,
  functions95.90%, lines96.58%, at unchanged required floors. Twelve runtime cases
  exercise supported/unsupported boundaries, without claiming future patches tested.
- Actual Node24.19.0 and Node18.19.1 executions rejected unsupported versions with
  exit1 and the bootstrap instruction. Supported Node24.21.0 installation accepted.
- Native k6 transport controls retained independent observation/completion agreement:
  healthy5001 and delayed-boundary301 exit0; under-driven11, HTTP-error61 and
  timeout16 exit99. These local counts are observations, not new performance baselines.
- Actionlint1.7.7 passed all workflows with ShellCheck/Pyflakes integrations disabled.
  Configuration explicitly declares the existing optional `performance` runner label;
  it does not provision a self-hosted runner.

## Fresh checkout and empty-cache installation

A disposable local Git clone of the preceding head received the exact runtime patch
and its new files. It had no node_modules and a newly empty isolated npm cache.
The shell environment was stripped; separate empty user/global npm configuration
files prevented inheriting workstation npm settings. Normal `npm ci --no-audit`
ran the preinstall guard and installed345 packages. No lifecycle bypass was used.
The documented typecheck, lint, unit test, build and local hook installation all
passed, including106 tests and the existing one Windows-only skip.
No target, Docker, credentials or k6 binary was needed for these onboarding checks.
The preprovisioned Node/npm binaries are prerequisites, not an empty tool-cache claim.

The first setup attempt stopped because npm rejects reusing `/dev/null` as both
configuration files; distinct empty files repaired the verification setup. An initial
sandboxed unit attempt had six failures: a temporary diagnostic probe demonstrated
`spawnSync` EPERM and empty child output. The same unchanged checks passed outside
that execution restriction. The probe was removed and no assertions were weakened.

Native logs and source hashes are retained in `evidence/2026-10-04-runtime/`.
At exact head8844f1b, [Quality37200941929](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37200941929)
passed Linux106-test/transport and Windows installation/format jobs. Native logs
record Node24.21.0/npm10.9.4. [Security37200941934](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37200941934)
also passed. The disposable first-success path passed on repeat.

[Observability37200941900](https://github.com/qa-test-automation-frameworks/k6-performance-framework/actions/runs/37200941900)
failed with native k6 exit107 because `host.docker.internal` is not loopback and
Compose did not forward explicit load authorization. A separate repair forwards
the flag with defaultfalse and authorizes only the workflow step that starts the
pinned owned backend. Full telemetry verification needs the new native Docker run;
quality success does not imply observability success. Other repository runtime baselines
and portfolio-wide R01/R03 remain separate work.
