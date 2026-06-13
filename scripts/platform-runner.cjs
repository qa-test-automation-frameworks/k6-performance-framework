const { spawnSync } = require('node:child_process');
const path = require('node:path');

const task = process.argv[2];
const scripts = {
  observed: ['run-observed.ps1', 'run-observed.sh'],
  report: ['generate-report.ps1', 'generate-report.sh'],
  baseline: ['save-baseline.ps1', 'save-baseline.sh'],
};

if (!scripts[task]) throw new Error(`Unknown platform task: ${task}`);
const windows = process.platform === 'win32';
const file = path.join(__dirname, scripts[task][windows ? 0 : 1]);
const command = windows ? 'powershell.exe' : 'bash';
const args = windows ? ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file] : [file];
const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
