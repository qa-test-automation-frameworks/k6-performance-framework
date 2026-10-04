const fs = require('node:fs');
const path = require('node:path');
const { countNumericRows } = require('./observability-csv.cjs');

async function json(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function text(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function main() {
  const runId = process.env.K6_RUN_ID;
  const environment = process.env.TARGET_ENV || 'local';
  for (const [name, value] of Object.entries({ runId, environment })) {
    if (!value || !/^[A-Za-z0-9_-]{1,120}$/.test(value)) {
      throw new Error(`A bounded identifier is required for ${name}`);
    }
  }
  const influxToken = process.env.INFLUXDB_ADMIN_TOKEN || 'k6-local-development-token';
  const grafanaCredentials = Buffer.from(
    `${process.env.GRAFANA_ADMIN_USER || 'admin'}:${process.env.GRAFANA_ADMIN_PASSWORD || 'admin'}`,
  ).toString('base64');
  const grafanaOptions = { headers: { Authorization: `Basic ${grafanaCredentials}` } };
  const grafana = await json('http://localhost:3001/api/search?query=k6', grafanaOptions);
  for (const uid of ['k6-performance', 'k6-soak-stability', 'k6-endpoints']) {
    if (!grafana.some((item) => item.uid === uid)) {
      throw new Error(`Grafana dashboard ${uid} is not provisioned`);
    }
  }
  const influx = await text('http://localhost:8086/api/v2/query?org=k6', {
    method: 'POST',
    headers: {
      Authorization: `Token ${influxToken}`,
      'Content-Type': 'application/vnd.flux',
      Accept: 'application/csv',
    },
    body: 'from(bucket:"k6") |> range(start:-10m) |> filter(fn:(r) => r._measurement == "http_reqs") |> limit(n:1)',
  });
  if (!influx.includes('http_reqs')) throw new Error('InfluxDB contains no k6 request measurement');

  const queryEvidence = [];
  const missingRequired = [];
  // Execute the provisioned Flux itself, scoped to this run. Presence elsewhere
  // in the bucket cannot certify a broken dashboard query or a missing run.
  for (const file of ['k6-dashboard.json', 'k6-endpoints.json', 'k6-soak.json']) {
    const dashboard = JSON.parse(
      fs.readFileSync(path.join('docker/grafana/provisioning/dashboards', file), 'utf8'),
    );
    for (const panel of dashboard.panels) {
      for (const target of panel.targets || []) {
        if (!target.query) continue;
        const query = target.query
          .replaceAll('v.timeRangeStart', '-10m')
          .replaceAll('v.timeRangeStop', 'now()')
          .replaceAll('${environment}', environment)
          .replaceAll('${run_id}', runId);
        const csv = await text('http://localhost:8086/api/v2/query?org=k6', {
          method: 'POST',
          headers: {
            Authorization: `Token ${influxToken}`,
            'Content-Type': 'application/vnd.flux',
            Accept: 'application/csv',
          },
          body: query,
        });
        const rows = countNumericRows(csv);
        const optional = ['Article Write p95', 'Business Errors'].includes(panel.title);
        const disposition = rows > 0 ? 'passed' : 'unavailable';
        queryEvidence.push({
          dashboard: dashboard.uid,
          panel: panel.title,
          refId: target.refId,
          rows,
          optional,
          disposition,
        });
        if (rows === 0 && !optional) missingRequired.push(`${dashboard.uid}/${panel.title}`);
      }
    }
  }
  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(
    `reports/observability-${runId}.json`,
    JSON.stringify({ runId, environment, queryEvidence, missingRequired }, null, 2) + '\n',
  );
  if (missingRequired.length) {
    throw new Error(
      `No rows for required run-scoped dashboard queries: ${missingRequired.join(', ')}`,
    );
  }

  const prometheus = await json(
    'http://localhost:9090/api/v1/query?query=%7B__name__%3D~%22k6_otel_.*%22%7D',
  );
  if (!prometheus.data?.result?.length) throw new Error('Prometheus contains no OTEL k6 metrics');
  const annotations = await json('http://localhost:3001/api/annotations?tags=k6', grafanaOptions);
  if (
    !annotations.some(
      (annotation) =>
        String(annotation.text).startsWith('k6 start:') &&
        String(annotation.text).includes(`(${runId})`),
    )
  ) {
    throw new Error('Grafana contains no k6 start annotation');
  }
  if (
    !annotations.some(
      (annotation) =>
        String(annotation.text).startsWith('k6 end:') &&
        String(annotation.text).includes(`(${runId}) status=0`),
    )
  ) {
    throw new Error('Grafana contains no k6 end annotation');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
