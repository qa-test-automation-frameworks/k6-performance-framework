const fs = require('node:fs');
const path = require('node:path');

const repository = 'qa-test-automation-frameworks/k6-performance-framework';
const outputDirectory = 'reports/evidence';
const metricFields = [
  ['avg', 'average'],
  ['med', 'median'],
  ['p(90)', 'p90'],
  ['p(95)', 'p95'],
  ['p(99)', 'p99'],
  ['min', 'minimum'],
  ['max', 'maximum'],
  ['rate', 'rate'],
  ['count', 'count'],
  ['passes', 'passes'],
  ['fails', 'fails'],
  ['value', 'value'],
];

function fail(message) {
  throw new Error(message);
}

function iso(value, name) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
    fail(`${name} is missing or invalid`);
  return new Date(value).toISOString();
}

function measurementUnit(metric, field) {
  if (/duration|_ms$/.test(metric)) return 'ms';
  if (field === 'rate')
    return metric === 'checks' || metric === 'http_req_failed' ? 'ratio' : 'per_second';
  if (
    (metric === 'checks' || metric === 'http_req_failed') &&
    !['count', 'passes', 'fails'].includes(field)
  )
    return 'ratio';
  return 'count';
}

function sanitizeMetric(metric, field) {
  const name = `${metric}.${field}`.replace(/[^A-Za-z0-9_.:/@+-]/g, '_');
  return name.slice(0, 200);
}

function sampleCount(summary, metric, values) {
  if (Number.isSafeInteger(values.count) && values.count > 0) return values.count;
  if (
    Number.isSafeInteger(values.passes) &&
    values.passes >= 0 &&
    Number.isSafeInteger(values.fails) &&
    values.fails >= 0 &&
    values.passes + values.fails > 0
  )
    return values.passes + values.fails;
  if (/^http_req_duration(?:\{.*\})?$/.test(metric)) {
    const requestMetric = metric.replace(/^http_req_duration/, 'http_reqs');
    const count = summary.metrics[requestMetric]?.count;
    if (Number.isSafeInteger(count) && count > 0) return count;
  }
  if (metric === 'iteration_duration') {
    const count = summary.metrics.iterations?.count;
    if (Number.isSafeInteger(count) && count > 0) return count;
  }
  return null;
}

function measurementsFrom(summary) {
  const measurements = [];
  if (!summary.metrics || typeof summary.metrics !== 'object')
    fail('summary has no metrics object');
  for (const [metric, values] of Object.entries(summary.metrics)) {
    if (!values || typeof values !== 'object') continue;
    const count = sampleCount(summary, metric, values);
    for (const [key, field] of metricFields) {
      const value = values[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || count === null)
        continue;
      measurements.push({
        name: sanitizeMetric(metric, field),
        value,
        unit: measurementUnit(metric, key),
        sampleCount: count,
        semantics: `Native k6 summary metric ${metric} ${field}; sampleCount is the metric's native count.`,
      });
    }
  }
  if (measurements.length === 0) fail('summary contains no usable native measurements');
  if (new Set(measurements.map((item) => item.name)).size !== measurements.length)
    fail('metric names collide after sanitization');
  return measurements;
}

function makeRecord({
  summary,
  env = process.env,
  scope,
  unavailableReason,
  evidenceClass = 'scheduled_load',
  required = true,
}) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:/@+-]{0,199}$/.test(scope ?? ''))
    fail('scope is missing or invalid');
  if (
    !['hermetic', 'controlled', 'credentialed', 'scheduled_live', 'scheduled_load'].includes(
      evidenceClass,
    )
  )
    fail('evidence class is invalid');
  if (typeof required !== 'boolean') fail('required must be boolean');
  const sourceSha = env.GITHUB_SHA;
  const runId = env.GITHUB_RUN_ID;
  const attempt = Number(env.GITHUB_RUN_ATTEMPT);
  if (
    !/^[0-9a-f]{40}$/.test(sourceSha ?? '') ||
    !/^[1-9][0-9]*$/.test(runId ?? '') ||
    !Number.isSafeInteger(attempt) ||
    attempt < 1
  ) {
    fail('GitHub run/source identity is missing or invalid');
  }
  if (env.GITHUB_REPOSITORY !== repository) fail('unexpected repository identity');
  const workflowName = env.GITHUB_WORKFLOW ?? 'k6 performance workflow';
  const branch = env.GITHUB_REF_NAME ?? 'unknown';
  const start = env.EVIDENCE_STARTED_AT;
  const runUrl = `https://github.com/${repository}/actions/runs/${runId}`;
  const recordedK6Version = summary?.metadata?.k6Version ?? env.K6_VERSION;
  if (!unavailableReason && (!env.K6_VERSION || !env.GITHUB_WORKFLOW_REF)) {
    fail('attempted execution is missing the actual k6 version or workflow identity');
  }
  if (!unavailableReason && recordedK6Version !== env.K6_VERSION) {
    fail('summary k6 version differs from the observed runtime version');
  }
  let execution;
  let target = {
    identity: summary?.metadata?.targetId ?? env.TARGET_ID ?? 'unknown-target',
    revision: summary?.metadata?.targetCommit ?? env.TARGET_COMMIT ?? null,
    fixtureVersion: null,
    environment: summary?.metadata?.environment ?? env.TARGET_ENV ?? 'unknown',
    profile: summary?.metadata?.profile ?? env.TEST_PROFILE ?? null,
    tools: {
      k6: recordedK6Version ?? 'unknown',
      node: process.version,
    },
  };
  if (unavailableReason) {
    execution = {
      disposition: 'unavailable',
      reason: unavailableReason.slice(0, 500),
      startedAt: null,
      completedAt: null,
      integrity: 'unavailable',
      counts: {
        unit: 'not_applicable',
        selected: null,
        executed: null,
        passed: null,
        failed: null,
        skipped: null,
        retried: null,
        semantics: 'Performance workload; case counts do not apply.',
      },
      measurements: [],
      shards: { expected: [scope], received: [] },
    };
  } else {
    if (!summary || typeof summary !== 'object') fail('summary is missing');
    const startedAt = iso(start, 'EVIDENCE_STARTED_AT');
    const completedAt = iso(summary.generatedAt, 'summary.generatedAt');
    if (Date.parse(completedAt) < Date.parse(startedAt))
      fail('summary completion precedes recorded start');
    const measurements = measurementsFrom(summary);
    const failures = Array.isArray(summary.failures) ? summary.failures : null;
    if (!failures) fail('summary failures must be an array');
    const disposition = failures.length ? 'failed' : 'passed';
    execution = {
      disposition,
      reason:
        disposition === 'failed'
          ? failures.map(String).join('; ').slice(0, 500) || 'k6 thresholds or checks failed'
          : null,
      startedAt,
      completedAt,
      integrity: 'complete',
      counts: {
        unit: 'not_applicable',
        selected: null,
        executed: null,
        passed: null,
        failed: null,
        skipped: null,
        retried: null,
        semantics:
          'Performance workload; virtual users, iterations, and requests are represented by native measurements, not test-case counts.',
      },
      measurements,
      shards: { expected: [scope], received: [scope] },
    };
  }
  return {
    schemaVersion: 3,
    repository,
    sourceSha,
    limitations: [
      'Performance metrics are workload measurements, not test-case outcomes.',
      'Threshold outcomes are derived from the framework summary; raw k6 output must be retained separately for full reanalysis.',
    ],
    kind: 'execution',
    workflow: {
      id: env.GITHUB_WORKFLOW_REF ?? `${repository}/.github/workflows/unknown`,
      name: workflowName,
      runId,
      attempt,
      url: runUrl,
      trigger: env.GITHUB_EVENT_NAME ?? 'unknown',
      branch,
    },
    scope: { id: scope, evidenceClass, required, freshnessPolicy: 'daily_gate_v1' },
    target,
    execution,
    publication: {
      disposition: 'pending',
      reason: 'E03 durable publication is not implemented for this repository.',
      publishedAt: null,
      reportUrl: null,
      artifacts: [],
    },
    generator: { name: 'k6-portfolio-evidence', version: '1.0.0' },
  };
}

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (
      ![
        '--summary',
        '--scope',
        '--unavailable-reason',
        '--output',
        '--class',
        '--optional',
      ].includes(key)
    )
      fail(`unknown argument ${key}`);
    if (key === '--optional') {
      options.required = false;
      continue;
    }
    const value = args[i + 1];
    if (!value || value.startsWith('--')) fail(`${key} requires a value`);
    options[key.slice(2)] = value;
    i += 1;
  }
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (
    !options.scope ||
    (!options.summary && !options['unavailable-reason']) ||
    (options.summary && options['unavailable-reason'])
  ) {
    fail(
      'Usage: node scripts/emit-portfolio-evidence.cjs --scope <id> (--summary <file> | --unavailable-reason <text>) [--class <class>] [--optional] [--output <file>]',
    );
  }
  const summary = options.summary ? JSON.parse(fs.readFileSync(options.summary, 'utf8')) : null;
  const record = makeRecord({
    summary,
    scope: options.scope,
    evidenceClass: options.class ?? 'scheduled_load',
    required: options.required ?? true,
    unavailableReason: options['unavailable-reason'],
  });
  const filename = options.scope.replaceAll('/', '_').replaceAll(':', '_');
  const output = options.output ?? path.join(outputDirectory, `${filename}.json`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, `${JSON.stringify(record, null, 2)}\n`);
  if (record.execution.disposition === 'unavailable') process.exitCode = 1;
}

module.exports = { makeRecord, measurementsFrom };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
