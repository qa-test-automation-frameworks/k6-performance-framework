import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import aggregateTools from '../../scripts/aggregate-baseline.cjs';
import workloadTools from '../../scripts/workload-identity.cjs';

const FIXTURE_PROVENANCE = 'tests/regression-fixtures/measured-baseline.provenance.json';

function run(script, env, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, TOLERANCE_FILE: 'tests/regression-fixtures/tolerance.json', ...env },
  });
}

describe('performance comparison tools', () => {
  function historyPair(before, after, changes = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-history-validity-'));
    const metadata = {
      targetId: 'realworld-local',
      targetCommit: 'target-v1',
      environment: 'local',
      targetRps: 20,
      maxVus: 100,
      profile: 'full',
      k6Version: '2.0.0',
      runnerClass: 'github-hosted',
    };
    const previous = { metadata, metrics: before };
    const candidate = { metadata: { ...metadata, ...changes }, metrics: after };
    const previousFile = path.join(directory, 'previous.json');
    const candidateFile = path.join(directory, 'candidate.json');
    fs.writeFileSync(previousFile, JSON.stringify(previous));
    fs.writeFileSync(candidateFile, JSON.stringify(candidate));
    return { PREVIOUS_FILE: previousFile, CANDIDATE_FILE: candidateFile };
  }

  it('does not report zero-to-zero percentiles as an infinite regression', () => {
    const result = run(
      'scripts/compare-history.cjs',
      historyPair(
        { http_req_duration: { 'p(95)': 0, 'p(99)': 0 } },
        { http_req_duration: { 'p(95)': 0, 'p(99)': 0 } },
      ),
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('0.0%');
    expect(result.stdout).not.toContain('Infinity');
  });

  it('rejects a new positive latency from zero and reports its absolute difference', () => {
    const result = run(
      'scripts/compare-history.cjs',
      historyPair({ http_req_duration: { 'p(99)': 0 } }, { http_req_duration: { 'p(99)': 1.25 } }),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Historical regression detected');
    expect(result.stdout).toContain('1.2500');
  });

  it.each([undefined, null, -1, '10'])(
    'rejects missing/invalid candidate percentile %j instead of comparing a subset',
    (value) => {
      const result = run(
        'scripts/compare-history.cjs',
        historyPair(
          { http_req_duration: { 'p(95)': 100, 'p(99)': 120 } },
          { http_req_duration: { 'p(95)': 100, 'p(99)': value } },
        ),
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Missing or invalid history percentile');
    },
  );

  it.each(['targetCommit', 'environment'])('rejects changed %s in history', (field) => {
    const result = run(
      'scripts/compare-history.cjs',
      historyPair(
        { http_req_duration: { 'p(99)': 100 } },
        { http_req_duration: { 'p(99)': 100 } },
        { [field]: 'changed' },
      ),
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Incompatible history: ${field}`);
  });

  it.each(['compare-history.cjs', 'compare-performance.cjs'])(
    'rejects invalid tolerances through %s',
    (script) => {
      for (const REGRESSION_TOLERANCE of ['NaN', 'Infinity', '-0.1']) {
        const result = run(`scripts/${script}`, { REGRESSION_TOLERANCE });
        expect(result.status).toBe(script === 'compare-performance.cjs' ? 2 : 1);
        expect(result.stderr).toContain('finite non-negative');
      }
    },
  );

  it('requires the declared drain and separates interrupted from drained cohorts', () => {
    const metadata = {
      workloadSchema: 'single-request-arrival-v2',
      targetIterationsPerSecond: 100,
      targetRequestsPerSecond: 100,
      maxVus: 20,
      profile: 'full',
      measurementSeconds: 3,
      warmupSeconds: 1,
      minimumAchievedFraction: 0.98,
      requestDrainSeconds: 2,
    };
    expect(workloadTools.assertCompatibleWorkloads(metadata, { ...metadata })).toMatchObject({
      requestDrainSeconds: 2,
    });
    expect(() =>
      workloadTools.assertCompatibleWorkloads(
        { ...metadata, workloadSchema: 'single-request-arrival-v1' },
        metadata,
      ),
    ).toThrow('Incompatible workload');
    for (const requestDrainSeconds of [undefined, 0, 1, 3]) {
      expect(() => workloadTools.workloadIdentity({ ...metadata, requestDrainSeconds })).toThrow(
        'completion drain',
      );
    }
  });
  it('compares historical journey units with their explicit renamed equivalent', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-units-'));
    const candidate = JSON.parse(
      fs.readFileSync('tests/regression-fixtures/healthy-candidate.json'),
    );
    candidate.metadata.workloadSchema = 'journey-arrival-v1';
    candidate.metadata.targetIterationsPerSecond = candidate.metadata.targetRps;
    candidate.metadata.targetRequestsPerSecond = null;
    delete candidate.metadata.targetRps;
    const file = path.join(directory, 'candidate.json');
    fs.writeFileSync(file, JSON.stringify(candidate));
    const result = run('scripts/compare-performance.cjs', {
      BASELINE_FILE: 'tests/regression-fixtures/measured-baseline.json',
      BASELINE_PROVENANCE_FILE: FIXTURE_PROVENANCE,
      CANDIDATE_FILE: file,
    });
    expect(result.status).toBe(0);
  });

  it.each(['compare-performance.cjs', 'compare-history.cjs'])(
    'rejects a journey-to-request profile comparison through %s',
    (script) => {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-schema-'));
      const candidate = JSON.parse(
        fs.readFileSync('tests/regression-fixtures/healthy-candidate.json'),
      );
      Object.assign(candidate.metadata, {
        workloadSchema: 'single-request-arrival-v1',
        targetIterationsPerSecond: 20,
        targetRequestsPerSecond: 20,
        measurementSeconds: 60,
        warmupSeconds: 10,
        minimumAchievedFraction: 0.98,
      });
      const file = path.join(directory, 'candidate.json');
      fs.writeFileSync(file, JSON.stringify(candidate));
      const result = run(`scripts/${script}`, {
        BASELINE_FILE: 'tests/regression-fixtures/measured-baseline.json',
        BASELINE_PROVENANCE_FILE: FIXTURE_PROVENANCE,
        PREVIOUS_FILE: 'tests/regression-fixtures/healthy-candidate.json',
        CANDIDATE_FILE: file,
      });
      expect(result.status).toBe(script === 'compare-performance.cjs' ? 2 : 1);
      expect(result.stderr).toContain('Incompatible workload');
    },
  );
  it('rejects unsupported npm versions with the bootstrap command', () => {
    const result = run('scripts/check-npm-version.cjs', {
      npm_config_user_agent: 'npm/11.6.2 node/v24.13.0 win32 x64',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('npx --yes npm@10.9.4 ci');
  });

  it('rejects an endpoint regression when aggregate latency is healthy', () => {
    const result = run('scripts/compare-performance.cjs', {
      BASELINE_FILE: 'tests/regression-fixtures/measured-baseline.json',
      BASELINE_PROVENANCE_FILE: FIXTURE_PROVENANCE,
      CANDIDATE_FILE: 'tests/regression-fixtures/endpoint-regression-candidate.json',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('http_req_duration{name:GET /articles}.p(95)');
  });

  it('compares compatible retained workload history', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-history-'));
    const metadata = {
      targetId: 'realworld-local',
      targetCommit: 'test-target-v1',
      environment: 'local',
      targetRps: 20,
      maxVus: 100,
      profile: 'full',
      k6Version: '2.0.0',
      runnerClass: 'github-hosted',
    };
    const previous = path.join(directory, 'previous.json');
    const candidate = path.join(directory, 'candidate.json');
    fs.writeFileSync(
      previous,
      JSON.stringify({ metadata, metrics: { http_req_duration: { 'p(95)': 100 } } }),
    );
    fs.writeFileSync(
      candidate,
      JSON.stringify({ metadata, metrics: { http_req_duration: { 'p(95)': 110 } } }),
    );

    const result = run('scripts/compare-history.cjs', {
      PREVIOUS_FILE: previous,
      CANDIDATE_FILE: candidate,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('10.0%');
  });

  it('rejects a material breakpoint capacity loss', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-capacity-'));
    const previous = path.join(directory, 'previous.json');
    const candidate = path.join(directory, 'candidate.json');
    fs.writeFileSync(previous, JSON.stringify({ lastHealthyVus: 200 }));
    fs.writeFileSync(candidate, JSON.stringify({ lastHealthyVus: 140 }));

    const result = run('scripts/compare-capacity.cjs', {
      PREVIOUS_FILE: previous,
      CANDIDATE_FILE: candidate,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Capacity regression detected');
  });

  it('aggregates endpoint percentiles into a measured baseline', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-'));
    const reportsDirectory = path.join(directory, 'reports');
    fs.mkdirSync(reportsDirectory);
    const inputs = [1, 2, 3].map((number) => {
      const file = path.join(reportsDirectory, `run-${number}-summary.json`);
      fs.writeFileSync(
        file,
        JSON.stringify({
          thresholds: { http_req_duration: { 'p(95)<100': { ok: true } } },
          failures: [],
          achievedLoad: null,
          metadata: {
            runId: `fixture-run-${number}`,
            targetId: 'fixture-target',
            targetCommit: 'target-v1',
            environment: 'local',
            frameworkCommit: 'framework-v1',
            k6Version: '2.0.0',
            runnerClass: 'fixture-runner',
            workloadName: 'load',
            workloadSchema: 'journey-arrival-v1',
            targetIterationsPerSecond: 20,
            targetRequestsPerSecond: null,
            measurementSeconds: null,
            warmupSeconds: null,
            minimumAchievedFraction: null,
            requestDrainSeconds: null,
            maxVus: 100,
            profile: 'full',
          },
          metrics: {
            http_req_duration: { 'p(95)': number, 'p(99)': number + 1 },
            'http_req_duration{name:GET /articles}': {
              'p(95)': number + 2,
              'p(99)': number + 3,
            },
            http_req_failed: { rate: 0 },
            http_reqs: { count: 100, rate: 10 },
            iterations: { count: 50, rate: 5 },
            dropped_iterations: { count: 0 },
          },
        }),
      );
      return `reports/run-${number}-summary.json`;
    });
    const output = 'baseline.json';

    const baseline = aggregateTools.aggregateBaselineFiles(inputs, {
      projectRoot: directory,
      outputPath: output,
    });

    const written = JSON.parse(fs.readFileSync(path.join(directory, output), 'utf8'));
    expect(written.metadata.sampleCount).toBe(3);
    expect(baseline.metadata.sampleCount).toBe(3);
    expect(baseline.metrics['http_req_duration{name:GET /articles}']['p(95)']).toBe(4);
  });
});

describe('baseline refusal and advisory gate', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-gate-'));
  const gateMode = (mode) => {
    const file = path.join(scratch, `${mode}-gate.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({
        schemaVersion: 1,
        mode,
        since: '2026-10-24',
        reason: 'baseline sources unavailable.',
        exitCriteria: 'recalibration.',
      }),
    );
    return file;
  };
  const base = {
    BASELINE_FILE: 'tests/regression-fixtures/measured-baseline.json',
    CANDIDATE_FILE: 'tests/regression-fixtures/healthy-candidate.json',
  };
  const provenance = (changes) => {
    const file = path.join(scratch, `provenance-${Math.random().toString(16).slice(2)}.json`);
    fs.writeFileSync(
      file,
      JSON.stringify({ ...JSON.parse(fs.readFileSync(FIXTURE_PROVENANCE)), ...changes }),
    );
    return file;
  };

  it('refuses the committed historical baseline before reading a candidate', () => {
    const result = run('scripts/compare-performance.cjs', {
      CANDIDATE_FILE: path.join(scratch, 'does-not-exist.json'),
    });
    expect(result.status).toBe(3);
    expect(result.stderr).toContain(
      'provenance disposition "historical-inputs-unavailable" is not an accepted measured state (expected "measured-retained")',
    );
  });

  it('refuses a baseline whose hash differs from its provenance', () => {
    const result = run('scripts/compare-performance.cjs', {
      ...base,
      BASELINE_PROVENANCE_FILE: provenance({ baselineSha256: '0'.repeat(64) }),
    });
    expect(result.status).toBe(3);
    expect(result.stderr).toContain('baseline hash differs from provenance');
  });

  it('accepts a retained baseline with a healthy candidate and rejects a regression', () => {
    const env = { ...base, BASELINE_PROVENANCE_FILE: FIXTURE_PROVENANCE };
    expect(run('scripts/compare-performance.cjs', env).status).toBe(0);
    const regression = run('scripts/compare-performance.cjs', {
      ...env,
      CANDIDATE_FILE: 'tests/regression-fixtures/regression-candidate.json',
    });
    expect(regression.status).toBe(1);
  });

  it('turns a refusal into a visible advisory only in advisory mode', () => {
    const advisory = run('scripts/regression-gate.cjs', { GATE_MODE_FILE: gateMode('advisory') });
    expect(advisory.status).toBe(0);
    expect(advisory.stdout).toContain('ADVISORY');
    const blocking = run('scripts/regression-gate.cjs', { GATE_MODE_FILE: gateMode('blocking') });
    expect(blocking.status).toBe(3);
  });

  it('does not let advisory mode hide a broken comparison input', () => {
    const result = run('scripts/regression-gate.cjs', {
      ...base,
      BASELINE_PROVENANCE_FILE: FIXTURE_PROVENANCE,
      CANDIDATE_FILE: path.join(scratch, 'missing-candidate.json'),
      GATE_MODE_FILE: gateMode('advisory'),
    });
    expect(result.status).toBe(2);
  });

  it('rejects a malformed gate mode file', () => {
    const file = path.join(scratch, 'bad-gate.json');
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, mode: 'sometimes' }));
    expect(run('scripts/regression-gate.cjs', { GATE_MODE_FILE: file }).status).toBe(2);
  });

  it('ships the committed gate mode as advisory with a reason', () => {
    const committed = JSON.parse(fs.readFileSync('baseline/gate-mode.json', 'utf8'));
    expect(committed.mode).toBe('advisory');
    expect(committed.reason.length).toBeGreaterThan(20);
  });
});

describe('measured per-metric tolerances', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-tolerances-'));
  const env = {
    BASELINE_FILE: 'tests/regression-fixtures/measured-baseline.json',
    BASELINE_PROVENANCE_FILE: FIXTURE_PROVENANCE,
    CANDIDATE_FILE: 'tests/regression-fixtures/endpoint-regression-candidate.json',
  };
  it('requires both the relative and absolute limits to be exceeded', () => {
    const original = JSON.parse(fs.readFileSync('tests/regression-fixtures/tolerance.json'));
    for (const [relative, absoluteMs, status] of [
      [0.2, 2, 0],
      [1, 0.2, 0],
      [0.2, 0.2, 1],
    ]) {
      const limits = structuredClone(original);
      for (const value of Object.values(limits.perMetric))
        Object.assign(value, { relative, absoluteMs });
      const file = path.join(directory, 'limits.json');
      fs.writeFileSync(file, JSON.stringify(limits));
      expect(run('scripts/compare-performance.cjs', { ...env, TOLERANCE_FILE: file }).status).toBe(
        status,
      );
    }
  });
  it('refuses missing or invalid metric tolerances', () => {
    for (const perMetric of [{}, { 'http_req_duration.p(95)': { relative: -1, absoluteMs: 1 } }]) {
      const file = path.join(directory, 'invalid.json');
      fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, perMetric }));
      const result = run('scripts/compare-performance.cjs', { ...env, TOLERANCE_FILE: file });
      expect(result.status).toBe(3);
      expect(result.stderr).toContain('missing or invalid tolerance');
    }
  });
});
