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
  const p95 = values?.['p(95)'];
  const p99 = values?.['p(99)'];
  const rate = values?.rate;
  return `| ${name} | ${p95?.toFixed(2) ?? '-'} | ${p99?.toFixed(2) ?? '-'} | ${rate?.toFixed(4) ?? '-'} |`;
}

export function createSummary(data: SummaryData): Record<string, string> {
  const summary: PerformanceSummary = {
    generatedAt: new Date().toISOString(),
    metrics: Object.fromEntries(
      Object.entries(data.metrics).map(([name, metric]) => [name, metric.values]),
    ),
    rootGroup: data.root_group,
    state: data.state,
  };
  const markdown = [
    '# k6 Performance Summary',
    '',
    '| Metric | p95 | p99 | Rate |',
    '|---|---:|---:|---:|',
    metricRow('http_req_duration', summary.metrics.http_req_duration),
    metricRow('http_req_failed', summary.metrics.http_req_failed),
    metricRow('checks', summary.metrics.checks),
    '',
  ].join('\n');

  return {
    [summaryFile()]: JSON.stringify(summary, null, 2),
    [markdownFile()]: markdown,
    stdout: markdown,
  };
}
