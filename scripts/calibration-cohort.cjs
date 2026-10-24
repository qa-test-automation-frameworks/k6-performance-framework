'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { aggregateBaselineFiles } = require('./aggregate-baseline.cjs');
const { deriveTolerance } = require('./derive-tolerance.cjs');

function inputs(env = process.env) {
  const arm = env.CALIBRATION_ARM;
  const samples = Number(env.CALIBRATION_SAMPLES);
  const delayMs = Number(env.CALIBRATION_DELAY_MS);
  const label = env.CALIBRATION_LABEL;
  const expectedImage = env.CALIBRATION_EXPECTED_IMAGE;
  if (
    !/^ubuntu[0-9]+-[0-9]{8}\.[0-9]+\.[0-9]+$/.test(expectedImage || '') ||
    !['aa', 'degraded'].includes(arm) ||
    !Number.isInteger(samples) ||
    samples < (arm === 'aa' ? 5 : 3) ||
    samples > 20 ||
    !Number.isInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 1000 ||
    (arm === 'aa' && delayMs !== 0) ||
    (arm === 'degraded' && delayMs === 0) ||
    !/^[a-zA-Z0-9_-]{1,60}$/.test(label || '')
  )
    throw new Error('Invalid calibration arm, sample count, delay, or cohort label');
  return { arm, samples, delayMs, label, expectedImage };
}

function verifyRunnerImage(expected, actual) {
  if (actual !== expected)
    throw new Error(`Runner image mismatch: ${actual}; expected ${expected}`);
}

function aggregate(directory, output, config = inputs()) {
  const files = fs
    .readdirSync(directory)
    .filter((file) => /^sample-\d+-summary\.json$/.test(file))
    .sort();
  if (files.length !== config.samples) throw new Error('Incomplete calibration sample set');
  const runUrl = process.env.WORKFLOW_RUN_URL;
  if (
    !/^https:\/\/github\.com\/qa-test-automation-frameworks\/k6-performance-framework\/actions\/runs\/\d+$/.test(
      runUrl || '',
    )
  )
    throw new Error('A real workflow run URL is required');
  const sources = files.map((file) => {
    const index = file.match(/^sample-(\d+)/)[1];
    const stats = JSON.parse(fs.readFileSync(path.join(directory, `sample-${index}-stats.json`)));
    if (
      stats.delayMs !== config.delayMs ||
      stats.forwarded <= 0 ||
      stats.matched <= 0 ||
      (config.arm === 'degraded' ? stats.delayed <= 0 : stats.delayed !== 0)
    )
      throw new Error(`Proxy arm not proven for sample ${index}`);
    const bytes = fs.readFileSync(path.join(directory, file));
    verifyRunnerImage(config.expectedImage, JSON.parse(bytes).metadata?.runnerImage);
    return {
      path: `baseline/sources/${file}`,
      bytes,
      summary: JSON.parse(bytes),
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      runUrl,
    };
  });
  fs.mkdirSync(output, { recursive: true });
  if (config.arm === 'aa') {
    for (const source of sources) {
      const destination = path.join(output, source.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, source.bytes);
    }
    aggregateBaselineFiles(
      sources.map((source) => source.path),
      { projectRoot: output, outputPath: 'baseline/load-summary.json', env: process.env },
    );
    fs.writeFileSync(
      path.join(output, 'baseline/tolerance.json'),
      JSON.stringify(deriveTolerance(sources), null, 2) + '\n',
    );
    const baselineBytes = fs.readFileSync(path.join(output, 'baseline/load-summary.json'));
    fs.writeFileSync(
      path.join(output, 'baseline/provenance.json'),
      JSON.stringify(
        {
          schemaVersion: 2,
          baselinePath: 'baseline/load-summary.json',
          baselineSha256: crypto.createHash('sha256').update(baselineBytes).digest('hex'),
          disposition: 'measured-retained',
          sourceInputsAvailable: true,
          sourceArtifacts: sources.map(({ path, sha256, runUrl }) => ({ path, sha256, runUrl })),
          limitations: [
            'Shared hosted runners; target and generator share one host; runner images can change.',
          ],
          explanationPath: 'docs/baseline-provenance.md',
        },
        null,
        2,
      ) + '\n',
    );
  }
  const committed = JSON.parse(fs.readFileSync('baseline/provenance.json'));
  const measured = committed.disposition === 'measured-retained';
  if (config.arm === 'degraded' && !measured)
    throw new Error('Degraded cohort requires a committed measured baseline');
  const results = [];
  if (measured)
    for (const file of files) {
      const comparison = spawnSync(
        process.execPath,
        [path.join(__dirname, 'compare-performance.cjs')],
        {
          encoding: 'utf8',
          env: { ...process.env, CANDIDATE_FILE: path.join(directory, file) },
        },
      );
      const text = comparison.stdout + comparison.stderr;
      fs.writeFileSync(path.join(output, `${file}.comparison.txt`), text);
      results.push({ file, exitCode: comparison.status, output: text });
    }
  const valid = results.every((result) =>
    config.arm === 'aa'
      ? result.exitCode === 0
      : result.exitCode === 1 &&
        result.output.includes('http_req_duration{name:GET /articles}.p(95)'),
  );
  const report = { ...config, runUrl, results, validationPerformed: measured, accepted: valid };
  fs.writeFileSync(path.join(output, 'cohort.json'), JSON.stringify(report, null, 2) + '\n');
  const table = [
    '| Sample | Comparison exit |',
    '|---|---:|',
    ...results.map((result) => `| ${result.file} | ${result.exitCode} |`),
  ];
  if (!measured)
    table.push(
      'Calibration only: no accepted committed baseline exists; independent validation is still required.',
    );
  if (process.env.GITHUB_STEP_SUMMARY)
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, table.join('\n') + '\n');
  if (!valid)
    throw new Error('Cohort failed its independent validation criteria; keep the gate advisory');
}

if (require.main === module) {
  if (process.argv[2] === 'preflight') {
    const config = inputs();
    const actual = process.env.ACTUAL_RUNNER_IMAGE;
    fs.mkdirSync('reports', { recursive: true });
    fs.writeFileSync('reports/runner-image.txt', `${actual}\n`);
    verifyRunnerImage(config.expectedImage, actual);
  } else if (process.argv[2] === 'matrix') {
    const config = inputs();
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `samples=${JSON.stringify(Array.from({ length: config.samples }, (_, i) => i + 1))}\n`,
    );
  } else aggregate(process.argv[2], process.argv[3]);
}

module.exports = { inputs, aggregate, verifyRunnerImage };
