const fs = require('node:fs');
const path = require('node:path');

const output = 'site';
fs.mkdirSync(output, { recursive: true });
const summaries = fs.existsSync('reports')
  ? fs.readdirSync('reports').filter((name) => name.endsWith('-summary.json'))
  : [];
if (fs.existsSync('baseline/load-summary.json')) {
  const baseline = JSON.parse(fs.readFileSync('baseline/load-summary.json', 'utf8'));
  if (baseline.metadata?.status === 'measured' && baseline.metadata?.sampleCount >= 3) {
    summaries.push('../baseline/load-summary.json');
  }
}
const rows = summaries.map((name) => {
  const source = name.startsWith('../') ? name.slice(3) : path.join('reports', name);
  const data = JSON.parse(fs.readFileSync(source, 'utf8'));
  const duration = data.metrics?.http_req_duration || {};
  const failed = data.metrics?.http_req_failed || {};
  return `<tr><td>${path.basename(name)}</td><td>${duration['p(95)']?.toFixed(2) ?? '-'}</td><td>${duration['p(99)']?.toFixed(2) ?? '-'}</td><td>${failed.rate?.toFixed(4) ?? '-'}</td></tr>`;
}).join('');
const evidence = rows || '<tr><td colspan="4">No measured performance runs are published yet.</td></tr>';
const html = `<!doctype html><html><head><meta charset="utf-8"><title>k6 Performance Reports</title>
<style>body{font:16px system-ui;max-width:1000px;margin:40px auto;padding:0 20px;color:#18212f}table{border-collapse:collapse;width:100%}th,td{padding:10px;border:1px solid #ccd3dc;text-align:left}th{background:#eef2f6}</style></head>
<body><h1>k6 Performance Reports</h1><p>Generated ${new Date().toISOString()}</p>
<table><thead><tr><th>Run</th><th>p95 ms</th><th>p99 ms</th><th>Error rate</th></tr></thead><tbody>${evidence}</tbody></table></body></html>`;
fs.writeFileSync(path.join(output, 'index.html'), html);
