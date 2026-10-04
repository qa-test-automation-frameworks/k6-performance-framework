const fs = require('node:fs');

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/check-achieved-load.cjs <summary.json>');
const summary = JSON.parse(fs.readFileSync(input, 'utf8'));
if (
  summary.metadata?.workloadSchema !== 'single-request-arrival-v1' ||
  summary.achievedLoad?.valid !== true ||
  !Array.isArray(summary.failures) ||
  summary.failures.length > 0
) {
  throw new Error(
    'Request-rate experiment failed or has unavailable/invalid achieved-load evidence',
  );
}
console.log(
  `VALID fixed request cohort: ${summary.achievedLoad.achievedRequestsPerSecond} requests/s ` +
    `over ${summary.achievedLoad.measurementSeconds}s; ` +
    `${summary.achievedLoad.droppedIterations} dropped iterations`,
);
