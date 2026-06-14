const { spawnSync } = require('node:child_process');
const fs = require('node:fs');

const minimum = Number(process.env.BREAKPOINT_MIN_VUS || '25');
const maximum = Number(process.env.BREAKPOINT_MAX_VUS || '400');
const tolerance = Number(process.env.BREAKPOINT_TOLERANCE_VUS || '10');
let healthy = minimum;
let unhealthy = maximum;

function runCandidate(candidate) {
  const result = spawnSync(
    'k6',
    ['run', '-e', `BREAKPOINT_VUS=${candidate}`, 'dist/breakpoint/breakpoint-test.js'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (result.error) throw result.error;
  return result.status === 0;
}

if (!runCandidate(minimum)) {
  const capacity = {
    lastHealthyVus: 0,
    firstUnhealthyVus: minimum,
    toleranceVus: tolerance,
  };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/breakpoint-capacity.json', `${JSON.stringify(capacity, null, 2)}\n`);
  console.error(`Breakpoint minimum ${minimum} VUs is unhealthy`);
  process.exit(1);
}

if (runCandidate(maximum)) {
  const capacity = {
    lastHealthyVus: maximum,
    firstUnhealthyVus: null,
    toleranceVus: tolerance,
  };
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync('reports/breakpoint-capacity.json', `${JSON.stringify(capacity, null, 2)}\n`);
  console.log(JSON.stringify(capacity, null, 2));
  process.exit(0);
}

while (unhealthy - healthy > tolerance) {
  const candidate = Math.floor((healthy + unhealthy) / 2);
  if (runCandidate(candidate)) healthy = candidate;
  else unhealthy = candidate;
}

const capacity = {
  lastHealthyVus: healthy,
  firstUnhealthyVus: unhealthy,
  toleranceVus: tolerance,
};
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/breakpoint-capacity.json', `${JSON.stringify(capacity, null, 2)}\n`);
console.log(JSON.stringify(capacity, null, 2));
