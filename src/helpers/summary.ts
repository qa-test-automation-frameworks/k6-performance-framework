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
  state: unknown;
}

export interface PerformanceSummary {
  generatedAt: string;
  metrics: Record<string, MetricValues>;
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
  const summary: PerformanceSummary = {
    generatedAt: new Date().toISOString(),
    metrics: Object.fromEntries(
      Object.entries(data.metrics).map(([name, metric]) => [name, metric.values]),
    ),
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
  const markdown = [
    '# k6 Performance Summary',
    '',
    `**Threshold status:** ${failedThresholds.length ? 'FAILED' : 'PASSED'}`,
    ...(failedThresholds.length ? ['', ...failedThresholds.map((failure) => `- ${failure}`)] : []),
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

  return {
    [summaryFile()]: JSON.stringify(summary, null, 2),
    [markdownFile()]: markdown,
    stdout: markdown,
  };
}
