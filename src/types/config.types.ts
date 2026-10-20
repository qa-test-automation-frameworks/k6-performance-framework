import type { Threshold } from 'k6/options';
import type { ScenarioOptions } from './scenario.types';

export type EnvironmentName = 'local' | 'staging' | 'production';

export interface EnvConfig {
  environment: EnvironmentName;
  baseUrl: string;
  timeouts: {
    http: number;
  };
  arrival: {
    iterationsPerSecond: number;
    maxVus: number;
  };
  tags: Record<string, string>;
  allowsWrites: boolean;
}

export type ThresholdSet = Record<string, Threshold[]>;

export const summaryTrendStats = ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'];

export interface WorkloadProfile {
  validation: boolean;
  targetIterationsPerSecond: number;
  maxVus: number;
  thinkTimeSeconds: number;
}

export interface WorkloadStage {
  duration: string;
  target: number;
}

export type StagedWorkload =
  | 'authenticatedLoad'
  | 'authenticatedStress'
  | 'stress'
  | 'spike'
  | 'soak'
  | 'breakpoint';

export type WorkloadScenario = ScenarioOptions;
