const fs = require('node:fs');
const { spawnSync } = require('node:child_process');

const entrypoint = 'dist/evidence/failure-control.js';
const summaryPath = `reports/${process.env.SUMMARY_NAME ?? 'evidence-failure-control'}-summary.json`;
const result = spawnSync(process.env.K6_BINARY ?? 'k6', ['run', '--quiet', entrypoint], {
  encoding: 'utf8',
});
if (result.error) throw result.error;
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status === 0) throw new Error('The deliberate check failure unexpectedly passed');
if (result.signal || result.status === null)
  throw new Error('The failure-control runner did not terminate normally');
if (!fs.existsSync(summaryPath))
  throw new Error('The deliberate failure did not produce its native summary');
const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const checks = summary.metrics?.checks;
if (
  !Array.isArray(summary.failures) ||
  summary.failures.length !== 2 ||
  !summary.failures.includes('Checks: 1 failed') ||
  !summary.failures.some((failure) => failure.startsWith('Threshold: checks:')) ||
  checks?.count !== 1 ||
  checks?.fails !== 1 ||
  checks?.passes !== 0
) {
  throw new Error(
    'The run did not produce exactly one deliberate check failure and its matching threshold breach',
  );
}
console.log(
  'Confirmed k6 returned non-zero for exactly the deliberate failed check; native summary retained.',
);
