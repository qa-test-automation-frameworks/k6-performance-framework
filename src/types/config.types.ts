import type { Threshold } from 'k6/options';
import type { ScenarioOptions } from './scenario.types';

export type EnvironmentName = 'local' | 'staging' | 'production';

export interface EnvConfig {
  environment: EnvironmentName;
  baseUrl: string;
  timeouts: {
    http: number;
    connect: number;
  };
  rps: {
    target: number;
    max: number;
  };
  tags: Record<string, string>;
  readOnly: boolean;
}

export type ThresholdSet = Record<string, Threshold[]>;

export const summaryTrendStats = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];

export interface WorkloadProfile {
  validation: boolean;
  targetRps: number;
  maxVus: number;
  thinkTimeSeconds: number;
}

export type WorkloadScenario = ScenarioOptions;
