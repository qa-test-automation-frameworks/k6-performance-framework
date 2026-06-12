import type { Options } from 'k6/options';
import { stressThresholds } from '../../config/thresholds/stress';
import { rampingVus } from '../../config/workloads';
import { authenticatedCrud } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  scenarios: {
    authenticated_stress: rampingVus(
      validation
        ? [
            { duration: '5s', target: 1 },
            { duration: '5s', target: 0 },
          ]
        : [
            { duration: '2m', target: 5 },
            { duration: '5m', target: 20 },
            { duration: '2m', target: 0 },
          ],
    ),
  },
  thresholds: stressThresholds,
  summaryTrendStats,
};
export default authenticatedCrud;
export const handleSummary = createSummary;
