# Contributor Architecture Guide

## First Run

```bash
npm ci
npm run typecheck
npm run test:unit
npm run smoke
```

`npm run smoke` runs the lightest workload against the local target, so it is the fastest way to
confirm the toolchain works end to end before running load/stress/soak scenarios.

## Project Map

| Area        | Purpose                                                                    |
| ----------- | -------------------------------------------------------------------------- |
| `src/`      | k6 scenario source and shared performance helpers                          |
| `config/`   | Workload profiles and environment configuration                            |
| `scripts/`  | Runners, report generation, baselines, comparisons, and validation         |
| `baseline/` | Checked-in reviewed baseline examples                                      |
| `reports/`  | Generated run output                                                       |
| `docs/`     | Architecture, SLOs, evidence, onboarding, and result-interpretation guides |

## Commands

- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm run test:unit`
- Smoke perf run: `npm run smoke`
- Observability stack: `npm run docker:up` / `npm run docker:down`
- Baseline/reporting: `npm run baseline`, `npm run report`, `npm run report:site`

## Change Workflow

1. Prefer targeted npm scripts over reconstructing k6 commands manually.
2. Treat generated reports and k6 result JSON as artifacts, not source — regenerate rather than
   hand-edit them.
3. Update `docs/known-issues.md` or `docs/capability-status.md` when a scope limit changes.
