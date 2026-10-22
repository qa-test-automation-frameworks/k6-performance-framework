'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { classifySummary } = require('./report-disposition.cjs');
const { classifyBaselineProvenance } = require('./baseline-provenance.cjs');

const output = 'site';
fs.mkdirSync(output, { recursive: true });

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
const inlineJson = (value) =>
  JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => {
    const escaped = {
      '<': '\\u003c',
      '>': '\\u003e',
      '&': '\\u0026',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029',
    };
    return escaped[character];
  });
const validMetric = (metrics, metricName, key) => {
  const metric = metrics?.[metricName];
  const value = metric && typeof metric === 'object' ? metric[key] : undefined;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
};
const displayStatus = (status) =>
  ({
    PASS: 'PASS — valid evidence',
    FAIL: 'FAIL — native threshold or producer failure',
    INVALID_LOAD: 'INVALID LOAD — achieved-load evidence failed',
    INVALID_INPUT: 'INVALID INPUT — summary is malformed',
    INCOMPLETE: 'INCOMPLETE — required evidence is missing',
  })[status] ?? 'INVALID INPUT — unrecognized status';
const displayLoadStatus = (status) =>
  ({
    VALID: 'VALID',
    INVALID: 'INVALID',
    MISSING: 'MISSING',
    NOT_APPLICABLE: 'NOT APPLICABLE',
    INVALID_INPUT: 'INVALID INPUT',
  })[status] ?? 'INVALID INPUT';
const showMetric = (value, digits = 2) => (value === null ? 'unavailable' : value.toFixed(digits));
const baselineProvenance = classifyBaselineProvenance(process.cwd(), {
  sourceRef: process.env.GITHUB_SHA,
});

const candidates = fs.existsSync('reports')
  ? fs
      .readdirSync('reports')
      .filter((name) => name.endsWith('-summary.json'))
      .sort()
      .map((name) => ({ name, sourcePath: path.join('reports', name) }))
  : [];

const reportData = candidates.map(({ name, sourcePath }) => {
  let raw = '';
  let data;
  let parseError;
  try {
    raw = fs.readFileSync(sourcePath, 'utf8');
  } catch (error) {
    parseError = `Unable to read summary (${error?.code ?? 'I/O error'}).`;
  }
  if (!parseError) {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      parseError = `Invalid JSON: ${String(error?.message ?? 'Unable to parse summary').slice(0, 250)}`;
    }
  }

  const disposition = parseError
    ? {
        status: 'INVALID_INPUT',
        thresholdStatus: 'INVALID_INPUT',
        loadStatus: 'INVALID_INPUT',
        reasons: [`Invalid JSON or unreadable summary: ${parseError}`],
      }
    : classifySummary(data);
  const metrics = data && typeof data === 'object' && !Array.isArray(data) ? data.metrics : null;
  const metadata = data && typeof data === 'object' && !Array.isArray(data) ? data.metadata : null;
  const workload = metadata && typeof metadata === 'object' ? metadata.workload : null;
  const profile =
    metadata && typeof metadata === 'object'
      ? ((typeof metadata.profile === 'string' ? metadata.profile : null) ??
        (workload && typeof workload === 'object' && typeof workload.profile === 'string'
          ? workload.profile
          : null))
      : null;

  return {
    name,
    sourcePath,
    sourceSha256: crypto.createHash('sha256').update(raw).digest('hex'),
    targetId: metadata && typeof metadata.targetId === 'string' ? metadata.targetId : 'unknown',
    profile: profile ?? 'unknown',
    p95: validMetric(metrics, 'http_req_duration', 'p(95)'),
    p99: validMetric(metrics, 'http_req_duration', 'p(99)'),
    errorRate: validMetric(metrics, 'http_req_failed', 'rate'),
    throughput: validMetric(metrics, 'http_reqs', 'rate'),
    droppedIterations: validMetric(metrics, 'dropped_iterations', 'count'),
    disposition,
  };
});

const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  baseline: baselineProvenance,
  reports: reportData.map((report) => ({
    name: report.name,
    sourcePath: report.sourcePath,
    sourceSha256: report.sourceSha256,
    disposition: report.disposition,
  })),
};
fs.writeFileSync(
  path.join(output, 'report-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

const reasonCell = (reasons) =>
  reasons.length === 0
    ? '<span>None reported.</span>'
    : `<ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>`;
const rows = reportData
  .map(
    ({
      name,
      targetId,
      profile,
      p95,
      p99,
      errorRate,
      throughput,
      droppedIterations,
      disposition,
    }) =>
      `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(targetId)}</td><td>${escapeHtml(profile)}</td><td>${showMetric(p95)}</td><td>${showMetric(p99)}</td><td>${showMetric(errorRate, 4)}</td><td>${showMetric(throughput)}</td><td>${droppedIterations === null ? 'unavailable' : String(droppedIterations)}</td><td class="status status-${escapeHtml(disposition.status.toLowerCase())}">${escapeHtml(displayStatus(disposition.status))}</td><td>${escapeHtml(disposition.thresholdStatus)}</td><td>${escapeHtml(displayLoadStatus(disposition.loadStatus))}</td><td>${reasonCell(disposition.reasons)}</td></tr>`,
  )
  .join('');
const evidence =
  rows || '<tr><td colspan="12">No measured performance runs are published yet.</td></tr>';
const baselineDate = baselineProvenance.generatedAt?.slice(0, 10) ?? 'unavailable';
const baselineStatusClass =
  baselineProvenance.status === 'PROVENANCE_INVALID' ? 'invalid_input' : 'incomplete';
const baselineLimitations =
  baselineProvenance.limitations.length > 0
    ? `<ul>${baselineProvenance.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '<p>No additional limitations were recorded.</p>';
const baselineReasons =
  baselineProvenance.reasons.length > 0
    ? `<ul>${baselineProvenance.reasons.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`
    : '';
const baselineExplanation = baselineProvenance.explanationHref
  ? `<a href="${escapeHtml(baselineProvenance.explanationHref)}" rel="noreferrer">Read the baseline provenance explanation</a>`
  : '<span>Baseline provenance explanation is unavailable.</span>';
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>k6 Performance Reports</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.5.1/dist/chart.umd.min.js"></script>
<style>body{font:16px system-ui;max-width:1400px;margin:40px auto;padding:0 20px;color:#18212f}.chart{height:360px;margin:24px 0 36px;max-width:1000px}table{border-collapse:collapse;width:100%}th,td{padding:10px;border:1px solid #ccd3dc;text-align:left;vertical-align:top}th{background:#eef2f6}.status{font-weight:700}.status-pass{color:#166534}.status-fail,.status-invalid_load,.status-invalid_input{color:#991b1b}.status-incomplete{color:#854d0e}td ul{margin:0;padding-left:20px}.baseline{border:1px solid #ccd3dc;padding:16px;margin:24px 0}.baseline dd{margin:0 0 8px;overflow-wrap:anywhere}</style></head>
<body><h1>k6 Performance Reports</h1><p>Generated ${escapeHtml(manifest.generatedAt)}. Each status is based on native summary evidence; see <a href="report-manifest.json">the machine-readable report manifest</a>.</p>
<section class="baseline" aria-labelledby="historical-baseline-title"><h2 id="historical-baseline-title">Historical performance baseline</h2><p class="status status-${baselineStatusClass}">${escapeHtml(baselineProvenance.status)}</p><dl><dt>Original aggregate date</dt><dd>${escapeHtml(baselineDate)}</dd><dt>Reported source count</dt><dd>${baselineProvenance.sampleCount === null ? 'unavailable' : `${baselineProvenance.sampleCount} (reported; sources not revalidated)`}</dd><dt>Target</dt><dd>${escapeHtml(baselineProvenance.targetId)} — ${escapeHtml(baselineProvenance.targetCommit)}</dd><dt>Framework revision</dt><dd>${escapeHtml(baselineProvenance.frameworkCommit)}</dd><dt>Workload schema</dt><dd>${escapeHtml(baselineProvenance.workloadSchema)}</dd><dt>Source inputs</dt><dd>${baselineProvenance.sourceInputsAvailable === true ? 'available and verified' : baselineProvenance.sourceInputsAvailable === false ? 'unavailable' : 'not verified'}</dd><dt>Explanation</dt><dd>${baselineExplanation}</dd></dl>${baselineLimitations}${baselineReasons}<p>This historical aggregate is reported separately and is excluded from current-run status and trend lines.</p></section>
<p>The latency trend chart contains current run summaries only.</p>
<div class="chart"><canvas id="latency-chart" role="img" aria-label="p95 and p99 latency by report"></canvas></div>
  <table><thead><tr><th>Run</th><th>Target</th><th>Profile</th><th>p95 ms</th><th>p99 ms</th><th>Error rate</th><th>Req/s</th><th>Dropped</th><th>Overall status</th><th>Native thresholds</th><th>Achieved load</th><th>Reasons</th></tr></thead><tbody>${evidence}</tbody></table>
<script>
const reports = ${inlineJson(reportData.map(({ name, p95, p99 }) => ({ name, p95, p99 })))};
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
