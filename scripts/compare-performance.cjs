const fs = require('node:fs');

const baselinePath = process.env.BASELINE_FILE || 'baseline/load-summary.json';
const candidatePath = process.env.CANDIDATE_FILE || 'reports/load-summary.json';
const tolerance = Number(process.env.REGRESSION_TOLERANCE || '0.20');

function read(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function value(summary, metric, key) {
  const result = summary.metrics?.[metric]?.[key];
  if (typeof result !== 'number') throw new Error(`Missing ${metric}.${key}`);
  return result;
}

const baseline = read(baselinePath);
const candidate = read(candidatePath);
if (baseline.metadata?.status !== 'measured' || baseline.metadata?.sampleCount < 3) {
  throw new Error('Baseline must contain at least three measured controlled runs');
}
const comparisons = [
  ['p95', value(baseline, 'http_req_duration', 'p(95)'), value(candidate, 'http_req_duration', 'p(95)')],
  ['p99', value(baseline, 'http_req_duration', 'p(99)'), value(candidate, 'http_req_duration', 'p(99)')],
];
const failures = comparisons.filter(([, before, after]) => after > before * (1 + tolerance));
const errorRate = value(candidate, 'http_req_failed', 'rate');

console.log('| Metric | Baseline | Candidate | Change |');
console.log('|---|---:|---:|---:|');
for (const [name, before, after] of comparisons) {
  console.log(`| ${name} | ${before.toFixed(2)} | ${after.toFixed(2)} | ${(((after / before) - 1) * 100).toFixed(1)}% |`);
}
if (errorRate >= 0.02) failures.push(['error rate', 0.02, errorRate]);
if (failures.length) {
  console.error(`Performance regression detected: ${failures.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
