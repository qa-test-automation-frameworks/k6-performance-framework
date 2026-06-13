import type { Options } from 'k6/options';
import { getWorkloadStages, rampingVus } from '../../config/workloads';
import { concurrentReaders } from '../../src/scenarios';
import { assertAuthorizedLoadTarget, createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';
import { breakpointThresholds } from '../../config/thresholds/breakpoint';

assertAuthorizedLoadTarget({ workload: 'Breakpoint' });
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
        : getWorkloadStages('breakpoint'),
    ),
  },
  thresholds: breakpointThresholds,
  summaryTrendStats,
};
export default concurrentReaders;
export const handleSummary = createSummary;
