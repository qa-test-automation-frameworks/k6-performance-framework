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

function readMetric(file, metric, key) {
  const summary = JSON.parse(fs.readFileSync(file, 'utf8'));
  const value = summary.metrics?.[metric]?.[key];
  if (typeof value !== 'number') {
    throw new Error(`${file} is missing ${metric}.${key}`);
  }
  return value;
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
    frameworkCommit: process.env.FRAMEWORK_COMMIT ?? 'unknown',
    k6Version: process.env.K6_VERSION ?? '2.0.0',
    runner: process.env.RUNNER_IMAGE ?? process.platform,
    workload: {
      targetRps: Number(process.env.TARGET_RPS || '20'),
      maxVus: Number(process.env.MAX_VUS || '100'),
      profile: process.env.TEST_PROFILE ?? 'full',
    },
  },
  metrics: {
    http_req_duration: {
      'p(95)': median(inputs.map((file) => readMetric(file, 'http_req_duration', 'p(95)'))),
      'p(99)': median(inputs.map((file) => readMetric(file, 'http_req_duration', 'p(99)'))),
    },
    http_req_failed: {
      rate: median(inputs.map((file) => readMetric(file, 'http_req_failed', 'rate'))),
    },
    http_reqs: {
      count: median(inputs.map((file) => readMetric(file, 'http_reqs', 'count'))),
      rate: median(inputs.map((file) => readMetric(file, 'http_reqs', 'rate'))),
    },
    iterations: {
      count: median(inputs.map((file) => readMetric(file, 'iterations', 'count'))),
      rate: median(inputs.map((file) => readMetric(file, 'iterations', 'rate'))),
    },
    dropped_iterations: {
      count: median(inputs.map((file) => readMetric(file, 'dropped_iterations', 'count'))),
    },
  },
};

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(`Wrote measured baseline from ${inputs.length} controlled runs`);
