import type { Options } from 'k6/options';
import { stressThresholds } from '../../config/thresholds/stress';
import { rampingVus } from '../../config/workloads';
import { concurrentReaders } from '../../src/scenarios';
import { assertAuthorizedLoadTarget, createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

assertAuthorizedLoadTarget({ workload: 'Stress' });
const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  scenarios: {
    stress_readers: rampingVus(
      validation
        ? [
            { duration: '5s', target: 5 },
            { duration: '5s', target: 0 },
          ]
        : [
            { duration: '2m', target: 25 },
            { duration: '3m', target: 50 },
            { duration: '3m', target: 100 },
            { duration: '3m', target: 150 },
            { duration: '2m', target: 0 },
          ],
    ),
  },
  thresholds: stressThresholds,
  summaryTrendStats,
};
export default concurrentReaders;
export const handleSummary = createSummary;
