# k6 Performance Framework - Implementation Roadmap

> **Living document.** Phases in progress use present tense; completed phases use past tense.
> Update this file as each phase is completed.

## Overview

| Phase | Title                         | Duration   | Status     |
|-------|-------------------------------|------------|------------|
| 0     | Inception & Repository Setup  | Days 1-3   | Completed  |
| 1     | Core Infrastructure           | Days 4-7   | Completed  |
| 2     | API Service Layer             | Days 8-11  | Implemented |
| 3     | Smoke & Load Tests            | Days 12-15 | Implemented |
| 4     | Advanced Scenarios            | Days 16-21 | Implemented |
| 5     | Observability Stack           | Days 22-25 | Implemented |
| 6     | CI/CD Integration             | Days 26-30 | Planned    |
| 7     | Security & Quality Gates      | Days 31-33 | Planned    |
| 8     | Documentation & Polish        | Days 34-38 | Planned    |

---

## Phase 0: Inception & Repository Setup (Days 1-3)

**Goal:** An empty-but-opinionated skeleton that can receive code without configuration thrash.

**Deliverables:**
- [x] GitHub repo `k6-performance-framework` created under `qa-test-automation-frameworks` org
- [x] `package.json` with all devDependencies and npm scripts
- [x] `tsconfig.json` (strict mode, k6 types)
- [x] `esbuild.config.js` (glob-based build)
- [x] `.eslintrc.js` + `.prettierrc` + `.editorconfig`
- [x] `.gitignore` (node_modules, dist, reports, *.json output)
- [x] `LICENSE` (MIT with Attribution)
- [x] `README.md` stub (badges, description, quick-start placeholder)
- [x] `CONTRIBUTING.md` + `CHANGELOG.md`
- [x] All directory scaffolding with `.gitkeep` files
- [x] `docs/roadmap.md` (this document)
- [x] `docs/adr/001-language-typescript.md`
- [x] `docs/adr/002-bundler-esbuild.md`

**Acceptance Criteria:**
- `npm ci` completes without errors
- `npm run typecheck` exits 0 on empty stubs
- `npm run lint` exits 0
- All directories visible in repo tree

**Estimated Effort:** 4-5 hours

---

## Phase 1: Core Infrastructure (Days 4-7)

**Goal:** Foundational building blocks that every test file will import.

**Deliverables:**
- [x] `src/types/config.types.ts`, `api.types.ts`, `scenario.types.ts`
- [x] `config/environments/local.ts`, `staging.ts`, `production.ts`
- [x] `config/thresholds/smoke.ts`, `load.ts`, `stress.ts`, `soak.ts`
- [x] `config/index.ts` (env resolver with `getConfig()`)
- [x] `src/utils/http-client.ts` (k6/http wrapper with retry + tagging)
- [x] `src/utils/logger.ts` (level-aware structured logger)
- [x] `src/utils/metrics.ts` (all custom k6 Trend/Counter/Rate/Gauge)
- [x] `docs/adr/003-observability-stack.md`

**Acceptance Criteria:**
- `npm run build` produces `dist/` with zero TypeScript errors
- `http-client.ts` unit-verified: request tags appear in k6 output
- Config resolver correctly returns local vs staging configs via `TARGET_ENV`

**Estimated Effort:** 6-8 hours

**Dependencies:** Phase 0

**Completion note:** Core infrastructure and its prerequisite repository setup are complete.

---

## Phase 2: API Service Layer (Days 8-11)

**Goal:** Typed service objects for all Conduit endpoints; the test layer never calls `k6/http` directly.

**Deliverables:**
- [x] API service objects for auth, articles, comments, profiles, and tags
- [x] API barrel export
- [x] Auth, check, and data factory helpers
- [x] User and article fixtures
- [x] `docs/adr/004-target-application.md`

**Acceptance Criteria:**
- All service methods return typed responses (zero `any`)
- Every request carries a named tag for Grafana grouping
- SharedArray token pattern works across VUs
- ESLint reports zero errors

**Estimated Effort:** 8-10 hours

**Dependencies:** Phase 1

---

## Phase 3: Smoke & Load Tests (Days 12-15)

**Goal:** CI-ready smoke tests and realistic load scenarios with SLO-enforced thresholds.

**Deliverables:**
- [x] Health check and smoke test
- [x] Articles load and user journey load tests
- [x] Browse articles and authenticated CRUD scenarios
- [x] `docs/performance-slos.md`
- [x] npm scripts: `smoke`, `smoke:ci`, `load`

**Acceptance Criteria:**
- `npm run smoke:ci` passes against staging
- Load test produces p95/p99 data
- All groups visible in k6 summary output
- SLOs defined for all primary endpoints

**Estimated Effort:** 8-10 hours

**Dependencies:** Phase 2

---

## Phase 4: Advanced Scenarios (Days 16-21)

**Goal:** Full coverage of all six k6 test types.

**Deliverables:**
- [x] Stress, auth stress, spike, soak, and breakpoint tests
- [x] Concurrent readers scenario
- [x] Shell scripts in `scripts/`

**Acceptance Criteria:**
- Stress test demonstrates a degradation curve
- Spike test captures recovery time
- Breakpoint test aborts on threshold breach and reports failure rate
- All six test types produce valid JSON output

**Estimated Effort:** 10-12 hours

**Dependencies:** Phase 3

---

## Phase 5: Observability Stack (Days 22-25)

**Goal:** One-command local observability: `npm run docker:up` to Grafana at localhost:3001 with live k6 dashboards.

**Deliverables:**
- [x] Docker Compose stack for InfluxDB v2, Grafana, OTEL Collector, and k6 profile
- [x] Auto-provisioned Grafana datasource and k6 dashboard
- [x] InfluxDB and OTEL config
- [x] Local setup and baseline capture scripts
- [x] Load tests runnable with InfluxDB output

**Validation note:** Phase 3-5 source deliverables are implemented. Runtime acceptance remains pending
until Docker Desktop, k6, a local RealWorld target, and authentication tokens are available.

**Acceptance Criteria:**
- Local load run produces live Grafana metrics
- Dashboard shows VUs, RPS, p95, and error rate
- OTEL collector receives metrics
- Setup completes on a fresh machine in under 10 minutes

**Estimated Effort:** 8-10 hours

**Dependencies:** Phase 4

---

## Phase 6: CI/CD Integration (Days 26-30)

**Goal:** Automated performance gates.

**Deliverables:**
- [ ] PR smoke workflow
- [ ] Main-merge load workflow
- [ ] Scheduled soak workflow
- [ ] Performance regression workflow
- [ ] Initial baseline data
- [ ] CODEOWNERS, PR template, Dependabot
- [ ] `docs/adr/005-ci-test-strategy.md`

**Acceptance Criteria:**
- All workflows pass on a clean run
- PR comment shows k6 summary table
- Soak cron does not run on PR
- Regression workflow fails when p95 is inflated beyond the threshold

**Estimated Effort:** 8-10 hours

**Dependencies:** Phase 5

---

## Phase 7: Security & Quality Gates (Days 31-33)

**Goal:** Production-grade security posture consistent with sibling repos.

**Deliverables:**
- [ ] `npm audit` passing with zero moderate+ vulnerabilities
- [ ] CycloneDX SBOM generation
- [ ] OSV scan in CI
- [ ] Strict typecheck and lint gates
- [ ] No explicit `any`

**Acceptance Criteria:**
- CI includes security scan
- SBOM artifact uploaded in CI
- TypeScript strict mode has zero errors
- No unused variables, imports, or parameters in TypeScript files

**Estimated Effort:** 4-5 hours

**Dependencies:** Phase 6

---

## Phase 8: Documentation & Portfolio Polish (Days 34-38)

**Goal:** Recruiter-ready, self-documenting, immediately impressive repository.

**Deliverables:**
- [ ] Complete README with badges, Mermaid architecture diagram, SLO table, test type table, and quick start
- [ ] Architecture and onboarding docs
- [ ] All five ADRs complete and cross-linked from README
- [ ] v0.1.0 release notes
- [ ] GitHub Pages report hosting
- [ ] Repository topics
- [ ] Org profile README updated
- [ ] Final self-assessment against the 10/10 checklist

**Estimated Effort:** 6-8 hours

**Dependencies:** Phase 7
