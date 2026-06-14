const fs = require('node:fs');
const path = require('node:path');

const grafanaUrl = process.env.GRAFANA_URL || 'http://localhost:3001';
const runId = process.env.K6_RUN_ID;
const environment = process.env.TARGET_ENV || 'local';
if (!runId) throw new Error('K6_RUN_ID is required');

const dashboards = [
  ['overview', 'k6-performance'],
  ['endpoints', 'k6-endpoints'],
  ['soak', 'k6-soak-stability'],
];

async function main() {
  fs.mkdirSync('artifacts/evidence', { recursive: true });
  for (const [name, uid] of dashboards) {
    const query = new URLSearchParams({
      from: 'now-30m',
      to: 'now',
      width: '1600',
      height: '900',
      'var-environment': environment,
      'var-run_id': runId,
    });
    const response = await fetch(`${grafanaUrl}/render/d/${uid}?${query}`, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.GRAFANA_ADMIN_USER || 'admin'}:${process.env.GRAFANA_ADMIN_PASSWORD || 'admin'}`,
        ).toString('base64')}`,
      },
    });
    if (!response.ok) throw new Error(`Rendering ${uid} returned ${response.status}`);
    fs.writeFileSync(
      path.join('artifacts/evidence', `${runId}-${name}.png`),
      Buffer.from(await response.arrayBuffer()),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
