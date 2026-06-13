interface MetricValues {
  avg?: number;
  count?: number;
  fails?: number;
  max?: number;
  med?: number;
  min?: number;
  passes?: number;
  'p(90)'?: number;
  'p(95)'?: number;
  'p(99)'?: number;
  rate?: number;
  value?: number;
}

interface SummaryMetric {
  contains?: string;
  thresholds?: Record<string, { ok: boolean }>;
  type?: string;
  values: MetricValues;
}

interface SummaryData {
  metrics: Record<string, SummaryMetric>;
  root_group: unknown;
  state: {
    setupErrors?: number;
    interruptedIterations?: number;
    [key: string]: unknown;
  };
}

export interface PerformanceSummary {
  failures: string[];
  generatedAt: string;
  metrics: Record<string, MetricValues>;
  metadata: {
    environment: string;
    frameworkCommit: string;
    k6Version: string;
    maxVus: number | null;
    profile: string;
    runnerClass: string;
    targetCommit: string;
    targetId: string;
    targetRps: number | null;
  };
  rootGroup: unknown;
  state: unknown;
  thresholds: Record<string, Record<string, { ok: boolean }>>;
}

function summaryFile(): string {
  const name = __ENV.SUMMARY_NAME ?? 'k6-summary';
  return `reports/${name}-summary.json`;
}

function markdownFile(): string {
  const name = __ENV.SUMMARY_NAME ?? 'k6-summary';
  return `reports/${name}-summary.md`;
}

function htmlFile(): string {
  const name = __ENV.SUMMARY_NAME ?? 'k6-summary';
  return `reports/${name}-summary.html`;
}

function metricRow(name: string, values: MetricValues | undefined): string {
  const median = values?.med;
  const p90 = values?.['p(90)'];
  const p95 = values?.['p(95)'];
  const p99 = values?.['p(99)'];
  const max = values?.max;
  const rate = values?.rate;
  const count = values?.count;
  return `| ${name} | ${median?.toFixed(2) ?? '-'} | ${p90?.toFixed(2) ?? '-'} | ${p95?.toFixed(2) ?? '-'} | ${p99?.toFixed(2) ?? '-'} | ${max?.toFixed(2) ?? '-'} | ${rate?.toFixed(4) ?? '-'} | ${count ?? '-'} |`;
}

function thresholdActual(values: MetricValues, threshold: string): number | undefined {
  const key = threshold.match(/^(p\(\d+\)|avg|med|min|max|rate|count|value)/)?.[1];
  return key ? values[key as keyof MetricValues] : undefined;
}

/**
 * Produces machine-readable and reviewer-readable artifacts from a completed k6 run.
 * @param data k6 end-of-test summary data.
 * @returns Output paths mapped to serialized report content.
 */
export function createSummary(data: SummaryData): Record<string, string> {
  const workload = getWorkloadProfile();
  const checkFailures = data.metrics.checks?.values.fails ?? 0;
  const interruptedIterations =
    data.metrics.interrupted_iterations?.values.count ?? data.state.interruptedIterations ?? 0;
  const setupErrors = data.state.setupErrors ?? 0;
  const summary: PerformanceSummary = {
    failures: [],
    generatedAt: new Date().toISOString(),
    metrics: Object.fromEntries(
      Object.entries(data.metrics).map(([name, metric]) => [name, metric.values]),
    ),
    metadata: {
      environment: __ENV.TARGET_ENV ?? 'local',
      frameworkCommit: __ENV.FRAMEWORK_COMMIT ?? 'unknown',
      k6Version: __ENV.K6_VERSION ?? '2.0.0',
      maxVus: workload.maxVus,
      profile: __ENV.TEST_PROFILE ?? 'full',
      runnerClass: __ENV.RUNNER_CLASS ?? 'local',
      targetCommit: __ENV.TARGET_COMMIT ?? 'unknown',
      targetId: __ENV.TARGET_ID ?? __ENV.TARGET_ENV ?? 'local',
      targetRps: workload.targetRps,
    },
    rootGroup: data.root_group,
    state: data.state,
    thresholds: Object.fromEntries(
      Object.entries(data.metrics)
        .filter(([, metric]) => metric.thresholds)
        .map(([name, metric]) => [name, metric.thresholds ?? {}]),
    ),
  };
  const failedThresholds = Object.entries(summary.thresholds).flatMap(([metric, thresholds]) =>
    Object.entries(thresholds)
      .filter(([, result]) => !result.ok)
      .map(([threshold]) => {
        const actual = thresholdActual(summary.metrics[metric] ?? {}, threshold);
        return `${metric}: expected ${threshold}; actual ${actual ?? 'unavailable'}`;
      }),
  );
  summary.failures = [
    ...failedThresholds.map((failure) => `Threshold: ${failure}`),
    ...(checkFailures > 0 ? [`Checks: ${checkFailures} failed`] : []),
    ...(setupErrors > 0 ? [`Setup: ${setupErrors} error(s)`] : []),
    ...(interruptedIterations > 0
      ? [`Execution: ${interruptedIterations} interrupted iteration(s)`]
      : []),
  ];
  const markdown = [
    '# k6 Performance Summary',
    '',
    `**Run status:** ${summary.failures.length ? 'FAILED' : 'PASSED'}`,
    `**Target:** ${summary.metadata.targetId} (${summary.metadata.targetCommit})`,
    `**Profile:** ${summary.metadata.profile} on ${summary.metadata.runnerClass}`,
    ...(summary.failures.length ? ['', ...summary.failures.map((failure) => `- ${failure}`)] : []),
    '',
    '| Metric | p50 | p90 | p95 | p99 | max | Rate | Count |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    metricRow('http_req_duration', summary.metrics.http_req_duration),
    metricRow('http_req_failed', summary.metrics.http_req_failed),
    metricRow('checks', summary.metrics.checks),
    metricRow('http_reqs', summary.metrics.http_reqs),
    metricRow('iterations', summary.metrics.iterations),
    metricRow('custom_article_read_duration_ms', summary.metrics.custom_article_read_duration_ms),
    metricRow('custom_business_errors_total', summary.metrics.custom_business_errors_total),
    '',
  ].join('\n');
  const duration = summary.metrics.http_req_duration ?? {};
  const bars = [
    ['p50', duration.med ?? 0],
    ['p90', duration['p(90)'] ?? 0],
    ['p95', duration['p(95)'] ?? 0],
    ['p99', duration['p(99)'] ?? 0],
    ['max', duration.max ?? 0],
  ] as const;
  const maximum = Math.max(...bars.map(([, value]) => value), 1);
  const chart = bars
    .map(
      ([label, value], index) =>
        `<g transform="translate(0 ${index * 42})"><text x="0" y="20">${label}</text><rect x="48" y="4" width="${(value / maximum) * 500}" height="22" fill="#2563eb"/><text x="${56 + (value / maximum) * 500}" y="20">${value.toFixed(2)} ms</text></g>`,
    )
    .join('');
  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>k6 Performance Summary</title>
<style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:0 20px;color:#18212f}table{border-collapse:collapse;width:100%}th,td{padding:8px;border:1px solid #ccd3dc;text-align:left}.failed{color:#b91c1c}.passed{color:#047857}</style></head>
<body><h1>k6 Performance Summary</h1>
<p class="${summary.failures.length ? 'failed' : 'passed'}"><strong>${summary.failures.length ? 'FAILED' : 'PASSED'}</strong></p>
<p>Target: ${summary.metadata.targetId} (${summary.metadata.targetCommit})<br>Profile: ${summary.metadata.profile}<br>Runner: ${summary.metadata.runnerClass}</p>
<svg role="img" aria-label="Latency percentiles" width="720" height="230" viewBox="0 0 720 230">${chart}</svg>
<pre>${markdown.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}</pre>
</body></html>`;

  return {
    [summaryFile()]: JSON.stringify(summary, null, 2),
    [markdownFile()]: markdown,
    [htmlFile()]: html,
    stdout: markdown,
  };
}
import { getWorkloadProfile } from '../../config/workloads';
