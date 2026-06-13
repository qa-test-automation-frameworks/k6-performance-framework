import { describe, expect, it } from 'vitest';
import { createSummary } from '../../src/helpers/summary';

describe('performance summaries', () => {
  it('writes aggregate JSON and Markdown outputs', () => {
    const result = createSummary({
      metrics: {
        http_req_duration: {
          type: 'trend',
          contains: 'time',
          values: { 'p(95)': 400, 'p(99)': 700 },
        },
        http_req_failed: { type: 'rate', contains: 'default', values: { rate: 0.01 } },
        checks: { type: 'rate', contains: 'default', values: { rate: 0.99 } },
        custom_article_read_duration_ms: {
          type: 'trend',
          contains: 'time',
          values: { 'p(95)': 350, 'p(99)': 600 },
        },
        custom_business_errors_total: {
          type: 'counter',
          contains: 'default',
          values: { count: 0 },
        },
      },
      root_group: { name: '', path: '', id: 'root', groups: [], checks: [] },
      state: { isStdOutTTY: false, isStdErrTTY: false, testRunDurationMs: 1000 },
    });

    expect(result['reports/k6-summary-summary.json']).toContain('"p(95)": 400');
    expect(result['reports/k6-summary-summary.md']).toContain(
      '| http_req_duration | - | - | 400.00 | 700.00 |',
    );
    expect(result['reports/k6-summary-summary.md']).toContain('**Run status:** PASSED');
    expect(result['reports/k6-summary-summary.md']).toContain(
      '| custom_article_read_duration_ms |',
    );
    expect(result['reports/k6-summary-summary.md']).toContain('| custom_business_errors_total |');
    expect(result['reports/k6-summary-summary.html']).toContain('Latency percentiles');
  });

  it('fails the run summary when checks, setup, or iterations fail', () => {
    const result = createSummary({
      metrics: {
        checks: { values: { fails: 2, passes: 3, rate: 0.6 } },
        interrupted_iterations: { values: { count: 1 } },
      },
      root_group: {},
      state: { setupErrors: 1 },
    });

    const markdown = result['reports/k6-summary-summary.md'];
    expect(markdown).toContain('**Run status:** FAILED');
    expect(markdown).toContain('Checks: 2 failed');
    expect(markdown).toContain('Setup: 1 error(s)');
    expect(markdown).toContain('Execution: 1 interrupted iteration(s)');
  });

  it('reports actual values for failed thresholds', () => {
    const result = createSummary({
      metrics: {
        http_req_duration: {
          values: { 'p(95)': 750 },
          thresholds: { 'p(95)<500': { ok: false } },
        },
      },
      root_group: {},
      state: {},
    });

    expect(result['reports/k6-summary-summary.md']).toContain(
      'http_req_duration: expected p(95)<500; actual 750',
    );
  });
});
