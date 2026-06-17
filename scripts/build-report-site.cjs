const fs = require('node:fs');
const path = require('node:path');

const output = 'site';
fs.mkdirSync(output, { recursive: true });
const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const inlineJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');
const summaries = fs.existsSync('reports')
  ? fs.readdirSync('reports').filter((name) => name.endsWith('-summary.json'))
  : [];
if (fs.existsSync('baseline/load-summary.json')) {
  const baseline = JSON.parse(fs.readFileSync('baseline/load-summary.json', 'utf8'));
  if (baseline.metadata?.status === 'measured' && baseline.metadata?.sampleCount >= 3) {
    summaries.push('../baseline/load-summary.json');
  }
}
const reportData = summaries.map((name) => {
  const source = name.startsWith('../') ? name.slice(3) : path.join('reports', name);
  const data = JSON.parse(fs.readFileSync(source, 'utf8'));
  const duration = data.metrics?.http_req_duration || {};
  const failed = data.metrics?.http_req_failed || {};
  return {
    name: path.basename(name),
    p95: duration['p(95)'] ?? null,
    p99: duration['p(99)'] ?? null,
    errorRate: failed.rate ?? null,
    throughput: data.metrics?.http_reqs?.rate ?? null,
    droppedIterations: data.metrics?.dropped_iterations?.count ?? null,
    thresholdStatus: Object.values(data.thresholds ?? {}).every((thresholds) =>
      Object.values(thresholds).every((result) => result.ok),
    ),
    targetId: data.metadata?.targetId ?? 'unknown',
    profile: data.metadata?.profile ?? data.metadata?.workload?.profile ?? 'unknown',
  };
});
const rows = reportData
  .map(
    ({
      name,
      p95,
      p99,
      errorRate,
      throughput,
      droppedIterations,
      thresholdStatus,
      targetId,
      profile,
    }) =>
      `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(targetId)}</td><td>${escapeHtml(profile)}</td><td>${p95?.toFixed(2) ?? '-'}</td><td>${p99?.toFixed(2) ?? '-'}</td><td>${errorRate?.toFixed(4) ?? '-'}</td><td>${throughput?.toFixed(2) ?? '-'}</td><td>${droppedIterations ?? '-'}</td><td>${thresholdStatus ? 'PASS' : 'FAIL'}</td></tr>`,
  )
  .join('');
const evidence =
  rows || '<tr><td colspan="9">No measured performance runs are published yet.</td></tr>';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>k6 Performance Reports</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>
<style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:0 20px;color:#18212f}.chart{height:360px;margin:24px 0 36px}table{border-collapse:collapse;width:100%}th,td{padding:10px;border:1px solid #ccd3dc;text-align:left}th{background:#eef2f6}</style></head>
<body><h1>k6 Performance Reports</h1><p>Generated ${new Date().toISOString()}</p>
<div class="chart"><canvas id="latency-chart"></canvas></div>
  <table><thead><tr><th>Run</th><th>Target</th><th>Profile</th><th>p95 ms</th><th>p99 ms</th><th>Error rate</th><th>Req/s</th><th>Dropped</th><th>Thresholds</th></tr></thead><tbody>${evidence}</tbody></table>
<script>
const reports = ${inlineJson(reportData)};
new Chart(document.getElementById('latency-chart'), {
  type: 'line',
  data: {
    labels: reports.map((report) => report.name),
    datasets: [
      { label: 'p95 ms', data: reports.map((report) => report.p95), borderColor: '#2563eb' },
      { label: 'p99 ms', data: reports.map((report) => report.p99), borderColor: '#dc2626' }
    ]
  },
  options: { responsive: true, maintainAspectRatio: false }
});
</script></body></html>`;
fs.writeFileSync(path.join(output, 'index.html'), html);
