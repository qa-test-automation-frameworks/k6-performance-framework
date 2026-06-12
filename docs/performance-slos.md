# Performance Service-Level Objectives

| Endpoint group |       p95 |       p99 | Error rate |
| -------------- | --------: | --------: | ---------: |
| Authentication |  < 800 ms | < 1500 ms |       < 1% |
| Article reads  |  < 500 ms | < 1000 ms |       < 1% |
| Article writes | < 1000 ms | < 2000 ms |       < 2% |
| Comments       |  < 750 ms | < 1500 ms |       < 2% |
| Profiles       |  < 500 ms | < 1000 ms |       < 1% |
| Tags           |  < 300 ms |  < 750 ms |       < 1% |

Smoke tests abort quickly when checks, latency, or request failure thresholds breach. Load tests
enforce the primary p95 and p99 objectives; stress and breakpoint tests intentionally identify the
point at which these objectives degrade.
