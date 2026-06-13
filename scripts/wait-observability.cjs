const { execFileSync } = require('node:child_process');

if (process.platform === 'win32') {
  execFileSync(
    'powershell',
    ['-ExecutionPolicy', 'Bypass', '-File', 'scripts/wait-observability.ps1'],
    { stdio: 'inherit' },
  );
} else {
  execFileSync('bash', ['scripts/wait-observability.sh'], { stdio: 'inherit' });
}
