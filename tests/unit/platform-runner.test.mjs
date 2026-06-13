import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe.runIf(process.platform === 'win32')('observed PowerShell runner', () => {
  it('returns the native docker exit code', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-docker-'));
    fs.writeFileSync(path.join(directory, 'docker.cmd'), '@exit /b 7\r\n');

    const result = spawnSync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'scripts/run-observed.ps1'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PATH: `${directory};${process.env.PATH}`,
          SKIP_ANNOTATIONS: 'true',
        },
      },
    );

    expect(result.status).toBe(7);
  });
});
