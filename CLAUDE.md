# CLAUDE.md

## Project

TypeScript k6 performance automation framework with smoke, load, stress, spike,
soak, breakpoint, observability, baseline, and reporting workflows.

## Session Start

Refresh the local code graph before structural discovery:

`bash .agent/index-codebase-memory.sh`

Current MCP project name:

`home-vyaspc-Documents-Repo-k6-performance-framework`

## Commands

- Install: `npm ci`
- Build: `npm run build`
- Typecheck: `npm run typecheck`
- Lint: `npm run lint`
- Unit tests: `npm run test:unit`
- Smoke perf run: `npm run smoke`
- Observability stack: `npm run docker:up` / `npm run docker:down`
- Baseline/reporting: `npm run baseline`, `npm run report`, `npm run report:site`

## Layout

- `src/` - k6 scenario source and shared performance helpers.
- `config/` - workload and environment configuration.
- `scripts/` - runners, report generation, baselines, comparisons, and validation.
- `baseline/` - checked-in baseline examples.
- `reports/` - generated run output.
- `docs/` - architecture, SLOs, evidence, onboarding, and result interpretation.

## Codebase Memory MCP

Use graph tools before broad file reads:

1. `list_projects`
2. `get_architecture(project="home-vyaspc-Documents-Repo-k6-performance-framework")`
3. `search_graph`
4. `trace_path`
5. `get_code_snippet`
6. `query_graph`

Fall back to `rg` for literals, configs, docs, generated files, scripts excluded from the graph,
or insufficient graph results.

## Agent Rules

- Cite `file:line` for code claims whenever practical.
- Prefer targeted npm scripts over broad manual command reconstruction.
- Treat generated reports and k6 result JSON as artifacts, not source.
- Do not commit `.codebase-memory/`, `codebase-memory/`, or `.agent/index-codebase-memory.sh`.

