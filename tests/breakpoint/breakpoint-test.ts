import type { Options } from 'k6/options';
import { rampingVus } from '../../config/workloads';
import { concurrentReaders } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';
import { breakpointThresholds } from '../../config/thresholds/breakpoint';

const validation = __ENV.TEST_PROFILE === 'validation';
const candidateVus = Number(__ENV.BREAKPOINT_VUS || '0');
export const options: Options = {
  scenarios: {
    capacity_search: rampingVus(
      candidateVus > 0
        ? [
            { duration: '30s', target: candidateVus },
            { duration: '2m', target: candidateVus },
            { duration: '30s', target: 0 },
          ]
        : validation
          ? [
              { duration: '5s', target: 5 },
              { duration: '5s', target: 20 },
            ]
          : [
              { duration: '2m', target: 50 },
              { duration: '2m', target: 100 },
              { duration: '2m', target: 200 },
              { duration: '2m', target: 400 },
            ],
    ),
  },
  thresholds: breakpointThresholds,
  summaryTrendStats,
};
export default concurrentReaders;
export const handleSummary = createSummary;
