async function json(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

async function text(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.text();
}

async function main() {
  const grafana = await json('http://localhost:3001/api/search?query=k6');
  if (!grafana.some((item) => item.uid === 'k6-performance')) {
    throw new Error('Grafana performance dashboard is not provisioned');
  }
  const influx = await text('http://localhost:8086/api/v2/query?org=k6', {
    method: 'POST',
    headers: {
      Authorization: 'Token k6-local-development-token',
      'Content-Type': 'application/vnd.flux',
      Accept: 'application/csv',
    },
    body: 'from(bucket:"k6") |> range(start:-10m) |> filter(fn:(r) => r._measurement == "http_reqs") |> limit(n:1)',
  });
  if (!influx.includes('http_reqs')) throw new Error('InfluxDB contains no k6 request measurement');
  const prometheus = await json(
    'http://localhost:9090/api/v1/query?query=%7B__name__%3D~%22k6_otel_.*%22%7D',
  );
  if (!prometheus.data?.result?.length) throw new Error('Prometheus contains no OTEL k6 metrics');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
