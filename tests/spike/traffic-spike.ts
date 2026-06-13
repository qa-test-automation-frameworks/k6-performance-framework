import type { Options } from 'k6/options';
import { rampingVus } from '../../config/workloads';
import { concurrentReaders } from '../../src/scenarios';
import { assertAuthorizedLoadTarget, createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';
import { spikeThresholds } from '../../config/thresholds/spike';

assertAuthorizedLoadTarget({ workload: 'Spike' });
const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  scenarios: {
    traffic_spike: rampingVus(
      validation
        ? [
            { duration: '3s', target: 2 },
            { duration: '3s', target: 20 },
            { duration: '5s', target: 2 },
          ]
        : [
            { duration: '2m', target: 10 },
            { duration: '30s', target: 200 },
            { duration: '1m', target: 200 },
            { duration: '30s', target: 10 },
            { duration: '3m', target: 10 },
            { duration: '1m', target: 0 },
          ],
    ),
  },
  thresholds: spikeThresholds,
  tags: { test_type: 'spike' },
  summaryTrendStats,
};
export default concurrentReaders;
export const handleSummary = createSummary;
