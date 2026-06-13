import { afterEach, describe, expect, it } from 'vitest';
import { getWorkloadStages } from '../../config/workloads';
import { setTestEnv } from './setup';

describe('getWorkloadStages', () => {
  afterEach(() => setTestEnv({}));

  it('returns full and validation profiles', () => {
    expect(getWorkloadStages('soak')).toContainEqual({ duration: '2h', target: 20 });
    setTestEnv({ TEST_PROFILE: 'validation' });
    expect(getWorkloadStages('soak')).toEqual([
      { duration: '5s', target: 2 },
      { duration: '10s', target: 2 },
      { duration: '5s', target: 0 },
    ]);
  });

  it('accepts a valid workload override', () => {
    setTestEnv({ STRESS_STAGES: '[{"duration":"30s","target":12}]' });
    expect(getWorkloadStages('stress')).toEqual([{ duration: '30s', target: 12 }]);
  });

  it.each([
    ['not-json', 'valid JSON'],
    ['{}', 'non-empty JSON array'],
    ['[]', 'non-empty JSON array'],
    ['[null]', 'non-empty JSON array'],
    ['[{"target":1}]', 'non-empty JSON array'],
    ['[{"duration":"1s","target":1.5}]', 'non-empty JSON array'],
    ['[{"duration":"1s","target":-1}]', 'non-empty JSON array'],
  ])('rejects invalid override %s', (override, message) => {
    setTestEnv({ STRESS_STAGES: override });
    expect(() => getWorkloadStages('stress')).toThrow(message);
  });
});
