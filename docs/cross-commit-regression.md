# Cross-Commit Regression Demonstration

Use the existing history comparison tool to compare two pinned revisions without changing baseline
policy.

```bash
git checkout <baseline-commit>
npm ci
npm run load
cp reports/load-results.json /tmp/k6-baseline-load-results.json

git checkout <candidate-commit>
npm ci
npm run load
cp reports/load-results.json /tmp/k6-candidate-load-results.json

node scripts/compare-history.cjs \
  --baseline /tmp/k6-baseline-load-results.json \
  --candidate /tmp/k6-candidate-load-results.json
```

For an offline demonstration, the regression fixtures in `tests/regression-fixtures/` provide a
healthy candidate and a degraded candidate that exercise the same comparison rules without running
k6.
