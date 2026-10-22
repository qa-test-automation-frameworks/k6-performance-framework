'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { classifySummary } = require('../report-disposition.cjs');
const builderPath = path.resolve(__dirname, '..', 'build-report-site.cjs');
const counterexamplePath = path.join(__dirname, 'fixtures', 'failing-summary.json');

function goodSummary(overrides = {}) {
  return {
    metadata: { workloadSchema: 'journey-arrival-v1', targetId: 'fixture', profile: 'smoke' },
    metrics: {
      http_req_duration: { 'p(95)': 10, 'p(99)': 20 },
      http_req_failed: { rate: 0 },
      http_reqs: { rate: 30 },
      dropped_iterations: { count: 0 },
    },
    thresholds: { http_req_duration: { 'p(95)<100': { ok: true } } },
    failures: [],
    achievedLoad: null,
    ...overrides,
  };
}

test('classifies a valid native-threshold journey run as PASS', () => {
  assert.deepEqual(classifySummary(goodSummary()), {
    status: 'PASS',
    thresholdStatus: 'PASS',
    loadStatus: 'NOT_APPLICABLE',
    reasons: [],
  });
});

test('a native failed threshold is FAIL even when the producer failures array is empty', () => {
  const result = classifySummary(
    goodSummary({ thresholds: { http_req_duration: { 'p(95)<1': { ok: false } } } }),
  );
  assert.equal(result.status, 'FAIL');
  assert.equal(result.thresholdStatus, 'FAIL');
  assert.match(result.reasons.join(' '), /Native threshold failed/);
});

test('producer failures prevent PASS when all native thresholds pass', () => {
  const result = classifySummary(goodSummary({ failures: ['A check failed.'] }));
  assert.equal(result.status, 'FAIL');
  assert.equal(result.thresholdStatus, 'PASS');
  assert.match(result.reasons.join(' '), /A check failed/);
});

test('invalid achieved load takes precedence over otherwise passing thresholds', () => {
  const result = classifySummary(
    goodSummary({ achievedLoad: { valid: false, reasons: ['Generator dropped iterations'] } }),
  );
  assert.equal(result.status, 'INVALID_LOAD');
  assert.equal(result.thresholdStatus, 'PASS');
  assert.equal(result.loadStatus, 'INVALID');
  assert.match(result.reasons.join(' '), /Generator dropped iterations/);
});

test('empty and nested-empty threshold maps are INCOMPLETE', () => {
  for (const thresholds of [{}, { http_req_duration: {} }]) {
    const result = classifySummary(goodSummary({ thresholds }));
    assert.equal(result.status, 'INCOMPLETE');
    assert.equal(result.thresholdStatus, 'INCOMPLETE');
  }
});

test('malformed thresholds and non-boolean native ok values are INVALID_INPUT', () => {
  for (const thresholds of [null, { latency: { limit: { ok: 'true' } } }]) {
    const result = classifySummary(goodSummary({ thresholds }));
    assert.equal(result.status, 'INVALID_INPUT');
    assert.equal(result.thresholdStatus, 'INVALID_INPUT');
  }
});

test('missing failures are INCOMPLETE instead of being assumed empty', () => {
  const summary = goodSummary();
  delete summary.failures;
  const result = classifySummary(summary);
  assert.equal(result.status, 'INCOMPLETE');
  assert.match(result.reasons.join(' '), /failures array is missing/);
});

test('missing workload schema is INCOMPLETE and an unsupported schema is INVALID_INPUT', () => {
  const missing = classifySummary(
    goodSummary({ metadata: { targetId: 'fixture', profile: 'smoke' } }),
  );
  assert.equal(missing.status, 'INCOMPLETE');
  assert.match(missing.reasons.join(' '), /Workload schema is missing/);

  const unsupported = classifySummary(
    goodSummary({ metadata: { workloadSchema: 'unknown-arrival-v9' } }),
  );
  assert.equal(unsupported.status, 'INVALID_INPUT');
});

test('request-rate workloads require an achieved-load object', () => {
  const summary = goodSummary({ metadata: { workloadSchema: 'single-request-arrival-v2' } });
  delete summary.achievedLoad;
  const result = classifySummary(summary);
  assert.equal(result.status, 'INCOMPLETE');
  assert.equal(result.loadStatus, 'MISSING');
});

test('a valid achieved-load object permits request-rate PASS', () => {
  const result = classifySummary(
    goodSummary({
      metadata: { workloadSchema: 'single-request-arrival-v2' },
      achievedLoad: {
        valid: true,
        reasons: [],
        configuredRequestsPerSecond: 20,
        measurementSeconds: 60,
        minimumAchievedFraction: 0.95,
        completedIterations: 1200,
        startedRequests: 1200,
        requests: 1200,
        droppedIterations: 0,
        achievedIterationsPerSecond: 20,
        achievedRequestsPerSecond: 20,
      },
    }),
  );
  assert.equal(result.status, 'PASS');
  assert.equal(result.loadStatus, 'VALID');
});

test('journey workload achievedLoad null is explicitly not applicable', () => {
  const result = classifySummary(goodSummary({ achievedLoad: null }));
  assert.equal(result.status, 'PASS');
  assert.equal(result.loadStatus, 'NOT_APPLICABLE');
});

test('malformed display metrics and malformed achieved-load fields are INVALID_INPUT', () => {
  const badMetric = classifySummary(goodSummary({ metrics: { http_req_failed: { rate: 1.2 } } }));
  assert.equal(badMetric.status, 'INVALID_INPUT');
  assert.match(badMetric.reasons.join(' '), /metrics.http_req_failed.rate/);

  const badLoad = classifySummary(goodSummary({ achievedLoad: { valid: 'yes', reasons: [] } }));
  assert.equal(badLoad.status, 'INVALID_INPUT');
  assert.equal(badLoad.loadStatus, 'INVALID_INPUT');
});

test('the retained synthetic failure counterexample cannot render PASS', () => {
  const summary = JSON.parse(fs.readFileSync(counterexamplePath, 'utf8'));
  const result = classifySummary(summary);
  assert.equal(result.status, 'INVALID_LOAD');
  assert.notEqual(result.status, 'PASS');
  assert.equal(result.loadStatus, 'INVALID');
});

test('site build keeps valid reports visible beside malformed input and escapes HTML', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-report-site-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.mkdirSync(path.join(directory, 'reports'));
  fs.mkdirSync(path.join(directory, 'baseline'));
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({
      name: 'report-site-fixture',
      private: true,
      scripts: { 'report:site': `node ${JSON.stringify(builderPath)}` },
    }),
  );
  fs.writeFileSync(
    path.join(directory, 'reports', 'valid-summary.json'),
    JSON.stringify(goodSummary()),
  );
  fs.writeFileSync(path.join(directory, 'reports', 'broken-summary.json'), '{ invalid json');

  const counterexample = JSON.parse(fs.readFileSync(counterexamplePath, 'utf8'));
  fs.writeFileSync(
    path.join(directory, 'reports', 'failing-summary.json'),
    JSON.stringify(counterexample),
  );
  fs.writeFileSync(
    path.join(directory, 'reports', 'evil<img src=x onerror=alert(1)>-summary.json'),
    JSON.stringify(goodSummary({ failures: ['<svg onload=alert(1)>'] })),
  );
  const legacyAggregate = goodSummary({
    metadata: {
      status: 'measured',
      sampleCount: 3,
      targetId: 'historical-target',
      workload: { profile: 'full' },
    },
  });
  delete legacyAggregate.thresholds;
  delete legacyAggregate.failures;
  delete legacyAggregate.achievedLoad;
  fs.writeFileSync(
    path.join(directory, 'baseline', 'load-summary.json'),
    JSON.stringify(legacyAggregate),
  );

  const run = spawnSync('npm', ['run', 'report:site'], {
    cwd: directory,
    encoding: 'utf8',
    timeout: 15000,
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

  const html = fs.readFileSync(path.join(directory, 'site', 'index.html'), 'utf8');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(directory, 'site', 'report-manifest.json'), 'utf8'),
  );
  const byName = Object.fromEntries(manifest.reports.map((report) => [report.name, report]));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(byName['valid-summary.json'].disposition.status, 'PASS');
  assert.equal(byName['broken-summary.json'].disposition.status, 'INVALID_INPUT');
  assert.equal(byName['broken-summary.json'].disposition.thresholdStatus, 'INVALID_INPUT');
  assert.equal(byName['broken-summary.json'].disposition.loadStatus, 'INVALID_INPUT');
  assert.match(byName['broken-summary.json'].disposition.reasons.join(' '), /Invalid JSON/);
  assert.equal(byName['failing-summary.json'].disposition.status, 'INVALID_LOAD');
  assert.notEqual(byName['failing-summary.json'].disposition.status, 'PASS');
  assert.equal(byName['load-summary.json'].kind, 'legacy-aggregate');
  assert.equal(byName['load-summary.json'].disposition.status, 'INCOMPLETE');
  assert.match(
    byName['failing-summary.json'].disposition.reasons.join(' '),
    /Threshold failure: synthetic audit control/,
  );
  assert.match(html, /broken-summary\.json/);
  assert.match(html, /Invalid JSON/);
  assert.match(html, /failing-summary\.json/);
  assert.match(html, /INVALID LOAD/);
  assert.match(html, /Threshold failure: synthetic audit control/);
  assert.match(html, /historical aggregate/);
  assert.match(html, /evil&lt;img src=x onerror=alert\(1\)&gt;-summary\.json/);
  assert.match(html, /&lt;svg onload=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<svg onload=alert\(1\)>/);
  assert.doesNotMatch(html, /evil<img src=x onerror=alert\(1\)>/);

  const expectedHash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(directory, 'reports', 'failing-summary.json')))
    .digest('hex');
  assert.equal(byName['failing-summary.json'].sourceSha256, expectedHash);
});
