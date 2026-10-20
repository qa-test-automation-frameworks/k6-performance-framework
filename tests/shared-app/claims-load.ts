import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';

const baseUrl = (__ENV.BASE_URL ?? 'http://127.0.0.1:4300').replace(/\/+$/, '');
const targetId = __ENV.TARGET_ID ?? 'quality-reference-application';
const targetCommit = __ENV.TARGET_COMMIT ?? 'e9f438e06a2b092dccfc6e9ab1820ff2562ddad7';
const fixtureVersion = __ENV.FIXTURE_VERSION ?? 'v0.1.0';
const rps = Number(__ENV.REQUESTS_PER_SECOND ?? '20');
const maxVUs = Number(__ENV.MAX_VUS ?? '10');
const duration = __ENV.MEASUREMENT_DURATION ?? '60s';
const namespace = __ENV.APP_NAMESPACE;

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(baseUrl)) {
  throw new Error('Shared-app load must target a loopback URL');
}
if (!namespace || !/^[a-zA-Z0-9-]{8,64}$/.test(namespace)) {
  throw new Error('APP_NAMESPACE must identify this isolated run');
}
if (!Number.isSafeInteger(rps) || rps < 1 || rps > 50)
  throw new Error('REQUESTS_PER_SECOND must be 1..50');
if (!Number.isSafeInteger(maxVUs) || maxVUs < 1 || maxVUs > 20)
  throw new Error('MAX_VUS must be 1..20');

const policyId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const policyIds = new SharedArray('seeded member policies', () => [policyId]);
const readDuration = new Trend('reference_read_duration_ms', true);
const writeDuration = new Trend('reference_write_duration_ms', true);
const contractChecks = new Rate('reference_contract_checks');
const requestErrors = new Counter('reference_request_errors');

export const options = {
  scenarios: {
    claims_mix: {
      executor: 'constant-arrival-rate',
      rate: rps,
      timeUnit: '1s',
      duration,
      preAllocatedVUs: Math.min(maxVUs, rps),
      maxVUs,
      tags: {
        target_id: targetId,
        target_commit: targetCommit,
        fixture_version: fixtureVersion,
        namespace,
      },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    dropped_iterations: ['count==0'],
    reference_contract_checks: ['rate>0.99'],
    reference_read_duration_ms: ['p(95)<500'],
    reference_write_duration_ms: ['p(95)<750'],
  },
};

interface Session {
  token: string;
}
interface SetupData {
  sessions: Session[];
}

export function setup(): SetupData {
  const sessions: Session[] = [];
  for (let index = 0; index < maxVUs; index += 1) {
    const response = http.post(
      `${baseUrl}/api/v1/sessions`,
      JSON.stringify({ identityKey: 'member-a' }),
      {
        headers: { 'Content-Type': 'application/json' },
        tags: { name: 'POST /api/v1/sessions', phase: 'setup' },
      },
    );
    const valid = check(response, {
      'session contract: 201 with bearer token': (res) => {
        if (res.status !== 201) return false;
        try {
          const body = res.json() as { token?: unknown; tokenType?: unknown };
          return typeof body.token === 'string' && body.tokenType === 'Bearer';
        } catch {
          return false;
        }
      },
    });
    if (!valid) throw new Error(`Session setup failed with HTTP ${response.status}`);
    sessions.push({ token: String((response.json() as { token: string }).token) });
  }
  return { sessions };
}

function record(
  response: http.RefinedResponse<'text'>,
  label: string,
  durationMetric: Trend,
  expected: number,
  contract: (body: unknown) => boolean,
): void {
  durationMetric.add(response.timings.duration, { operation: label });
  let valid = response.status === expected;
  if (valid) {
    try {
      valid = contract(response.json());
    } catch {
      valid = false;
    }
  }
  contractChecks.add(valid, { operation: label });
  if (!valid) requestErrors.add(1, { operation: label, status: String(response.status) });
  check(response, { [`${label}: HTTP ${expected} and response contract`]: () => valid });
}

export default function (data: SetupData): void {
  const session = data.sessions[(__VU - 1) % data.sessions.length];
  if (!session) throw new Error('No synthetic member session is available for this VU');
  const headers = { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' };
  // Stagger a deterministic 20-iteration mix across VUs: 14 reads, 5 claim reads, 1 write.
  const choice = (__ITER + __VU - 1) % 20;
  if (choice < 14) {
    const response = http.get(`${baseUrl}/api/v1/policies`, {
      headers,
      tags: { name: 'GET /api/v1/policies', operation: 'read' },
    });
    record(response, 'policy list', readDuration, 200, (body) => {
      const items = (body as { items?: unknown[] }).items;
      return (
        Array.isArray(items) &&
        items.length === 1 &&
        (items[0] as { id?: string }).id === policyIds[0]
      );
    });
  } else if (choice < 19) {
    const response = http.get(`${baseUrl}/api/v1/claims`, {
      headers,
      tags: { name: 'GET /api/v1/claims', operation: 'read' },
    });
    record(response, 'claim list', readDuration, 200, (body) =>
      Array.isArray((body as { items?: unknown[] }).items),
    );
  } else {
    const response = http.post(
      `${baseUrl}/api/v1/claims`,
      JSON.stringify({
        policyId: policyIds[0],
        amountMinor: 1000,
        currency: 'USD',
        category: 'auto',
      }),
      { headers, tags: { name: 'POST /api/v1/claims', operation: 'write' } },
    );
    record(response, 'claim create', writeDuration, 201, (body) => {
      const claim = (body as { claim?: { id?: unknown; amountMinor?: unknown; status?: unknown } })
        .claim;
      return (
        typeof claim?.id === 'string' && claim.amountMinor === 1000 && claim.status === 'submitted'
      );
    });
  }
  sleep(0.1);
}

export function handleSummary(data: unknown): Record<string, string> {
  const raw = data as {
    metrics: Record<
      string,
      { values: Record<string, number>; thresholds?: Record<string, { ok: boolean }> }
    >;
    state: Record<string, number>;
  };
  const metrics = Object.fromEntries(
    Object.entries(raw.metrics).map(([name, metric]) => [name, metric.values]),
  );
  const failures = Object.entries(raw.metrics).flatMap(([name, metric]) =>
    Object.entries(metric.thresholds ?? {})
      .filter(([, result]) => !result.ok)
      .map(([threshold]) => `Threshold: ${name} ${threshold}`),
  );
  const checkFailures = raw.metrics.checks?.values.fails ?? 0;
  if (checkFailures > 0) failures.push(`Checks: ${checkFailures} failed`);
  if ((raw.state.dropped_iterations ?? 0) > 0) failures.push('Execution: dropped iterations');
  const summary = {
    failures,
    generatedAt: new Date().toISOString(),
    metrics,
    metadata: {
      environment: 'isolated-compose',
      frameworkCommit: __ENV.FRAMEWORK_COMMIT ?? 'unknown',
      k6Version: __ENV.K6_VERSION ?? '2.0.0',
      maxVUs,
      profile: 'shared-app-mixed-70-25-5',
      runnerClass: __ENV.RUNNER_CLASS ?? 'local',
      targetCommit,
      targetId,
      fixtureVersion,
      namespace,
      workloadSchema: 'single-request-arrival-v1',
      targetRequestsPerSecond: rps,
      measurementDuration: duration,
    },
    intended: {
      requestsPerSecond: rps,
      duration,
      maxVUs,
      requestMix: { policyReads: 0.7, claimReads: 0.25, claimWrites: 0.05 },
    },
  };
  return { 'reports/shared-app-summary.json': JSON.stringify(summary, null, 2) };
}
