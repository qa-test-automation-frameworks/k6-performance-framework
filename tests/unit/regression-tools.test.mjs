import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function run(script, env, args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('performance comparison tools', () => {
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
      CANDIDATE_FILE: 'tests/regression-fixtures/endpoint-regression-candidate.json',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('http_req_duration{name:GET /articles}.p(95)');
  });

  it('compares compatible retained workload history', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-history-'));
    const metadata = {
      targetId: 'realworld-local',
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
    const inputs = [1, 2, 3].map((number) => {
      const file = path.join(directory, `run-${number}.json`);
      fs.writeFileSync(
        file,
        JSON.stringify({
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
      return file;
    });
    const output = path.join(directory, 'baseline.json');

    const result = run('scripts/aggregate-baseline.cjs', { BASELINE_OUTPUT: output }, inputs);
    const baseline = JSON.parse(fs.readFileSync(output, 'utf8'));

    expect(result.status).toBe(0);
    expect(baseline.metrics['http_req_duration{name:GET /articles}']['p(95)']).toBe(4);
  });
});
