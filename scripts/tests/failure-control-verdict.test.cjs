const fs = require('node:fs');
const test = require('node:test');
const { assertControlVerdict } = require('../failure-control-verdict.cjs');

test('the raw failure-control record shows exactly the deliberate failure', () => {
  const record = JSON.parse(fs.readFileSync('reports/evidence/k6.evidence-failure-control.json', 'utf8'));
  const summary = JSON.parse(fs.readFileSync('reports/evidence-failure-control-summary.json', 'utf8'));
  assertControlVerdict({ record, summary, env: process.env });
});
