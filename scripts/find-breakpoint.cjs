const { spawnSync } = require('node:child_process');

const minimum = Number(process.env.BREAKPOINT_MIN_VUS || '25');
const maximum = Number(process.env.BREAKPOINT_MAX_VUS || '400');
const tolerance = Number(process.env.BREAKPOINT_TOLERANCE_VUS || '10');
let healthy = 0;
let unhealthy = maximum;

while (unhealthy - healthy > tolerance) {
  const candidate = Math.floor((healthy + unhealthy) / 2);
  const result = spawnSync(
    'k6',
    ['run', '-e', `BREAKPOINT_VUS=${candidate}`, 'dist/breakpoint/breakpoint-test.js'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (result.error) throw result.error;
  if (result.status === 0) healthy = Math.max(candidate, minimum);
  else unhealthy = candidate;
}

console.log(
  JSON.stringify(
    {
      lastHealthyVus: healthy,
      firstUnhealthyVus: unhealthy,
      toleranceVus: tolerance,
    },
    null,
    2,
  ),
);
