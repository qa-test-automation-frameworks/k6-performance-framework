import { check } from 'k6';
import type { Options } from 'k6/options';
import { createSummary } from '../../src/helpers';

export const options: Options = {
  vus: 1,
  iterations: 1,
  thresholds: { checks: ['rate>0.99'] },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
};

export default function evidenceFailureControl(): void {
  check({ evidenceControl: true }, { 'deliberate failure control is rejected': () => false });
}

export const handleSummary = createSummary;
