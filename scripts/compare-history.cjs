const fs = require('node:fs');
const { assertCompatibleHistory } = require('./workload-identity.cjs');

const previousPath = process.env.PREVIOUS_FILE;
const candidatePath = process.env.CANDIDATE_FILE;
const tolerance = Number(process.env.REGRESSION_TOLERANCE || '0.20');
if (!Number.isFinite(tolerance) || tolerance < 0) {
  throw new Error('REGRESSION_TOLERANCE must be a finite non-negative fraction');
}

if (!previousPath || !candidatePath) {
  throw new Error('PREVIOUS_FILE and CANDIDATE_FILE are required');
}

const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
for (const summary of [previous, candidate]) {
  if ((summary.failures?.length ?? 0) > 0 || summary.achievedLoad?.valid === false) {
    throw new Error('Cannot compare failed or invalid history experiments');
  }
}
assertCompatibleHistory(previous.metadata, candidate.metadata);

const comparisons = Object.entries(previous.metrics ?? {}).flatMap(([metric, values]) =>
  Object.keys(values)
    .filter((key) => key === 'p(95)' || key === 'p(99)')
    .flatMap((key) => {
      const before = values[key];
      const after = candidate.metrics?.[metric]?.[key];
      if (!Number.isFinite(before) || before < 0 || !Number.isFinite(after) || after < 0) {
        throw new Error(`Missing or invalid history percentile: ${metric}.${key}`);
      }
      return [[metric, key, before, after]];
    }),
);
if (comparisons.length === 0) {
  throw new Error('No comparable percentile metrics found');
}

console.log('| Metric | Statistic | Previous (ms) | Candidate (ms) | Delta (ms) | Change |');
console.log('|---|---|---:|---:|---:|---:|');
const failures = [];
for (const [metric, key, before, after] of comparisons) {
  const change = before === 0 ? (after === 0 ? 0 : Number.POSITIVE_INFINITY) : after / before - 1;
  console.log(
    `| ${metric} | ${key} | ${before.toFixed(4)} | ${after.toFixed(4)} | ${(after - before).toFixed(4)} | ${(change * 100).toFixed(1)}% |`,
  );
  if (change > tolerance) failures.push(`${metric}.${key}`);
}
if (failures.length > 0) {
  console.error(`Historical regression detected: ${failures.join(', ')}`);
  process.exit(1);
}
