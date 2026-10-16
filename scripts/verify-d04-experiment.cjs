const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const DELAY_MS = 125;
const MINIMUM_ABSOLUTE_P95_DELTA_MS = 75;

function percentile(summary, metric, key) {
  const value = summary.metrics?.[metric]?.[key];
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('Missing or invalid ' + metric + '.' + key);
  }
  return value;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function verifyHealthyAggregate(directory, manifest) {
  const aggregatePath = path.join(directory, 'd04-healthy-median.json');
  const aggregate = JSON.parse(fs.readFileSync(aggregatePath, 'utf8'));
  const healthyResults = manifest.results.filter((result) => result.condition === 'healthy');
  if (aggregate.metadata?.status !== 'measured' || aggregate.metadata.sampleCount !== 3) {
    throw new Error('D04 healthy aggregate is not a measured three-run median baseline');
  }
  if (
    aggregate.metadata.targetId !== manifest.target.id ||
    aggregate.metadata.targetCommit !== manifest.target.upstreamCommit ||
    aggregate.metadata.k6Version !== manifest.tool.k6Version ||
    aggregate.metadata.runnerClass !== manifest.runner.class
  ) {
    throw new Error('D04 healthy aggregate identity differs from the experiment manifest');
  }
  for (const result of healthyResults) {
    const expectedHash = crypto
      .createHash('sha256')
      .update(fs.readFileSync(path.join(directory, result.summary)))
      .digest('hex');
    if (aggregate.metadata.sourceSha256?.[result.summary] !== expectedHash) {
      throw new Error('D04 healthy aggregate source hash mismatch for ' + result.summary);
    }
  }
  for (const [metric, values] of Object.entries(aggregate.metrics ?? {})) {
    for (const key of Object.keys(values).filter((name) =>
      ['p(95)', 'p(99)', 'rate', 'count'].includes(name),
    )) {
      const sourceValues = healthyResults.map((result) => {
        const summary = JSON.parse(fs.readFileSync(path.join(directory, result.summary), 'utf8'));
        const value = summary.metrics?.[metric]?.[key];
        if (!Number.isFinite(value)) {
          throw new Error('Raw healthy run is missing ' + metric + '.' + key);
        }
        return value;
      });
      if (values[key] !== median(sourceValues)) {
        throw new Error(
          'D04 healthy aggregate does not contain the raw-run median for ' + metric + '.' + key,
        );
      }
    }
  }
  return aggregate;
}

function readExperiment(directory) {
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'd04-experiment.json'), 'utf8'));
  const summaries = manifest.results.map((result) => ({
    result,
    summary: JSON.parse(fs.readFileSync(path.join(directory, result.summary), 'utf8')),
  }));
  return { manifest, summaries };
}

function verifyExperiment(manifest, runs) {
  if (manifest.schemaVersion !== 1 || manifest.results.length !== 6 || runs.length !== 6) {
    throw new Error('D04 requires exactly six run records and schema version 1');
  }
  if (manifest.intervention?.delayMs !== DELAY_MS) {
    throw new Error('D04 controlled delay must match the predeclared 125 ms intervention');
  }
  if (manifest.workload?.repetitionsPerCondition !== 3) {
    throw new Error('D04 requires at least three raw runs per condition');
  }
  const expectedOrder = ['healthy', 'degraded', 'degraded', 'healthy', 'healthy', 'degraded'];
  if (JSON.stringify(manifest.order) !== JSON.stringify(expectedOrder)) {
    throw new Error('D04 run order differs from its declared interleaved schedule');
  }
  if (
    manifest.workload.requestsPerSecond !== 15 ||
    manifest.workload.maxVus !== 30 ||
    manifest.workload.warmupSeconds !== 5 ||
    manifest.workload.measurementSeconds !== 15 ||
    manifest.workload.minimumAchievedFraction !== 0.98
  ) {
    throw new Error('D04 workload differs from the declared bounded profile');
  }
  if (
    !/^[0-9a-f]{40}$/i.test(manifest.target?.upstreamCommit ?? '') ||
    manifest.tool?.k6Version !== '2.0.0'
  ) {
    throw new Error('D04 target commit and k6 version must be pinned');
  }
  if (
    manifest.runner?.topology !==
    'target, reverse proxy, and load generator are colocated on one GitHub-hosted runner'
  ) {
    throw new Error('D04 runner topology and its colocation limitation must be declared');
  }

  const groups = { healthy: [], degraded: [] };
  const summaryNames = new Set();
  let workloadIdentity = null;
  let metricNames = null;

  for (const [runIndex, { result, summary }] of runs.entries()) {
    if (result.order !== runIndex + 1 || result.condition !== expectedOrder[runIndex]) {
      throw new Error('D04 trial order is missing or invalid');
    }
    if (!['healthy', 'degraded'].includes(result.condition)) {
      throw new Error('Unknown D04 condition: ' + result.condition);
    }
    if (summaryNames.has(result.summary))
      throw new Error('Duplicate D04 summary: ' + result.summary);
    summaryNames.add(result.summary);
    groups[result.condition].push({ result, summary });
    const actualDelay = result.condition === 'healthy' ? 0 : DELAY_MS;
    if (result.delayMs !== actualDelay)
      throw new Error('Recorded intervention does not match group');

    const identity = summary.metadata;
    if (identity.targetCommit !== manifest.target.upstreamCommit) {
      throw new Error('Raw summary target commit differs from experiment manifest');
    }
    if (identity.k6Version !== manifest.tool.k6Version) {
      throw new Error('Raw summary k6 version differs from experiment manifest');
    }
    if (
      identity.targetId !== manifest.target.id ||
      identity.runnerClass !== manifest.runner.class
    ) {
      throw new Error('Raw summary target or runner identity differs from experiment manifest');
    }
    if (workloadIdentity === null) {
      workloadIdentity = identity;
    } else {
      const fields = [
        'workloadSchema',
        'targetIterationsPerSecond',
        'targetRequestsPerSecond',
        'maxVus',
        'profile',
        'measurementSeconds',
        'warmupSeconds',
        'minimumAchievedFraction',
        'requestDrainSeconds',
      ];
      for (const field of fields) {
        if (identity[field] !== workloadIdentity[field]) {
          throw new Error('D04 runs have incompatible workload identity: ' + field);
        }
      }
      for (const field of [
        'targetId',
        'targetCommit',
        'environment',
        'profile',
        'k6Version',
        'runnerClass',
        'frameworkCommit',
      ]) {
        if (identity[field] !== workloadIdentity[field]) {
          throw new Error('D04 runs have incompatible ' + field + ' identity');
        }
      }
    }

    if (summary.achievedLoad?.valid !== true) {
      throw new Error(result.summary + ' did not achieve the declared request-rate workload');
    }
    if (
      summary.achievedLoad.droppedIterations !== 0 ||
      summary.achievedLoad.requests < 15 * 15 * 0.98 ||
      summary.achievedLoad.requests !== summary.achievedLoad.startedRequests ||
      summary.achievedLoad.requests !== summary.achievedLoad.completedIterations
    ) {
      throw new Error(result.summary + ' has missing, dropped, or incomplete measurement requests');
    }
    const failedRate = percentile(summary, 'http_req_failed{scenario:request_measurement}', 'rate');
    const checkRate = percentile(summary, 'checks{scenario:request_measurement}', 'rate');
    if (failedRate !== 0 || checkRate !== 1) {
      throw new Error(result.summary + ' contains HTTP failures or failed response checks');
    }

    const currentMetricNames = Object.keys(summary.metrics ?? {})
      .filter((name) =>
        ['http_req_duration', 'article_request_duration', 'tag_request_duration'].includes(name),
      )
      .sort();
    if (
      currentMetricNames.length < 3 ||
      (metricNames !== null && JSON.stringify(currentMetricNames) !== JSON.stringify(metricNames))
    ) {
      throw new Error(result.summary + ' is missing one or more endpoint latency distributions');
    }
    if (metricNames === null) metricNames = currentMetricNames;
    for (const name of currentMetricNames) {
      percentile(summary, name, 'p(95)');
      percentile(summary, name, 'p(99)');
    }

    if (result.condition === 'healthy') {
      if (result.exitCode !== 0 || result.signal !== null || summary.failures.length !== 0) {
        throw new Error(result.summary + ' healthy control must pass k6 thresholds');
      }
    } else {
      const thresholdFailures = summary.failures.filter((failure) =>
        failure.startsWith('Threshold: http_req_duration:'),
      );
      if (
        result.exitCode === 0 ||
        result.signal !== null ||
        thresholdFailures.length === 0 ||
        thresholdFailures.length !== summary.failures.length
      ) {
        throw new Error(
          result.summary + ' must fail only on the predeclared latency threshold control',
        );
      }
    }
  }

  if (groups.healthy.length !== 3 || groups.degraded.length !== 3) {
    throw new Error('D04 requires exactly three raw runs in each condition');
  }
  const comparisons = metricNames.map((metric) => {
    const healthy = groups.healthy.map(({ summary }) => percentile(summary, metric, 'p(95)'));
    const degraded = groups.degraded.map(({ summary }) => percentile(summary, metric, 'p(95)'));
    const healthyP99 = groups.healthy.map(({ summary }) => percentile(summary, metric, 'p(99)'));
    const degradedP99 = groups.degraded.map(({ summary }) => percentile(summary, metric, 'p(99)'));
    const healthyMedian = median(healthy);
    const degradedMedian = median(degraded);
    const healthyP99Median = median(healthyP99);
    const degradedP99Median = median(degradedP99);
    const absoluteDelta = degradedMedian - healthyMedian;
    const relativeChangePercent =
      healthyMedian === 0
        ? degradedMedian === 0
          ? 0
          : null
        : (absoluteDelta / healthyMedian) * 100;
    if (Math.min(...degraded) <= Math.max(...healthy) + MINIMUM_ABSOLUTE_P95_DELTA_MS) {
      throw new Error(metric + ' does not separate degraded and healthy p95 ranges by 75 ms');
    }
    return {
      metric,
      healthyP95Ms: { min: Math.min(...healthy), median: healthyMedian, max: Math.max(...healthy) },
      degradedP95Ms: {
        min: Math.min(...degraded),
        median: degradedMedian,
        max: Math.max(...degraded),
      },
      healthyP99Ms: {
        min: Math.min(...healthyP99),
        median: healthyP99Median,
        max: Math.max(...healthyP99),
      },
      degradedP99Ms: {
        min: Math.min(...degradedP99),
        median: degradedP99Median,
        max: Math.max(...degradedP99),
      },
      absoluteDeltaMs: absoluteDelta,
      relativeChangePercent,
      p99AbsoluteDeltaMs: degradedP99Median - healthyP99Median,
      p99RelativeChangePercent:
        healthyP99Median === 0
          ? degradedP99Median === 0
            ? 0
            : null
          : ((degradedP99Median - healthyP99Median) / healthyP99Median) * 100,
      healthyRequestsPerSecond: groups.healthy.map(
        ({ summary }) => summary.achievedLoad.achievedRequestsPerSecond,
      ),
      degradedRequestsPerSecond: groups.degraded.map(
        ({ summary }) => summary.achievedLoad.achievedRequestsPerSecond,
      ),
      droppedIterations: groups.healthy.concat(groups.degraded).map(({ summary }) => {
        return summary.achievedLoad.droppedIterations;
      }),
    };
  });
  return {
    schemaVersion: 1,
    verified: true,
    target: manifest.target,
    intervention: manifest.intervention,
    tool: manifest.tool,
    runner: manifest.runner,
    workload: manifest.workload,
    runCount: runs.length,
    comparisons,
    interpretation:
      'Three repeated runs per condition; ranges describe this small sample and are not confidence intervals. Colocated target/generator results do not establish standalone application capacity.',
  };
}

function reportMarkdown(report) {
  const rows = report.comparisons.flatMap((comparison) => {
    const statisticRows = [
      {
        statistic: 'p95',
        healthy: comparison.healthyP95Ms,
        degraded: comparison.degradedP95Ms,
        delta: comparison.absoluteDeltaMs,
        relative: comparison.relativeChangePercent,
      },
      {
        statistic: 'p99',
        healthy: comparison.healthyP99Ms,
        degraded: comparison.degradedP99Ms,
        delta: comparison.p99AbsoluteDeltaMs,
        relative: comparison.p99RelativeChangePercent,
      },
    ];
    return statisticRows.map((row) => {
      const relative =
        row.relative === null ? 'undefined from zero' : '+' + row.relative.toFixed(1) + '%';
      return (
        '| ' +
        comparison.metric +
        ' | ' +
        row.statistic +
        ' | ' +
        row.healthy.min.toFixed(2) +
        ' / ' +
        row.healthy.median.toFixed(2) +
        ' / ' +
        row.healthy.max.toFixed(2) +
        ' ms | ' +
        row.degraded.min.toFixed(2) +
        ' / ' +
        row.degraded.median.toFixed(2) +
        ' / ' +
        row.degraded.max.toFixed(2) +
        ' ms | +' +
        row.delta.toFixed(2) +
        ' ms | ' +
        relative +
        ' |'
      );
    });
  });
  const throughput = report.comparisons[0];
  const healthyRates = throughput.healthyRequestsPerSecond;
  const degradedRates = throughput.degradedRequestsPerSecond;
  const rateRange = (values) =>
    Math.min(...values).toFixed(2) +
    ' / ' +
    median(values).toFixed(2) +
    ' / ' +
    Math.max(...values).toFixed(2);
  return [
    '# D04 — Reproducible k6 latency regression study',
    '',
    '**Disposition:** verified controlled latency regression; all healthy runs passed, all degraded runs failed only the expected latency threshold, and all six workloads remained valid with zero drops and no HTTP/check failures.',
    '',
    '- Target: ' + report.target.id + ' at upstream commit ' + report.target.upstreamCommit + '.',
    '- k6: ' + report.tool.k6Version + '; runner: ' + report.runner.class + '.',
    '- Workload: ' +
      report.workload.requestsPerSecond +
      ' requests/s, ' +
      report.workload.measurementSeconds +
      ' measurement seconds after ' +
      report.workload.warmupSeconds +
      ' warm-up seconds, at most ' +
      report.workload.maxVus +
      ' VUs; three runs per condition.',
    '- Intervention: fixed ' +
      report.intervention.delayMs +
      ' ms response delay after the same upstream application response.',
    '- Achieved request rate (min / median / max): healthy ' +
      rateRange(healthyRates) +
      ' requests/s; degraded ' +
      rateRange(degradedRates) +
      ' requests/s. All runs recorded zero dropped iterations, zero failed HTTP requests and 100% successful response checks.',
    '- Resource context: ' +
      report.runner.availableParallelism +
      ' available logical CPUs, ' +
      report.runner.reportedMemoryBytes +
      ' reported host memory bytes, cgroup CPU limit ' +
      report.runner.cgroupCpuMax +
      ', cgroup memory limit ' +
      report.runner.cgroupMemoryMaxBytes +
      '.',
    '- Topology: ' + report.runner.topology + '.',
    '',
    '| Metric | Statistic | Healthy min / median / max | Degraded min / median / max | Median delta | Relative change |',
    '|---|---|---:|---:|---:|---:|',
    ...rows,
    '',
    'The healthy baseline is the median of three raw runs per metric. The ranges show only the observed n=3 samples; they are not confidence intervals. The verifier requires each degraded p95 minimum to exceed the largest healthy p95 by at least 75 ms, in addition to a 125 ms configured delay. This is a controlled experiment against a pinned local target, not a production-capacity claim. The target, proxy and load generator share a runner, so contention can confound absolute latency.',
    '',
    'Raw native summaries, trial stdout/stderr, the generated median baseline, manifest and machine-readable decision are retained in the d04-performance-evidence CI artifact.',
    '',
  ].join('\n');
}

if (require.main === module) {
  const directory = path.resolve(process.argv[2] ?? 'reports');
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'd04-experiment.json'), 'utf8'));
  verifyHealthyAggregate(directory, manifest);
  const runs = manifest.results.map((result) => ({
    result,
    summary: JSON.parse(fs.readFileSync(path.join(directory, result.summary), 'utf8')),
  }));
  const report = verifyExperiment(manifest, runs);
  fs.writeFileSync(
    path.join(directory, 'd04-verification.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  fs.writeFileSync(path.join(directory, 'd04-report.md'), reportMarkdown(report));
  console.log('Verified six raw D04 runs and wrote reports/d04-report.md');
}

module.exports = { reportMarkdown, verifyExperiment, verifyHealthyAggregate };
