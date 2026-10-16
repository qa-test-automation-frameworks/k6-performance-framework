const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  verifyExperiment,
  verifyHealthyAggregate,
} = require('../../scripts/verify-d04-experiment.cjs');

const TARGET_COMMIT = 'c8c66858a436a6e07f445fffe2253a65ff6dcb58';
const METRIC_NAMES = [
  'article_request_duration',
  'http_req_duration',
  'tag_request_duration',
];

function createStudy() {
  const manifest = {
    schemaVersion: 1,
    results: [],
    order: ['healthy', 'degraded', 'degraded', 'healthy', 'healthy', 'degraded'],
    target: {
      id: 'realworld-local-via-controlled-loopback-proxy',
      upstreamCommit: TARGET_COMMIT,
    },
    intervention: { delayMs: 125 },
    tool: { k6Version: '2.0.0', frameworkCommit: 'framework-sha' },
    runner: {
      class: 'Linux-X64',
      topology:
        'target, reverse proxy, and load generator are colocated on one GitHub-hosted runner',
    },
    workload: {
      repetitionsPerCondition: 3,
      requestsPerSecond: 15,
      maxVus: 30,
      warmupSeconds: 5,
      measurementSeconds: 15,
      minimumAchievedFraction: 0.98,
    },
  };
  const runs = [];
  const order = ['healthy', 'degraded', 'degraded', 'healthy', 'healthy', 'degraded'];
  for (const [index, condition] of order.entries()) {
    const repetition =
      manifest.results.filter((result) => result.condition === condition).length + 1;
    const result = {
      condition,
      repetition,
      order: index + 1,
      delayMs: condition === 'healthy' ? 0 : 125,
      summary: condition + '-' + repetition + '.json',
      exitCode: condition === 'healthy' ? 0 : 99,
      signal: null,
    };
    manifest.results.push(result);
    const baseLatency = condition === 'healthy' ? 20 + repetition : 150 + repetition;
    const metrics = Object.fromEntries(
      METRIC_NAMES.map((name) => [name, { 'p(95)': baseLatency, 'p(99)': baseLatency + 5 }]),
    );
    metrics['http_req_failed{scenario:request_measurement}'] = { rate: 0 };
    metrics['checks{scenario:request_measurement}'] = { rate: 1 };
    const summary = {
      metadata: {
        targetId: manifest.target.id,
        targetCommit: TARGET_COMMIT,
        environment: 'local',
        profile: 'd04-15rps-15s',
        k6Version: '2.0.0',
        runnerClass: 'Linux-X64',
        frameworkCommit: 'framework-sha',
        workloadSchema: 'single-request-arrival-v2',
        targetIterationsPerSecond: 15,
        targetRequestsPerSecond: 15,
        maxVus: 30,
        measurementSeconds: 15,
        warmupSeconds: 5,
        minimumAchievedFraction: 0.98,
        requestDrainSeconds: 2,
      },
      achievedLoad: {
        valid: true,
        requests: 225,
        startedRequests: 225,
        completedIterations: 225,
        droppedIterations: 0,
        achievedRequestsPerSecond: 15,
      },
      metrics,
      failures:
        condition === 'healthy'
          ? []
          : ['Threshold: http_req_duration: expected p(95)<80; actual ' + baseLatency],
    };
    runs.push({ result, summary });
  }
  return { manifest, runs };
}

describe('D04 controlled performance experiment verifier', () => {
  it('accepts repeated healthy and degraded runs with a clear observed p95 separation', () => {
    const { manifest, runs } = createStudy();
    const report = verifyExperiment(manifest, runs);
    expect(report.verified).toBe(true);
    expect(report.runCount).toBe(6);
    expect(report.comparisons[0].absoluteDeltaMs).toBe(130);
  });

  it('rejects a missing endpoint distribution instead of comparing a subset', () => {
    const { manifest, runs } = createStudy();
    delete runs[5].summary.metrics.tag_request_duration;
    expect(() => verifyExperiment(manifest, runs)).toThrow('missing one or more endpoint latency');
  });

  it('keeps endpoint distributions measurable without making them extra degraded thresholds', () => {
    const { manifest, runs } = createStudy();
    runs[1].summary.metrics.article_request_duration['p(95)'] = 1200;
    runs[1].summary.metrics.article_request_duration['p(99)'] = 1400;
    runs[1].summary.failures = [
      'Threshold: http_req_duration: expected p(95)<80; actual 151',
    ];
    expect(verifyExperiment(manifest, runs).verified).toBe(true);
  });

  it('rejects an invalid achieved-load cohort', () => {
    const { manifest, runs } = createStudy();
    runs[0].summary.achievedLoad.droppedIterations = 1;
    expect(() => verifyExperiment(manifest, runs)).toThrow('has missing, dropped, or incomplete');
  });

  it('rejects workload identity drift between comparison conditions', () => {
    const { manifest, runs } = createStudy();
    runs[1].summary.metadata.maxVus = 31;
    expect(() => verifyExperiment(manifest, runs)).toThrow(
      'incompatible workload identity: maxVus',
    );
  });

  it('rejects a degraded run that passes instead of triggering the intended threshold', () => {
    const { manifest, runs } = createStudy();
    runs[1].result.exitCode = 0;
    runs[1].summary.failures = [];
    expect(() => verifyExperiment(manifest, runs)).toThrow(
      'must fail only on the predeclared latency threshold control',
    );
  });

  it('rejects a control delay outside the declared experiment setting', () => {
    const { manifest, runs } = createStudy();
    manifest.intervention.delayMs = 300;
    expect(() => verifyExperiment(manifest, runs)).toThrow('predeclared 125 ms intervention');
  });

  it('reconciles the healthy median aggregate against every raw source hash', () => {
    const { manifest, runs } = createStudy();
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'd04-aggregate-'));
    const healthy = runs.filter(({ result }) => result.condition === 'healthy');
    const sourceSha256 = {};
    for (const { result, summary } of healthy) {
      const contents = JSON.stringify(summary);
      fs.writeFileSync(path.join(directory, result.summary), contents);
      sourceSha256[result.summary] = crypto.createHash('sha256').update(contents).digest('hex');
    }
    fs.writeFileSync(
      path.join(directory, 'd04-healthy-median.json'),
      JSON.stringify({
        metadata: {
          status: 'measured',
          sampleCount: 3,
          targetId: manifest.target.id,
          targetCommit: manifest.target.upstreamCommit,
          k6Version: manifest.tool.k6Version,
          runnerClass: manifest.runner.class,
          sourceSha256,
        },
        metrics: {
          http_req_duration: { 'p(95)': 22, 'p(99)': 27 },
        },
      }),
    );
    expect(verifyHealthyAggregate(directory, manifest).metadata.sampleCount).toBe(3);
    fs.appendFileSync(path.join(directory, healthy[0].result.summary), 'tampered');
    expect(() => verifyHealthyAggregate(directory, manifest)).toThrow('source hash mismatch');
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
