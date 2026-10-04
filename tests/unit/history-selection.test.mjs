import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const metadata = {
  targetId: 'fixture',
  targetCommit: 'target-v1',
  environment: 'local',
  targetRps: 20,
  maxVus: 100,
  profile: 'full',
  k6Version: '2.0.0',
  runnerClass: 'github-hosted',
};

function select(runs, options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-history-selection-'));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'bin'));
  for (const name of ['check-history-identity.cjs', 'workload-identity.cjs']) {
    fs.copyFileSync(path.join('scripts', name), path.join(root, 'scripts', name));
  }
  fs.writeFileSync(path.join(root, 'candidate.json'), JSON.stringify({ metadata }));
  fs.writeFileSync(path.join(root, 'fixture.json'), JSON.stringify({ runs, ...options }));
  const gh = path.join(root, 'bin', 'gh');
  fs.writeFileSync(
    gh,
    `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const config = JSON.parse(fs.readFileSync('fixture.json'));
const args = process.argv.slice(2);
fs.appendFileSync('gh-calls.jsonl', JSON.stringify(args) + '\\n');
if (args[1] === 'list') {
  if (config.apiFailure) process.exit(1);
  console.log(config.runs.map(r => r.id).join('\\n'));
} else if (args[1] === 'download') {
  const run = config.runs.find(r => String(r.id) === args[2]);
  if (!run || run.missing) process.exit(1);
  const dir = args[args.indexOf('--dir') + 1];
  fs.mkdirSync(path.join(dir, 'history'), {recursive: true});
  if (!run.nestedOnly) fs.writeFileSync(path.join(dir, 'soak-summary.json'), JSON.stringify({metadata: run.metadata}));
  fs.writeFileSync(path.join(dir, 'history', 'soak-summary.json'), JSON.stringify({metadata: config.runs[0].metadata}));
} else process.exit(2);
`,
  );
  fs.chmodSync(gh, 0o755);
  const output = path.join(root, 'outputs');
  const result = spawnSync('bash', [path.resolve('.github/scripts/select-history.sh')], {
    cwd: root,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
      SCENARIO: 'soak',
      CANDIDATE_FILE: 'candidate.json',
      GITHUB_RUN_ID: '101',
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: path.join(root, 'step-summary'),
    },
  });
  return {
    root,
    result,
    outputs: fs.existsSync(output) ? fs.readFileSync(output, 'utf8') : '',
    selection: fs.existsSync(path.join(root, 'reports/history-selection.json'))
      ? JSON.parse(fs.readFileSync(path.join(root, 'reports/history-selection.json')))
      : null,
  };
}

describe.skipIf(process.platform === 'win32')('historical artifact selection', () => {
  it('skips this run, rejects an incompatible primary, and selects a compatible primary', () => {
    const value = select([
      { id: 101, metadata },
      { id: 100, metadata: { ...metadata, targetCommit: 'different-target' } },
      { id: 99, metadata },
    ]);
    expect(value.result.status).toBe(0);
    expect(value.selection).toMatchObject({ disposition: 'available', selectedRunId: '99' });
    expect(value.outputs).toContain('available=true');
    const calls = fs.readFileSync(path.join(value.root, 'gh-calls.jsonl'), 'utf8');
    expect(calls).toContain('"--branch","main"');
    expect(calls).not.toContain('headSha');
    expect(calls).not.toContain('"download","101"');
  });

  it.each(
    [
      [],
      [{ id: 100, missing: true, metadata }],
      [{ id: 100, nestedOnly: true, metadata }],
      [{ id: 100, metadata: { ...metadata, targetCommit: 'different-target' } }],
    ].map((runs) => [runs]),
  )('records unavailable inputs without representing comparison as passed: %j', (runs) => {
    const value = select(runs);
    expect(value.result.status).toBe(0);
    expect(value.outputs).toContain('available=false');
    expect(value.selection.disposition).toBe('unavailable');
    expect(value.result.stdout).toContain('Historical comparison unavailable');
  });

  it('preserves API failure instead of treating it as a successful first run', () => {
    const value = select([], { apiFailure: true });
    expect(value.result.status).toBe(1);
    expect(value.selection).toBeNull();
    expect(value.outputs).not.toContain('available=false');
  });
});
