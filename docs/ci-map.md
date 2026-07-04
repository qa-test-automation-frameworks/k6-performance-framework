# CI Workflow Map

| Workflow | Trigger | Purpose | Required for PR |
| --- | --- | --- | --- |
| `pr-smoke.yml` | Pull request | Fast build, typecheck, unit, and smoke validation | Yes |
| `quality.yml` | Pull request and push | Static checks, package governance, release metadata | Yes |
| `security.yml` | Pull request and schedule | Secret scan, dependency review, SBOM/security checks | Yes |
| `segmented-validation.yml` | Pull request and push | Bounded validation runs by workload tier | Yes |
| `main-load.yml` | Push to main and manual | Controlled full load run | No |
| `performance-regression.yml` | Push to main and manual | Compare current results against retained baseline | No |
| `capture-baseline.yml` | Manual | Refresh baseline artifacts after review | No |
| `distributed-load.yml` | Manual | Multi-runner scale experiment | No |
| `observability.yml` | Manual | Grafana/Influx/Prometheus evidence capture | No |
| `scheduled-soak.yml` | Schedule | Long-duration stability signal | No |
| `release.yml` | Tag/manual | Release validation and publication assets | No |
| `pages.yml` | Push to main | Publish report site | No |

PR workflows stay short and deterministic. Main-branch and manual workflows produce heavier
performance evidence and baseline updates after the fast gate has already passed.
