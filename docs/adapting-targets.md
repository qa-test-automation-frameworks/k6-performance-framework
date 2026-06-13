# Adapting The Framework To Another API

The framework isolates target-specific behavior behind configuration, typed services, scenarios,
and thresholds. A fork should preserve the transport, workload, reporting, and CI layers.

1. Add target environments under `config/environments/` and keep non-local authorization enabled.
2. Replace the contracts in `src/types/api.types.ts` with the target's request/response envelopes.
3. Implement endpoint services under `src/api/`; tests must not call `k6/http` directly.
4. Compose business journeys under `src/scenarios/` and inject services for unit tests.
5. Define endpoint names and bounded tags before creating dashboards or baselines.
6. Calibrate thresholds from at least three controlled seeded runs and record provenance.
7. Update the controlled-target startup script and target commit in baseline metadata.
8. Run validation profiles, observability integration, and the regression fixture suite before full
   load.

## Review Checklist

- Functional checks reject broken transactions.
- Writes and sustained traffic require an authorized target.
- Every workload has a validation profile and graceful shutdown.
- Baseline source summaries and hashes are retained.
- Dashboard queries isolate environment and run ID.
- Public helpers expose explicit TypeScript contracts.

Independent reviews and target adapters should be proposed through pull requests with the target,
workload assumptions, and measured evidence described in the PR body.
