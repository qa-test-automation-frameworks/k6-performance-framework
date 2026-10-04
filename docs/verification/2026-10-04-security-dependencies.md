# Security dependency repair — 2026-10-04

This R02 repair changes development tools and their native npm lockfile. Workload code, thresholds, comparison policy, baselines and test selection are unchanged. The checked parent is `0f7f347`; the source SHA-256 values in the adjacent manifest identify the tested dependency files before the delivery commit exists.

## Selection and compatibility

| Dependency | Before | After | Reason |
|---|---|---|---|
| CycloneDX npm CLI | 5.0.0 | 6.0.1 | Fix the publisher's Windows workspace argument injection advisory; exercise the existing SBOM command. |
| TypeScript ESLint parser/plugin | 7.18.0 | 8.71.0 | Remove the vulnerable old parser/globbing dependency chain; retain ESLint 8.57.1 and the existing rules/configuration. |
| Vitest and V8 coverage | 4.1.8 | 4.1.11 | Fix the mocker redirect/path traversal advisory; retain the same test framework and coverage floors. |
| Vite | 8.0.16 | 8.0.16 | Explicit override retains the tested runtime while repairing other dependencies. |

Primary advisories: [CycloneDX](https://github.com/CycloneDX/cyclonedx-node-npm/security/advisories/GHSA-q69g-4hcv-6jg4) and [Vitest](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9). The native before-scan has **21 vulnerability entries: 18 high and 3 moderate**. Entries include propagated vulnerable ancestors; this is not a count of unique CVEs. No exclusions were added.

Pinned npm 10.9.4 initially crashed with `Cannot read properties of null (reading 'edgesOut')` during peer resolution. This occurred against both the existing tree and an isolated clean directory. The debug trace reaches the newer Vite optional developer-tools chain and Vitest 5 peer resolution. Retaining Vite 8.0.16 allowed normal native resolution; peer validation was not disabled. Since the old lock still triggered the failure, the replacement lock was generated from the unchanged pinned direct versions plus the selected security updates in an isolated directory. This refresh also resolves compatible transitive patches. It is not a hand-edited lockfile or `npm audit fix --force` result.

## Executed verification

Runtime: Node 24.19.0, npm 10.9.4, k6 2.0.0; Linux. OSV scanner 2.3.8. Each command below ran from the repository with these isolated tools on `PATH`.

| Command | Actual result |
|---|---|
| `npm ci --no-audit` | Exit 0; normal lifecycle hooks enabled. |
| `npm audit --json` | Exit 0; zero findings at every severity. |
| `osv-scanner scan source --lockfile=package-lock.json --format=json` | Exit 0; 374 packages scanned, empty results. |
| `npm run lint` | Exit 0; existing rules unchanged. |
| `npm run format:check` | Exit 0. |
| `npm run build` | Exit 0, including TypeScript checking. |
| `npm run test:coverage` | Exit 0; 74 passed, one existing Windows-only skip; statements 95.66%, branches 93.99%, functions 95.90%, lines 96.54%. Existing floors unchanged. |
| `npm run sbom` | Exit 0; native CycloneDX JSON generated. |
| `npm run verify:request-rate` | Exit 0; healthy native exit 0 and 5,000 observed measurement requests; under-driven native exit 99 and 10 requests; HTTP-error native exit 99 and 60 requests. Intended failures checked, not arbitrary nonzero exits. |

Native scans, compressed logs, SBOM and hashes are retained in `evidence/2026-10-04-security/`. The scanner output is a point-in-time result, not a guarantee against future advisories. Windows execution and exact-revision remote checks must be read independently after pushing. Node lifecycle policy/CI migration is the separate R01 package; this local Node 24 result does not establish support for every version allowed by the existing engine field. ESLint's major migration remains separate from this security repair.
