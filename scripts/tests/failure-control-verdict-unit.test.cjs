const test = require('node:test');
const assert = require('node:assert/strict');
const { assertControlVerdict } = require('../failure-control-verdict.cjs');
const { makeRecord, parseJunit } = require('../emit-portfolio-evidence.cjs');

const env = {
  GITHUB_SHA: 'a'.repeat(40),
  GITHUB_RUN_ID: '123456789',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_REPOSITORY: 'qa-test-automation-frameworks/k6-performance-framework',
  GITHUB_WORKFLOW: 'PR smoke',
  GITHUB_WORKFLOW_REF:
    'qa-test-automation-frameworks/k6-performance-framework/.github/workflows/pr-smoke.yml@refs/heads/main',
  K6_VERSION: '2.0.0',
  GITHUB_REF_NAME: 'main',
  GITHUB_EVENT_NAME: 'push',
  EVIDENCE_STARTED_AT: '2026-10-16T10:00:00Z',
  EVIDENCE_COMPLETED_AT: '2026-10-16T10:00:05Z',
};
const controlSummary = {
  generatedAt: '2026-10-16T10:00:04Z',
  failures: ['Checks: 1 failed', 'Threshold: checks: rate>=1 (actual 0)'],
  metrics: { checks: { passes: 0, fails: 1, rate: 0 } },
  metadata: { k6Version: '2.0.0', targetId: 'k6-evidence-failure-fixture' },
};
const rawRecord = () =>
  makeRecord({
    summary: controlSummary,
    env,
    scope: 'k6.evidence-failure-control',
    controlCheckCounts: true,
    required: false,
  });
const junit = (body) => `<testsuites>${body}</testsuites>`;

test('control-check-counts maps the control summary to 1/1/0/1/0', () => {
  const { counts, disposition } = rawRecord().execution;
  assert.equal(disposition, 'failed');
  assert.equal(counts.unit, 'test_case');
  assert.deepEqual(
    [counts.selected, counts.executed, counts.passed, counts.failed, counts.skipped],
    [1, 1, 0, 1, 0],
  );
});

test('control-check-counts needs a checks metric', () => {
  assert.throws(
    () =>
      makeRecord({
        summary: { ...controlSummary, metrics: { http_reqs: { count: 1 } } },
        env,
        scope: 'k6.evidence-failure-control',
        controlCheckCounts: true,
      }),
    /checks\.passes and checks\.fails|no usable native measurements/,
  );
});

test('a passing junit file gives a passed 1/1/1/0/0 record', () => {
  const record = makeRecord({
    junit: parseJunit(junit('<testcase name="a"/>')),
    env,
    scope: 'k6.evidence-failure-control-verification',
  });
  const { counts, disposition } = record.execution;
  assert.equal(disposition, 'passed');
  assert.deepEqual(
    [counts.selected, counts.executed, counts.passed, counts.failed, counts.skipped],
    [1, 1, 1, 0, 0],
  );
});

test('a junit failure gives a failed record', () => {
  const record = makeRecord({
    junit: parseJunit(junit('<testcase name="a"><failure message="x"/></testcase>')),
    env,
    scope: 'k6.evidence-failure-control-verification',
  });
  assert.equal(record.execution.disposition, 'failed');
  assert.equal(record.execution.counts.failed, 1);
});

test('malformed or empty junit input is rejected', () => {
  assert.throws(() => parseJunit('not xml'), /no testsuite root/);
  assert.throws(() => parseJunit('<testsuites></testsuites>'), /no testcases/);
});

test('the verdict accepts the deliberate failure', () => {
  assertControlVerdict({ record: rawRecord(), summary: controlSummary, env });
});

test('the verdict rejects a control that did not fail, a wrong attempt, and a required record', () => {
  const passing = rawRecord();
  passing.execution.counts.failed = 0;
  assert.throws(
    () => assertControlVerdict({ record: passing, summary: controlSummary, env }),
    /counts must be 1\/1\/0\/1\/0/,
  );
  assert.throws(
    () =>
      assertControlVerdict({
        record: rawRecord(),
        summary: controlSummary,
        env: { ...env, GITHUB_RUN_ATTEMPT: '2' },
      }),
    /attempt differs/,
  );
  const required = rawRecord();
  required.scope.required = true;
  assert.throws(
    () => assertControlVerdict({ record: required, summary: controlSummary, env }),
    /must not be required/,
  );
});
