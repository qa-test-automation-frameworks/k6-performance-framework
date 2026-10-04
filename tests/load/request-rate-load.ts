import { check } from 'k6';
import execution from 'k6/execution';
import http from 'k6/http';
import { Counter } from 'k6/metrics';
import type { Options } from 'k6/options';
import { getConfig } from '../../config';
import { getRequestRateProfile, REQUEST_DRAIN_SECONDS } from '../../config/workloads';
import { assertAuthorizedLoadTarget, createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

assertAuthorizedLoadTarget({ workload: 'Single-request arrival load' });
if (__ENV.WORKLOAD_MODE !== 'request-rate') {
  throw new Error('Set WORKLOAD_MODE=request-rate for this dedicated entry point');
}
const profile = getRequestRateProfile();
const config = getConfig();
const minimumCount = Math.ceil(
  profile.requestsPerSecond * profile.measurementSeconds * profile.minimumAchievedFraction,
);
const expectedCount = profile.requestsPerSecond * profile.measurementSeconds;
const requestAttempts = new Counter('request_attempts');

export const options: Options = {
  scenarios: {
    request_warmup: {
      executor: 'constant-arrival-rate',
      exec: 'singleRequest',
      rate: profile.requestsPerSecond,
      timeUnit: '1s',
      duration: `${profile.warmupSeconds}s`,
      preAllocatedVUs: Math.min(20, profile.maxVus),
      maxVUs: profile.maxVus,
      gracefulStop: `${REQUEST_DRAIN_SECONDS}s`,
    },
    request_measurement: {
      executor: 'constant-arrival-rate',
      exec: 'singleRequest',
      startTime: `${profile.warmupSeconds + 2}s`,
      rate: profile.requestsPerSecond,
      timeUnit: '1s',
      duration: `${profile.measurementSeconds}s`,
      preAllocatedVUs: Math.min(20, profile.maxVus),
      maxVUs: profile.maxVus,
      gracefulStop: `${REQUEST_DRAIN_SECONDS}s`,
    },
  },
  // Creating submetrics through thresholds makes their count available in the native summary.
  thresholds: {
    'request_attempts{scenario:request_measurement}': [
      `count>=${minimumCount}`,
      `count<=${expectedCount + 1}`,
    ],
    'http_reqs{scenario:request_measurement}': [
      `count>=${minimumCount}`,
      `count<=${expectedCount + 1}`,
    ],
    'iterations{scenario:request_measurement}': [`count>=${minimumCount}`],
    'dropped_iterations{scenario:request_measurement}': ['count==0'],
    'checks{scenario:request_measurement}': ['rate==1'],
    'http_req_failed{scenario:request_measurement}': ['rate<0.01'],
    'http_req_duration{scenario:request_measurement}': ['p(95)<80', 'p(99)<150'],
  },
  maxRedirects: 0,
  summaryTrendStats,
};

/** Fixed 80/20 articles/tags mix. Direct HTTP: exactly one attempt, zero redirects, no sleep. */
export function singleRequest(): void {
  const path =
    execution.scenario.iterationInTest % 5 === 4 ? '/tags' : '/articles?limit=10&offset=0';
  requestAttempts.add(1);
  const response = http.get(`${config.baseUrl.replace(/\/$/, '')}${path}`, {
    redirects: 0,
    timeout: '1s',
    headers: { 'X-Load-Phase': execution.scenario.name },
    tags: { ...config.tags, name: path.startsWith('/tags') ? 'GET /tags' : 'GET /articles' },
  });
  check(response, { 'single request status is 200': (result) => result.status === 200 });
}

export const handleSummary = createSummary;
