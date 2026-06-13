import type { Options } from 'k6/options';
import { stressThresholds } from '../../config/thresholds/stress';
import { getWorkloadStages, rampingVus } from '../../config/workloads';
import { concurrentReaders } from '../../src/scenarios';
import { assertAuthorizedLoadTarget, createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

assertAuthorizedLoadTarget({ workload: 'Stress' });
export const options: Options = {
  scenarios: {
    stress_readers: rampingVus(getWorkloadStages('stress')),
  },
  thresholds: stressThresholds,
  summaryTrendStats,
};
export default concurrentReaders;
export const handleSummary = createSummary;
