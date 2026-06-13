import type { Options } from 'k6/options';
import { soakThresholds } from '../../config/thresholds/soak';
import { getWorkloadStages, rampingVus } from '../../config/workloads';
import { concurrentReaders } from '../../src/scenarios';
import { assertAuthorizedLoadTarget, createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

assertAuthorizedLoadTarget({ workload: 'Soak' });
export const options: Options = {
  scenarios: {
    endurance_readers: rampingVus(getWorkloadStages('soak'), '1m'),
  },
  thresholds: soakThresholds,
  summaryTrendStats,
};
export default concurrentReaders;
export const handleSummary = createSummary;
