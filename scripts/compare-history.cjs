const fs = require('node:fs');

const previousPath = process.env.PREVIOUS_FILE;
const candidatePath = process.env.CANDIDATE_FILE;
const tolerance = Number(process.env.REGRESSION_TOLERANCE || '0.20');

if (!previousPath || !candidatePath) {
  throw new Error('PREVIOUS_FILE and CANDIDATE_FILE are required');
}

const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const compatibilityFields = ['targetId', 'profile', 'k6Version', 'runnerClass'];
const incompatible = compatibilityFields.filter(
  (field) =>
    previous.metadata?.[field] === undefined ||
    candidate.metadata?.[field] === undefined ||
    previous.metadata[field] !== candidate.metadata[field],
);
if (incompatible.length > 0) {
  throw new Error(`Incompatible history: ${incompatible.join(', ')}`);
}

const comparisons = Object.entries(previous.metrics ?? {}).flatMap(([metric, values]) =>
  Object.keys(values)
    .filter((key) => key === 'p(95)' || key === 'p(99)')
    .flatMap((key) => {
      const before = values[key];
      const after = candidate.metrics?.[metric]?.[key];
      return typeof before === 'number' && typeof after === 'number'
        ? [[metric, key, before, after]]
        : [];
    }),
);
if (comparisons.length === 0) {
  throw new Error('No comparable percentile metrics found');
}

console.log('| Metric | Statistic | Previous | Candidate | Change |');
console.log('|---|---|---:|---:|---:|');
const failures = [];
for (const [metric, key, before, after] of comparisons) {
  const change = before === 0 ? Number.POSITIVE_INFINITY : after / before - 1;
  console.log(
    `| ${metric} | ${key} | ${before.toFixed(2)} | ${after.toFixed(2)} | ${(change * 100).toFixed(1)}% |`,
  );
  if (change > tolerance) failures.push(`${metric}.${key}`);
}
if (failures.length > 0) {
  console.error(`Historical regression detected: ${failures.join(', ')}`);
  process.exit(1);
}
