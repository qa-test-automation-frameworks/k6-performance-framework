'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { aggregateBaselineFiles, aggregateBaselineSamples } = require('../aggregate-baseline.cjs');
const { workloadIdentity } = require('../workload-identity.cjs');
const aggregatorPath = path.resolve(__dirname, '..', 'aggregate-baseline.cjs');

function journeySummary(index, metadataOverrides = {}, summaryOverrides = {}) {
  const metadata = {
    runId: `run-${index}`,
    environment: 'local',
    targetId: 'fixture-target',
    targetCommit: 'target-sha',
    frameworkCommit: 'framework-sha',
    k6Version: '2.0.0',
    runnerClass: 'fixture-runner',
    runnerImage: 'fixture-image-20261021',
    cpuLimitCores: 4,
    memoryLimitBytes: 8_589_934_592,
    workloadName: 'load',
    workloadSchema: 'journey-arrival-v1',
    targetIterationsPerSecond: 20,
    targetRequestsPerSecond: null,
    measurementSeconds: null,
    warmupSeconds: null,
    minimumAchievedFraction: null,
    requestDrainSeconds: null,
    maxVus: 100,
    profile: 'full',
  };
  const metrics = {
    http_req_duration: { 'p(95)': 10 + index, 'p(99)': 20 + index },
    http_req_failed: { rate: 0.001 },
    http_reqs: { count: 300 + index, rate: 30 + index },
    iterations: { count: 100 + index, rate: 10 + index },
    dropped_iterations: { count: 0 },
    custom_article_read_duration_ms: { 'p(95)': 5 + index },
    custom_article_read_success_rate: { rate: 1 },
  };
  return {
    ...summaryOverrides,
    thresholds: {
      http_req_duration: { 'p(95)<100': { ok: true } },
      http_req_failed: { 'rate<0.02': { ok: true } },
    },
    failures: [],
    achievedLoad: null,
    metadata: { ...metadata, ...metadataOverrides, ...summaryOverrides.metadata },
    metrics: { ...metrics, ...summaryOverrides.metrics },
  };
}

function requestRateSummary(index, metadataOverrides = {}, summaryOverrides = {}) {
  const summary = journeySummary(
    index,
    {
      workloadSchema: 'single-request-arrival-v2',
      targetRequestsPerSecond: 20,
      measurementSeconds: 60,
      warmupSeconds: 5,
      minimumAchievedFraction: 0.95,
      requestDrainSeconds: 2,
      ...metadataOverrides,
    },
    summaryOverrides,
  );
  summary.achievedLoad = {
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
  };
  return summary;
}

function samples(summaryFactory = journeySummary) {
  return [1, 2, 3].map((index) => ({
    path: `reports/run-${index}-summary.json`,
    summary: summaryFactory(index),
  }));
}

function cliFixture(t, sourceSummaries) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-aggregate-baseline-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'reports'));
  for (const [index, summary] of sourceSummaries.entries()) {
    fs.writeFileSync(
      path.join(root, 'reports', `run-${index + 1}-summary.json`),
      JSON.stringify(summary, null, 2),
    );
  }
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      private: true,
      scripts: { 'baseline:aggregate': `node ${JSON.stringify(aggregatorPath)}` },
    }),
  );
  return root;
}

function cliEnvironment(root, extra = {}) {
  return {
    ...process.env,
    PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}`,
    BASELINE_OUTPUT: 'artifacts/generated-baseline.json',
    TARGET_ID: 'fixture-target',
    TARGET_COMMIT: 'target-sha',
    TARGET_ENV: 'local',
    FRAMEWORK_COMMIT: 'framework-sha',
    K6_VERSION: '2.0.0',
    RUNNER_CLASS: 'fixture-runner',
    RUNNER_IMAGE: 'fixture-image-20261021',
    WORKLOAD_NAME: 'load',
    CPU_LIMIT_CORES: '4',
    MEMORY_LIMIT_BYTES: '8589934592',
    ...extra,
  };
}

test('three matching native PASS summaries create a provenance-rich aggregate', () => {
  const result = aggregateBaselineSamples(samples(), {
    env: {},
    generatedAt: '2026-10-21T00:00:00.000Z',
  });
  assert.equal(result.generatedAt, '2026-10-21T00:00:00.000Z');
  assert.equal(result.metadata.status, 'measured');
  assert.equal(result.metadata.sampleCount, 3);
  assert.deepEqual(result.metadata.runIds, ['run-1', 'run-2', 'run-3']);
  assert.deepEqual(result.metadata.sourcePaths, [
    'reports/run-1-summary.json',
    'reports/run-2-summary.json',
    'reports/run-3-summary.json',
  ]);
  assert.equal(result.metadata.sourceArtifacts.length, 3);
  assert.equal(result.metadata.sourceSha256['run-1-summary.json'].length, 64);
  assert.equal(result.metadata.environment, 'local');
  assert.equal(result.metadata.targetId, 'fixture-target');
  assert.equal(result.metadata.workload.name, 'load');
  assert.equal(result.metrics.http_req_duration['p(95)'], 12);
  assert.equal(result.metrics.http_reqs.rate, 32);
});

test('each target, runtime, environment, runner and workload identity must match', () => {
  const changes = [
    ['targetId', 'another-target'],
    ['targetCommit', 'another-target-sha'],
    ['environment', 'staging'],
    ['frameworkCommit', 'another-framework-sha'],
    ['k6Version', '2.1.0'],
    ['runnerClass', 'self-hosted'],
    ['workloadName', 'stress'],
    ['runnerImage', 'another-image'],
    ['cpuLimitCores', 8],
    ['memoryLimitBytes', 16_000_000_000],
    ['profile', 'validation'],
    ['targetIterationsPerSecond', 25],
    ['targetRequestsPerSecond', 20],
    ['measurementSeconds', 60],
    ['warmupSeconds', 5],
    ['minimumAchievedFraction', 0.95],
    ['requestDrainSeconds', 2],
    ['maxVus', 120],
    ['workloadSchema', 'unsupported-schema-v9'],
  ];
  for (const [field, value] of changes) {
    const input = samples();
    input[1].summary.metadata[field] = value;
    assert.throws(() => aggregateBaselineSamples(input, { env: {} }), undefined, field);
  }
});

test('required identity rejects missing, empty and unknown values', () => {
  for (const field of [
    'targetId',
    'targetCommit',
    'environment',
    'frameworkCommit',
    'k6Version',
    'runnerClass',
    'workloadName',
    'profile',
  ]) {
    for (const value of ['', 'unknown', undefined]) {
      const input = samples();
      if (value === undefined) delete input[0].summary.metadata[field];
      else input[0].summary.metadata[field] = value;
      assert.throws(
        () => aggregateBaselineSamples(input, { env: {} }),
        undefined,
        `${field}=${value}`,
      );
    }
  }
});

test('run IDs must be present, valid and unique', () => {
  for (const runId of ['', 'unknown', 'bad id', undefined]) {
    const input = samples();
    if (runId === undefined) delete input[0].summary.metadata.runId;
    else input[0].summary.metadata.runId = runId;
    assert.throws(() => aggregateBaselineSamples(input, { env: {} }), /metadata.runId/);
  }
  const duplicate = samples();
  duplicate[1].summary.metadata.runId = duplicate[0].summary.metadata.runId;
  assert.throws(() => aggregateBaselineSamples(duplicate, { env: {} }), /Duplicate runId/);
});

test('duplicate source basenames and incompatible optional resource fields are rejected', () => {
  const duplicateNames = samples();
  duplicateNames[1].path = 'other/run-1-summary.json';
  assert.throws(
    () => aggregateBaselineSamples(duplicateNames, { env: {} }),
    /Duplicate source basename/,
  );

  const missingOptional = samples();
  delete missingOptional[1].summary.metadata.runnerImage;
  assert.throws(
    () => aggregateBaselineSamples(missingOptional, { env: {} }),
    /not present in every input/,
  );
});

test('request-rate runs require valid achieved load and homogeneous request settings', () => {
  const valid = aggregateBaselineSamples(samples(requestRateSummary), { env: {} });
  assert.equal(valid.metadata.workloadSchema, 'single-request-arrival-v2');
  assert.equal(valid.metadata.workload.targetRequestsPerSecond, 20);

  const invalidLoad = samples(requestRateSummary);
  invalidLoad[1].summary.achievedLoad.valid = false;
  invalidLoad[1].summary.achievedLoad.reasons = ['Generator dropped iterations'];
  assert.throws(() => aggregateBaselineSamples(invalidLoad, { env: {} }), /INVALID_LOAD/);

  const missingLoad = samples(requestRateSummary);
  delete missingLoad[0].summary.achievedLoad;
  assert.throws(() => aggregateBaselineSamples(missingLoad, { env: {} }), /INCOMPLETE/);

  const requestIdentityChanges = [
    ['targetIterationsPerSecond', 25],
    ['targetRequestsPerSecond', 25],
    ['measurementSeconds', 90],
    ['warmupSeconds', 10],
    ['minimumAchievedFraction', 0.9],
    ['requestDrainSeconds', 3],
    ['maxVus', 120],
    ['profile', 'validation'],
  ];
  for (const [field, value] of requestIdentityChanges) {
    const mixedRate = samples(requestRateSummary);
    mixedRate[1].summary.metadata[field] = value;
    assert.throws(() => aggregateBaselineSamples(mixedRate, { env: {} }), undefined, field);
  }
});

test('non-finite and negative numeric measurements cannot enter a median', () => {
  for (const value of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const input = samples();
    input[1].summary.metrics.http_req_duration['p(95)'] = value;
    assert.throws(
      () => aggregateBaselineSamples(input, { env: {} }),
      /INVALID_INPUT|finite nonnegative/,
    );
  }
});

test('failed, invalid or incomplete producer summaries are rejected', () => {
  const failed = samples();
  failed[1].summary.failures = ['Checks: 1 failed'];
  assert.throws(() => aggregateBaselineSamples(failed, { env: {} }), /FAIL/);

  const incomplete = samples();
  incomplete[0].summary.thresholds = {};
  assert.throws(() => aggregateBaselineSamples(incomplete, { env: {} }), /INCOMPLETE/);
});

test('legacy workload records remain readable but cannot form a new baseline', () => {
  const identity = workloadIdentity({ targetRps: 20, maxVus: 100, profile: 'full' });
  assert.equal(identity.workloadSchema, 'journey-arrival-v1');
  assert.equal(identity.targetRequestsPerSecond, null);

  const legacy = samples();
  for (const source of legacy) {
    delete source.summary.metadata.workloadSchema;
    source.summary.metadata.targetRps = source.summary.metadata.targetIterationsPerSecond;
    delete source.summary.metadata.targetIterationsPerSecond;
  }
  assert.throws(() => aggregateBaselineSamples(legacy, { env: {} }), /INCOMPLETE/);
});

test('the npm CLI writes a compatible fixture aggregate with canonical paths and raw hashes', (t) => {
  const sourceSummaries = [1, 2, 3].map((index) => journeySummary(index));
  const root = cliFixture(t, sourceSummaries);
  const run = spawnSync(
    'npm',
    [
      'run',
      'baseline:aggregate',
      '--',
      'reports/run-1-summary.json',
      'reports/run-2-summary.json',
      'reports/run-3-summary.json',
    ],
    { cwd: root, encoding: 'utf8', timeout: 15000, env: cliEnvironment(root) },
  );
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  const outputPath = path.join(root, 'artifacts/generated-baseline.json');
  const output = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.deepEqual(output.metadata.sourcePaths, [
    'reports/run-1-summary.json',
    'reports/run-2-summary.json',
    'reports/run-3-summary.json',
  ]);
  assert.equal(output.metadata.frameworkCommit, 'framework-sha');
  assert.equal(output.metadata.runnerImage, 'fixture-image-20261021');
  for (const [index, sourcePath] of output.metadata.sourcePaths.entries()) {
    const sourceBytes = fs.readFileSync(path.join(root, sourcePath));
    const expected = crypto.createHash('sha256').update(sourceBytes).digest('hex');
    assert.equal(
      output.metadata.sourceSha256[path.posix.basename(sourcePath)],
      expected,
      `source ${index + 1}`,
    );
  }
});

test('a mixed target cannot be hidden by TARGET_ID and leaves no output file', (t) => {
  const sourceSummaries = [1, 2, 3].map((index) => journeySummary(index));
  sourceSummaries[1].metadata.targetId = 'mixed-target';
  const root = cliFixture(t, sourceSummaries);
  const outputPath = path.join(root, 'artifacts/generated-baseline.json');
  const run = spawnSync(
    'npm',
    [
      'run',
      'baseline:aggregate',
      '--',
      'reports/run-1-summary.json',
      'reports/run-2-summary.json',
      'reports/run-3-summary.json',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
      env: cliEnvironment(root, { TARGET_ID: 'fixture-target' }),
    },
  );
  assert.notEqual(run.status, 0);
  assert.match(`${run.stdout}\n${run.stderr}`, /Incompatible history|Incompatible targetId/);
  assert.equal(fs.existsSync(outputPath), false);
});

test('in-memory source paths must remain canonical and inside the project', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-paths-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(
    () =>
      aggregateBaselineFiles(['/tmp/outside-summary.json', 'a', 'b'], {
        projectRoot: root,
        env: {},
      }),
    /within the project/,
  );
  const input = samples();
  input[0].path = '../outside/run-summary.json';
  assert.throws(() => aggregateBaselineSamples(input, { env: {} }), /canonical and relative/);
});
