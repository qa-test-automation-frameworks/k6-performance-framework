'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '../..');
const fixtureDirectory = path.join(repositoryRoot, 'tests/fixtures/capacity-evidence');
const analyzerPath = path.join(repositoryRoot, 'scripts/analyze-capacity-evidence.cjs');
const { analyzeCapacityEvidence, markdownReport } = require(analyzerPath);

function withTemporaryFixture(callback) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'capacity-evidence-'));
  fs.cpSync(fixtureDirectory, directory, { recursive: true });
  try {
    return callback(directory);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function readPlan(directory) {
  return JSON.parse(fs.readFileSync(path.join(directory, 'plan.json'), 'utf8'));
}

function writePlan(directory, plan) {
  fs.writeFileSync(path.join(directory, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
}

function readSample(directory, runId) {
  return JSON.parse(fs.readFileSync(path.join(directory, `${runId}.json`), 'utf8'));
}

function writeSample(directory, runId, sample) {
  fs.writeFileSync(path.join(directory, `${runId}.json`), `${JSON.stringify(sample, null, 2)}\n`);
}

function readResources(directory) {
  return fs
    .readFileSync(path.join(directory, 'resources.jsonl'), 'utf8')
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
}

function writeResources(directory, rows) {
  fs.writeFileSync(
    path.join(directory, 'resources.jsonl'),
    `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`,
  );
}

test('CLI writes a descriptive report for six retained fixture summaries', () => {
  withTemporaryFixture((directory) => {
    const outputBase = path.join(directory, 'output', 'capacity-evidence');
    const result = spawnSync(
      process.execPath,
      [analyzerPath, '--plan', path.join(directory, 'plan.json'), '--out', outputBase],
      { cwd: repositoryRoot, encoding: 'utf8' },
    );

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(fs.readFileSync(`${outputBase}.json`, 'utf8'));
    const report = fs.readFileSync(`${outputBase}.md`, 'utf8');
    assert.equal(output.source_kind, 'fixture-only');
    assert.equal(output.sample_diagnoses.length, 6);
    assert.equal(output.comparison.status, 'COMPARABLE_DESCRIPTIVE');
    assert.equal(
      output.sample_diagnoses.filter(
        (sample) => sample.classification === 'TARGET_PRESSURE_OBSERVED',
      ).length,
      2,
    );
    assert.equal(
      output.sample_diagnoses.find((sample) => sample.run_id === 'cpu-limited-03').classification,
      'SLO_WITHIN_LIMITS',
    );
    assert.equal(output.sample_diagnoses[0].resource_coverage.target.memory_coverage_fraction, 0);
    assert.match(report, /fixture-target-6f5d1a2/u);
    assert.match(report, /memory unknown bytes/u);
    assert.match(report, /No causal conclusion is made/u);
    assert.match(markdownReport(output), /Resource utilization is an observed association/u);
  });
});

test('invalid achieved load takes precedence and reports measured generator pressure', () => {
  withTemporaryFixture((directory) => {
    const sample = readSample(directory, 'baseline-01');
    sample.achieved_load = {
      valid: false,
      reason: 'The configured arrival rate was not achieved.',
    };
    writeSample(directory, 'baseline-01', sample);
    const rows = readResources(directory);
    for (const row of rows) {
      if (row.run_id === 'baseline-01' && row.source === 'generator') row.cpu_used_cores = 3.8;
    }
    writeResources(directory, rows);

    const output = analyzeCapacityEvidence(path.join(directory, 'plan.json'));
    const diagnosis = output.sample_diagnoses.find((item) => item.run_id === 'baseline-01');
    assert.equal(diagnosis.classification, 'INVALID_GENERATOR');
    assert.equal(diagnosis.possible_generator_pressure, true);
    assert.match(diagnosis.reasons.join(' '), /Generator CPU was at or above 90%/u);
  });
});

test('low target resource coverage leaves a failing SLO undetermined', () => {
  withTemporaryFixture((directory) => {
    const sample = readSample(directory, 'cpu-limited-01');
    const removedTimestamps = new Set(
      [6, 8].map((seconds) =>
        new Date(Date.parse(sample.time_bounds.start_at) + seconds * 1000).toISOString(),
      ),
    );
    const rows = readResources(directory).filter(
      (row) =>
        !(
          row.run_id === 'cpu-limited-01' &&
          row.source === 'target' &&
          removedTimestamps.has(row.timestamp)
        ),
    );
    writeResources(directory, rows);

    const output = analyzeCapacityEvidence(path.join(directory, 'plan.json'));
    const diagnosis = output.sample_diagnoses.find((item) => item.run_id === 'cpu-limited-01');
    assert.equal(diagnosis.resource_coverage.target.coverage_fraction, 0.6);
    assert.equal(diagnosis.classification, 'UNDETERMINED');
    assert.match(diagnosis.reasons.join(' '), /at least 80% is required/u);
  });
});

test('missing resource samples and limits remain unknown', () => {
  withTemporaryFixture((directory) => {
    const plan = readPlan(directory);
    plan.resource_file = null;
    writePlan(directory, plan);

    const output = analyzeCapacityEvidence(path.join(directory, 'plan.json'));
    const diagnosis = output.sample_diagnoses.find((item) => item.run_id === 'cpu-limited-01');
    assert.equal(diagnosis.classification, 'UNDETERMINED');
    assert.equal(diagnosis.resource_coverage.target.coverage_fraction, 0);
    assert.equal(diagnosis.resource_coverage.target.memory_coverage_fraction, 0);
    assert.equal(diagnosis.target.memory_limit_bytes, undefined);
  });
});

test('resource timestamps at the end of a run are rejected as outside the window', () => {
  withTemporaryFixture((directory) => {
    const sample = readSample(directory, 'cpu-limited-01');
    const rows = readResources(directory);
    rows.push({
      timestamp: sample.time_bounds.end_at,
      run_id: sample.run_id,
      source: 'target',
      cpu_limit_cores: sample.controlled.target.cpu_limit_cores,
      cpu_used_cores: 1.4,
    });
    writeResources(directory, rows);

    assert.throws(
      () => analyzeCapacityEvidence(path.join(directory, 'plan.json')),
      /outside run cpu-limited-01/u,
    );
  });
});

test('resource timestamps must align with the declared sampling interval', () => {
  withTemporaryFixture((directory) => {
    const sample = readSample(directory, 'baseline-01');
    const rows = readResources(directory);
    rows.push({
      timestamp: new Date(Date.parse(sample.time_bounds.start_at) + 1000).toISOString(),
      run_id: sample.run_id,
      source: 'target',
      cpu_limit_cores: sample.controlled.target.cpu_limit_cores,
      cpu_used_cores: 1,
    });
    writeResources(directory, rows);

    assert.throws(() => analyzeCapacityEvidence(path.join(directory, 'plan.json')), /not aligned/u);
  });
});

test('a changed target revision invalidates matched cohort comparison', () => {
  withTemporaryFixture((directory) => {
    const sample = readSample(directory, 'cpu-limited-01');
    sample.controlled.target.revision = 'unexpected-target-revision';
    writeSample(directory, 'cpu-limited-01', sample);

    const output = analyzeCapacityEvidence(path.join(directory, 'plan.json'));
    assert.equal(output.comparison.status, 'MISMATCHED_COHORT');
    assert.equal(output.comparison.descriptive_delta_percent, null);
    assert.match(output.comparison.reasons.join(' '), /controlled identity/u);
  });
});

test('VU configuration cannot claim a request-rate unit', () => {
  withTemporaryFixture((directory) => {
    const sample = readSample(directory, 'baseline-01');
    sample.controlled.workload.mode = 'vus';
    writeSample(directory, 'baseline-01', sample);

    assert.throws(
      () => analyzeCapacityEvidence(path.join(directory, 'plan.json')),
      /conflicts with workload mode vus/u,
    );
  });
});

test('valid VU-only evidence keeps actual request throughput as an observation', () => {
  withTemporaryFixture((directory) => {
    const sample = readSample(directory, 'baseline-01');
    sample.controlled.workload = {
      mode: 'vus',
      configured_arrival: { value: 10, unit: 'vus' },
      max_vus: 20,
    };
    writeSample(directory, 'baseline-01', sample);

    const output = analyzeCapacityEvidence(path.join(directory, 'plan.json'));
    const diagnosis = output.sample_diagnoses.find((item) => item.run_id === 'baseline-01');
    assert.equal(diagnosis.workload.configured_arrival.unit, 'vus');
    assert.match(diagnosis.workload.interpretation, /not a configured arrival rate/u);
    assert.equal(diagnosis.actual_throughput.unit, 'requests_per_second');
  });
});

test('impossible error-rate percentages are rejected as contradictory metrics', () => {
  withTemporaryFixture((directory) => {
    const sample = readSample(directory, 'baseline-01');
    sample.slo_metrics.error_rate_percent = 101;
    writeSample(directory, 'baseline-01', sample);

    assert.throws(
      () => analyzeCapacityEvidence(path.join(directory, 'plan.json')),
      /error_rate_percent must not exceed 100/u,
    );
  });
});

test('insufficient sample counts suppress descriptive deltas', () => {
  withTemporaryFixture((directory) => {
    const plan = readPlan(directory);
    plan.minimum_samples_per_condition = 4;
    writePlan(directory, plan);

    const output = analyzeCapacityEvidence(path.join(directory, 'plan.json'));
    assert.equal(output.comparison.status, 'INSUFFICIENT_N');
    assert.equal(output.comparison.descriptive_delta_percent, null);
    assert.match(output.comparison.reasons.join(' '), /baseline has 3 and challenger has 3/u);
  });
});

test('resource limits in samples cannot conflict with declared target identity', () => {
  withTemporaryFixture((directory) => {
    const rows = readResources(directory);
    const row = rows.find((item) => item.run_id === 'cpu-limited-01' && item.source === 'target');
    row.cpu_limit_cores = 2;
    writeResources(directory, rows);

    assert.throws(
      () => analyzeCapacityEvidence(path.join(directory, 'plan.json')),
      /conflicts with run cpu-limited-01's declared identity/u,
    );
  });
});
