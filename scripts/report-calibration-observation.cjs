'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { aggregateBaselineFiles } = require('./aggregate-baseline.cjs');
const { classifySummary } = require('./report-disposition.cjs');

const root = 'docs/experiments/data/2026-10-24-calibration';
const source = JSON.parse(fs.readFileSync(`${root}/source.json`));
const samples = fs
  .readdirSync(root)
  .filter((name) => /^sample-\d+$/.test(name))
  .sort();
const paths = samples.map((name) => `${root}/${name}/${name}-summary.json`);
if (paths.length !== 5) throw new Error('The original five-run cohort must be retained completely');
const rows = samples.map((name, index) => {
  const summary = JSON.parse(fs.readFileSync(paths[index]));
  const stats = JSON.parse(fs.readFileSync(`${root}/${name}/${name}-stats.json`));
  const nativeExit = fs.readFileSync(`${root}/${name}/${name}-native-exit.txt`, 'utf8').trim();
  if (
    nativeExit !== '0' ||
    classifySummary(summary).status !== 'PASS' ||
    stats.delayMs !== 0 ||
    stats.delayed !== 0 ||
    stats.matched <= 0 ||
    stats.forwarded <= 0
  )
    throw new Error(`Native clean-arm evidence is invalid for ${name}`);
  if (
    summary.metadata.frameworkCommit !== source.frameworkSha ||
    !summary.metadata.runId.startsWith(`${source.runId}-`)
  )
    throw new Error(`Source identity does not match the retained workflow for ${name}`);
  return {
    name,
    image: summary.metadata.runnerImage,
    p95: summary.metrics['http_req_duration{name:GET /articles}']['p(95)'],
    p99: summary.metrics['http_req_duration{name:GET /articles}']['p(99)'],
  };
});
if (new Set(rows.map((row) => row.image)).size <= 1)
  throw new Error('This retained experiment no longer demonstrates runner-image drift');
let refusal;
try {
  aggregateBaselineFiles(paths, { env: {} });
} catch (error) {
  refusal = error.message;
}
if (refusal !== 'Incompatible optional identity field runnerImage')
  throw new Error(`Unexpected aggregate outcome: ${refusal || 'accepted'}`);
const report = [
  '# Noise calibration observation — 24 October 2026',
  '',
  '**Disposition: rejected calibration cohort; the regression comparison remains advisory.**',
  '',
  `Source workflow: [retained run](${source.workflowRunUrl}); framework SHA \`${source.frameworkSha}\`.`,
  '',
  'Every sample passed the unchanged native load thresholds and used a zero-delay loopback proxy. The existing baseline compatibility check refused the cohort because the hosted runner images differed. No measured baseline or tolerance was accepted, no independent validation or degraded cohort was collected, and blocking mode was not enabled.',
  '',
  '| Sample | Runner image | Article-list p95 (ms) | Article-list p99 (ms) | Native result |',
  '|---|---|---:|---:|---|',
  ...rows.map(
    (row) =>
      `| ${row.name} | ${row.image} | ${row.p95.toFixed(4)} | ${row.p99.toFixed(4)} | PASS |`,
  ),
  '',
  `Observed aggregate refusal: \`${refusal}\`.`,
  '',
  'The samples run on separate shared hosts with the target and generator on the same host. Host image rollout is an observed compatibility limitation, rather than a latency regression. The original bytes, proxy counters, native exits and generated SHA256SUMS are retained beside this report. The rejected set is kept separate from baseline/sources and the historical baseline remains unchanged.',
  '',
  '## Proposed next protocol',
  '',
  'The owner approved a later guarded attempt. Once the hosted image rollout has settled, collect a new cohort with an expected-image preflight. Reject a sample before measuring if its actual image differs; do not retry, replace or cherry-pick samples. Retain every attempt. Only a complete compatible five-sample calibration, independent five-sample validation and three degraded samples meeting the original criteria can support blocking mode. This proposal has not been executed.',
  '',
  '## Reproduction',
  '',
  '`node scripts/report-calibration-observation.cjs` verifies the native outcomes, source identity, proxy arm and expected aggregate refusal, then regenerates this report and the hash manifest. This verification runs in GitHub CI.',
  '',
].join('\n');
fs.writeFileSync('docs/experiments/noise-calibration-2026-10-24.md', report);
const files = [
  `${root}/source.json`,
  ...samples.flatMap((name) =>
    ['summary.json', 'stats.json', 'native-exit.txt'].map(
      (suffix) => `${root}/${name}/${name}-${suffix}`,
    ),
  ),
];
fs.writeFileSync(
  `${root}/SHA256SUMS`,
  files
    .map(
      (file) =>
        `${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${file}`,
    )
    .join('\n') + '\n',
);
console.log(refusal);
console.log(
  'Retained the rejected cohort without changing baseline compatibility or advisory mode.',
);
