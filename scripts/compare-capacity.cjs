const fs = require('node:fs');

const previousPath = process.env.PREVIOUS_FILE;
const candidatePath = process.env.CANDIDATE_FILE;
const tolerance = Number(process.env.CAPACITY_REGRESSION_TOLERANCE || '0.20');
if (!previousPath || !candidatePath) {
  throw new Error('PREVIOUS_FILE and CANDIDATE_FILE are required');
}

const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
for (const [name, value] of Object.entries({
  previousHealthy: previous.lastHealthyVus,
  candidateHealthy: candidate.lastHealthyVus,
})) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
}

const change = candidate.lastHealthyVus / previous.lastHealthyVus - 1;
console.log('| Capacity | Previous | Candidate | Change |');
console.log('|---|---:|---:|---:|');
console.log(
  `| Last healthy VUs | ${previous.lastHealthyVus} | ${candidate.lastHealthyVus} | ${(change * 100).toFixed(1)}% |`,
);
if (change < -tolerance) {
  console.error('Capacity regression detected: lastHealthyVus');
  process.exit(1);
}
