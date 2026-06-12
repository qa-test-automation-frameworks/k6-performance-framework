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
      },
      root_group: { name: '', path: '', id: 'root', groups: [], checks: [] },
      state: { isStdOutTTY: false, isStdErrTTY: false, testRunDurationMs: 1000 },
    });

    expect(result['reports/k6-summary-summary.json']).toContain('"p(95)": 400');
    expect(result['reports/k6-summary-summary.md']).toContain(
      '| http_req_duration | - | - | 400.00 | 700.00 |',
    );
    expect(result['reports/k6-summary-summary.md']).toContain('**Threshold status:** PASSED');
  });
});
