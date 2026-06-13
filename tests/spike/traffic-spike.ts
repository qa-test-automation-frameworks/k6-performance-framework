import type { Options } from 'k6/options';
import { getWorkloadStages, rampingVus } from '../../config/workloads';
import { spikeReaders } from '../../src/scenarios';
import { assertAuthorizedLoadTarget, createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';
import { spikeThresholds } from '../../config/thresholds/spike';

assertAuthorizedLoadTarget({ workload: 'Spike' });
export const options: Options = {
  scenarios: {
    traffic_spike: rampingVus(getWorkloadStages('spike')),
  },
  thresholds: spikeThresholds,
  tags: { test_type: 'spike' },
  summaryTrendStats,
};
export default spikeReaders;
export const handleSummary = createSummary;
