import type { Threshold } from 'k6/options';

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
