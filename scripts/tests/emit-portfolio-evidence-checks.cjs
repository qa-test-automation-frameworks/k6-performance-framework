const test = require('node:test');
const assert = require('node:assert/strict');
const { makeRecord } = require('../emit-portfolio-evidence.cjs');

const env = {
  GITHUB_SHA: 'a'.repeat(40),
  GITHUB_RUN_ID: '123456789',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_REPOSITORY: 'qa-test-automation-frameworks/k6-performance-framework',
  GITHUB_WORKFLOW: 'Main load',
  GITHUB_WORKFLOW_REF:
    'qa-test-automation-frameworks/k6-performance-framework/.github/workflows/main-load.yml@refs/heads/main',
  K6_VERSION: '2.0.0',
  GITHUB_REF_NAME: 'main',
  GITHUB_EVENT_NAME: 'push',
  EVIDENCE_STARTED_AT: '2026-10-16T10:00:00Z',
};
const summary = {
  generatedAt: '2026-10-16T10:01:00Z',
  failures: [],
  metrics: {
    http_req_duration: { avg: 20, count: 8, med: 19, 'p(95)': 31, rate: 0.2 },
    http_reqs: { count: 8, rate: 4 },
    checks: { count: 8, fails: 0, passes: 8, rate: 1 },
  },
  metadata: {
    environment: 'local',
    frameworkCommit: env.GITHUB_SHA,
    k6Version: '2.0.0',
    profile: 'validation',
    targetCommit: 'b'.repeat(40),
    targetId: 'realworld-local',
    runnerClass: 'github-hosted',
  },
};

test('maps passing performance measurements without inventing test case counts', () => {
  const record = makeRecord({ summary, env, scope: 'k6.main-load' });
  assert.equal(record.execution.disposition, 'passed');
  assert.equal(record.execution.integrity, 'complete');
  assert.equal(record.execution.counts.unit, 'not_applicable');
  assert.equal(record.execution.counts.executed, null);
  assert.equal(
    record.execution.measurements.find((item) => item.name === 'http_req_duration.p95').value,
    31,
  );
  assert.equal(
    record.execution.measurements.find((item) => item.name === 'http_reqs.rate').unit,
    'per_second',
  );
  assert.equal(
    record.execution.measurements.find((item) => item.name === 'checks.rate').unit,
    'ratio',
  );
  assert.equal(
    record.execution.measurements.find((item) => item.name === 'checks.count').unit,
    'count',
  );
  assert.deepEqual(record.execution.shards.received, ['k6.main-load']);
});

test('preserves failed threshold and check outcomes as failed evidence', () => {
  const record = makeRecord({
    summary: { ...summary, failures: ['Threshold: http_req_duration p(95)'] },
    env,
    scope: 'k6.main-load',
  });
  assert.equal(record.execution.disposition, 'failed');
  assert.match(record.execution.reason, /Threshold/);
  assert.equal(record.execution.measurements.length > 0, true);
  assert.deepEqual(validateRecord(record), []);
});

test('rejects missing native metrics and invalid source identity', () => {
  assert.throws(
    () => makeRecord({ summary: { ...summary, metrics: {} }, env, scope: 'k6.main-load' }),
    /no usable native measurements/,
  );
  assert.throws(
    () => makeRecord({ summary, env: { ...env, GITHUB_SHA: 'unknown' }, scope: 'k6.main-load' }),
    /source identity/,
  );
});

test('emits no-execution evidence without fabricated metrics', () => {
  const record = makeRecord({
    summary: null,
    env,
    scope: 'k6.main-load',
    unavailableReason: 'Native summary was not generated',
  });
  assert.equal(record.execution.disposition, 'unavailable');
  assert.equal(record.execution.integrity, 'unavailable');
  assert.deepEqual(record.execution.measurements, []);
  assert.equal(record.execution.counts.executed, null);
  assert.deepEqual(validateRecord(record), []);
});

const { validateRecord } = require('../validate-portfolio-evidence.cjs');

test('validates generated records against the pinned v3 contract', () => {
  const record = makeRecord({ summary, env, scope: 'k6.main-load' });
  assert.deepEqual(validateRecord(record), []);
});

test('rejects missing shards and forged test counts', () => {
  const incomplete = makeRecord({ summary, env, scope: 'k6.main-load' });
  incomplete.execution.shards.received = [];
  assert.ok(validateRecord(incomplete).some((error) => error.includes('complete evidence')));
  const forged = makeRecord({ summary, env, scope: 'k6.main-load' });
  forged.execution.counts.executed = 4;
  assert.ok(validateRecord(forged).some((error) => error.includes('must not invent test counts')));
});
