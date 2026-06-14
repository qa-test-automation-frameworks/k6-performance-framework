const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const inputs = process.argv.slice(2);
const output = process.env.BASELINE_OUTPUT || 'baseline/load-summary.json';
if (inputs.length < 3) {
  throw new Error(
    'usage: node scripts/aggregate-baseline.cjs <summary-1.json> <summary-2.json> <summary-3.json> [...]',
  );
}

const summaries = inputs.map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));

function readMetric(summary, file, metric, key) {
  const value = summary.metrics?.[metric]?.[key];
  if (typeof value !== 'number') {
    throw new Error(`${file} is missing ${metric}.${key}`);
  }
  return value;
}

function commonMetricKeys() {
  const firstMetrics = summaries[0]?.metrics ?? {};
  return Object.entries(firstMetrics)
    .filter(([name, values]) => {
      const keys = Object.keys(values);
      const isLatency =
        name === 'http_req_duration' ||
        name.startsWith('http_req_duration{name:') ||
        (name.startsWith('custom_') && name.endsWith('_duration_ms'));
      const isFailure =
        name === 'http_req_failed' ||
        name.startsWith('http_req_failed{name:') ||
        (name.startsWith('custom_') && name.endsWith('_success_rate'));
      return (
        (isLatency && keys.some((key) => key === 'p(95)' || key === 'p(99)')) ||
        (isFailure && keys.includes('rate'))
      );
    })
    .map(([name]) => name)
    .filter((name) => summaries.every((summary) => summary.metrics?.[name]));
}

function aggregateMetric(metric) {
  const keys = new Set(summaries.flatMap((summary) => Object.keys(summary.metrics[metric] ?? {})));
  return Object.fromEntries(
    [...keys]
      .filter((key) => ['p(95)', 'p(99)', 'rate'].includes(key))
      .map((key) => [
        key,
        median(summaries.map((summary, index) => readMetric(summary, inputs[index], metric, key))),
      ]),
  );
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const baseline = {
  generatedAt: new Date().toISOString(),
  metadata: {
    status: 'measured',
    sampleCount: inputs.length,
    sourceFiles: inputs.map((file) => path.basename(file)),
    sourceSha256: Object.fromEntries(inputs.map((file) => [path.basename(file), sha256(file)])),
    targetCommit: process.env.TARGET_COMMIT ?? 'unknown',
    targetId: process.env.TARGET_ID ?? 'realworld-local',
    frameworkCommit: process.env.FRAMEWORK_COMMIT ?? 'unknown',
    k6Version: process.env.K6_VERSION ?? '2.0.0',
    runner: process.env.RUNNER_IMAGE ?? process.platform,
    runnerClass: process.env.RUNNER_CLASS ?? 'github-hosted',
    workload: {
      name: process.env.WORKLOAD_NAME ?? process.env.SUMMARY_NAME ?? 'load',
      targetRps: Number(process.env.TARGET_RPS || '20'),
      maxVus: Number(process.env.MAX_VUS || '100'),
      profile: process.env.TEST_PROFILE ?? 'full',
    },
  },
  metrics: {
    ...Object.fromEntries(commonMetricKeys().map((metric) => [metric, aggregateMetric(metric)])),
    http_reqs: {
      count: median(
        summaries.map((summary, index) => readMetric(summary, inputs[index], 'http_reqs', 'count')),
      ),
      rate: median(
        summaries.map((summary, index) => readMetric(summary, inputs[index], 'http_reqs', 'rate')),
      ),
    },
    iterations: {
      count: median(
        summaries.map((summary, index) =>
          readMetric(summary, inputs[index], 'iterations', 'count'),
        ),
      ),
      rate: median(
        summaries.map((summary, index) => readMetric(summary, inputs[index], 'iterations', 'rate')),
      ),
    },
    dropped_iterations: {
      count: median(
        summaries.map((summary, index) =>
          readMetric(summary, inputs[index], 'dropped_iterations', 'count'),
        ),
      ),
    },
  },
};

if (process.env.WORKFLOW_RUN_URL) {
  baseline.metadata.workflowRun = process.env.WORKFLOW_RUN_URL;
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`Wrote measured baseline from ${inputs.length} controlled runs`);
