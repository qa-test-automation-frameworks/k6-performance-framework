'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MINIMUM_RESOURCE_COVERAGE = 0.8;
const HIGH_UTILIZATION = 0.9;
const HIGH_SAMPLE_FRACTION = 0.5;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;

function fail(message) {
  throw new Error(message);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireRecord(value, label) {
  if (!isRecord(value)) fail(`${label} must be a JSON object`);
  return value;
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') fail(`${label} must be a non-empty string`);
  return value;
}

function requireFiniteNonnegative(value, label, { positive = false } = {}) {
  if (!Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    fail(`${label} must be a finite ${positive ? 'positive' : 'non-negative'} number`);
  }
  return value;
}

function requireOptionalPositiveLimit(value, label) {
  if (value === undefined || value === null) return null;
  return requireFiniteNonnegative(value, label, { positive: true });
}

function requireUtcTimestamp(value, label) {
  if (
    typeof value !== 'string' ||
    !UTC_TIMESTAMP.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(`${label} must be an ISO 8601 UTC timestamp ending in Z`);
  }
  return Date.parse(value);
}

function getPathValue(value, dottedPath) {
  return dottedPath.split('.').reduce((current, part) => {
    if (!isRecord(current) || !Object.hasOwn(current, part)) return undefined;
    return current[part];
  }, value);
}

function setPathValue(value, dottedPath, replacement) {
  const parts = dottedPath.split('.');
  const leaf = parts.pop();
  const parent = parts.reduce((current, part) => current[part], value);
  if (replacement === undefined) delete parent[leaf];
  else parent[leaf] = replacement;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function resolveInputPath(planDirectory, inputPath, label) {
  requireString(inputPath, label);
  if (path.isAbsolute(inputPath)) fail(`${label} must be relative to the plan file`);
  const resolved = path.resolve(planDirectory, inputPath);
  const relative = path.relative(planDirectory, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`)) {
    fail(`${label} must stay within the plan directory`);
  }
  return resolved;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    fail(`${label} could not be read as JSON: ${error.message}`);
  }
}

function validatePlan(plan) {
  requireRecord(plan, 'Plan');
  if (plan.schema_version !== 1) fail('Plan schema_version must be 1');
  requireString(plan.experiment_id, 'Plan experiment_id');
  if (!['fixture-only', 'externally-collected'].includes(plan.source_kind)) {
    fail('Plan source_kind must be fixture-only or externally-collected');
  }
  requireFiniteNonnegative(plan.sample_interval_seconds, 'Plan sample_interval_seconds', {
    positive: true,
  });
  if (
    !Number.isInteger(plan.minimum_samples_per_condition) ||
    plan.minimum_samples_per_condition < 2
  ) {
    fail('Plan minimum_samples_per_condition must be an integer of at least 2');
  }
  requireString(plan.baseline_condition, 'Plan baseline_condition');
  requireString(plan.challenger_condition, 'Plan challenger_condition');
  if (plan.baseline_condition === plan.challenger_condition) {
    fail('Plan baseline_condition and challenger_condition must differ');
  }

  const intervention = requireRecord(plan.sole_intervention, 'Plan sole_intervention');
  requireString(intervention.path, 'Plan sole_intervention.path');
  if (!intervention.path.startsWith('controlled.')) {
    fail('Plan sole_intervention.path must identify a field under controlled');
  }
  const pathParts = intervention.path.split('.');
  if (pathParts.some((part) => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(part))) {
    fail('Plan sole_intervention.path contains an invalid field name');
  }
  if (
    !['string', 'number'].includes(typeof intervention.baseline_value) ||
    !['string', 'number'].includes(typeof intervention.challenger_value) ||
    intervention.baseline_value === intervention.challenger_value
  ) {
    fail('Plan sole_intervention values must be different strings or numbers');
  }

  const sloThresholds = requireRecord(plan.slo_thresholds, 'Plan slo_thresholds');
  requireFiniteNonnegative(sloThresholds.p95_latency_ms, 'Plan p95_latency_ms', { positive: true });
  requireFiniteNonnegative(sloThresholds.error_rate_percent, 'Plan error_rate_percent');
  if (sloThresholds.error_rate_percent > 100) {
    fail('Plan error_rate_percent must not exceed 100');
  }
  if (!Array.isArray(plan.sample_files) || plan.sample_files.length === 0) {
    fail('Plan sample_files must contain at least one summary path');
  }
  plan.sample_files.forEach((entry, index) => {
    requireRecord(entry, `Plan sample_files[${index}]`);
    requireString(entry.path, `Plan sample_files[${index}].path`);
    if (![plan.baseline_condition, plan.challenger_condition].includes(entry.condition)) {
      fail(`Plan sample_files[${index}].condition must name a declared cohort`);
    }
  });
  if (plan.resource_file !== undefined && plan.resource_file !== null) {
    requireString(plan.resource_file, 'Plan resource_file');
  }
}

function validateSample(sample, expectedCondition, plan, label) {
  requireRecord(sample, label);
  if (sample.schema_version !== 1) fail(`${label} schema_version must be 1`);
  requireString(sample.run_id, `${label} run_id`);
  if (sample.condition !== expectedCondition) {
    fail(`${label} condition does not match the plan entry`);
  }

  const controlled = requireRecord(sample.controlled, `${label} controlled`);
  const target = requireRecord(controlled.target, `${label} controlled.target`);
  requireString(target.id, `${label} controlled.target.id`);
  requireString(target.revision, `${label} controlled.target.revision`);
  requireOptionalPositiveLimit(
    target.cpu_limit_cores,
    `${label} controlled.target.cpu_limit_cores`,
  );
  requireOptionalPositiveLimit(
    target.memory_limit_bytes,
    `${label} controlled.target.memory_limit_bytes`,
  );

  const framework = requireRecord(controlled.framework, `${label} controlled.framework`);
  requireString(framework.name, `${label} controlled.framework.name`);
  requireString(framework.version, `${label} controlled.framework.version`);
  requireString(framework.revision, `${label} controlled.framework.revision`);

  const generator = requireRecord(controlled.generator, `${label} controlled.generator`);
  requireString(generator.id, `${label} controlled.generator.id`);
  requireOptionalPositiveLimit(
    generator.cpu_limit_cores,
    `${label} controlled.generator.cpu_limit_cores`,
  );
  requireOptionalPositiveLimit(
    generator.memory_limit_bytes,
    `${label} controlled.generator.memory_limit_bytes`,
  );

  const environment = requireRecord(controlled.environment, `${label} controlled.environment`);
  requireString(environment.id, `${label} controlled.environment.id`);

  const workload = requireRecord(controlled.workload, `${label} controlled.workload`);
  if (!['request_rate', 'vus'].includes(workload.mode)) {
    fail(`${label} controlled.workload.mode must be request_rate or vus`);
  }
  const configured = requireRecord(
    workload.configured_arrival,
    `${label} controlled.workload.configured_arrival`,
  );
  requireFiniteNonnegative(
    configured.value,
    `${label} controlled.workload.configured_arrival.value`,
    {
      positive: true,
    },
  );
  const expectedUnit = workload.mode === 'request_rate' ? 'requests_per_second' : 'vus';
  if (configured.unit !== expectedUnit) {
    fail(
      `${label} configured arrival unit ${JSON.stringify(configured.unit)} conflicts with workload mode ${workload.mode}; expected ${expectedUnit}`,
    );
  }
  if (workload.mode === 'vus') {
    requireFiniteNonnegative(workload.max_vus, `${label} controlled.workload.max_vus`, {
      positive: true,
    });
    if (configured.value > workload.max_vus) {
      fail(`${label} configured VUs must not exceed max_vus`);
    }
  }

  const throughput = requireRecord(sample.actual_throughput, `${label} actual_throughput`);
  requireFiniteNonnegative(throughput.value, `${label} actual_throughput.value`);
  if (throughput.unit !== 'requests_per_second') {
    fail(`${label} actual_throughput.unit must be requests_per_second`);
  }
  requireFiniteNonnegative(sample.duration_seconds, `${label} duration_seconds`, {
    positive: true,
  });

  const achievedLoad = requireRecord(sample.achieved_load, `${label} achieved_load`);
  if (typeof achievedLoad.valid !== 'boolean') {
    fail(`${label} achieved_load.valid must be true or false`);
  }
  if (achievedLoad.reason !== undefined && typeof achievedLoad.reason !== 'string') {
    fail(`${label} achieved_load.reason must be a string when present`);
  }

  if (
    !Array.isArray(sample.native_failures) ||
    sample.native_failures.some((failure) => typeof failure !== 'string')
  ) {
    fail(`${label} native_failures must be an array of strings`);
  }
  const sloMetrics =
    sample.slo_metrics === undefined
      ? {}
      : requireRecord(sample.slo_metrics, `${label} slo_metrics`);
  for (const key of ['p95_latency_ms', 'error_rate_percent']) {
    if (sloMetrics[key] !== undefined && sloMetrics[key] !== null) {
      requireFiniteNonnegative(sloMetrics[key], `${label} slo_metrics.${key}`);
    }
  }
  if (Number.isFinite(sloMetrics.error_rate_percent) && sloMetrics.error_rate_percent > 100) {
    fail(`${label} slo_metrics.error_rate_percent must not exceed 100`);
  }

  const timeBounds = requireRecord(sample.time_bounds, `${label} time_bounds`);
  const startMs = requireUtcTimestamp(timeBounds.start_at, `${label} time_bounds.start_at`);
  const endMs = requireUtcTimestamp(timeBounds.end_at, `${label} time_bounds.end_at`);
  if (endMs <= startMs) fail(`${label} time_bounds.end_at must be after start_at`);
  const duration = (endMs - startMs) / 1000;
  if (Math.abs(duration - sample.duration_seconds) > 0.001) {
    fail(`${label} duration_seconds must match its UTC time_bounds`);
  }
  if (
    Math.abs(
      duration / plan.sample_interval_seconds - Math.round(duration / plan.sample_interval_seconds),
    ) > 0.001
  ) {
    fail(`${label} duration_seconds must contain whole sample intervals`);
  }

  const interventionValue = getPathValue(sample, plan.sole_intervention.path);
  if (!['string', 'number'].includes(typeof interventionValue)) {
    fail(`${label} is missing the plan's sole intervention value`);
  }

  return {
    sample,
    expectedCondition,
    startMs,
    endMs,
    expectedSamples: Math.round(duration / plan.sample_interval_seconds),
    sloMetrics,
  };
}

function parseResources(resourceFile, samples, plan) {
  const byRun = new Map(samples.map(({ sample }) => [sample.run_id, []]));
  if (!resourceFile) return byRun;

  const contents = fs.readFileSync(resourceFile, 'utf8');
  const lines = contents.split(/\r?\n/u);
  lines.forEach((line, index) => {
    if (line.trim() === '') return;
    let row;
    try {
      row = JSON.parse(line);
    } catch (error) {
      fail(`Resource JSONL line ${index + 1} is invalid JSON: ${error.message}`);
    }
    requireRecord(row, `Resource JSONL line ${index + 1}`);
    requireString(row.run_id, `Resource JSONL line ${index + 1} run_id`);
    if (!byRun.has(row.run_id))
      fail(`Resource JSONL line ${index + 1} references unknown run_id ${row.run_id}`);
    if (!['target', 'generator'].includes(row.source)) {
      fail(`Resource JSONL line ${index + 1} source must be target or generator`);
    }
    const timestampMs = requireUtcTimestamp(
      row.timestamp,
      `Resource JSONL line ${index + 1} timestamp`,
    );
    for (const key of [
      'cpu_limit_cores',
      'cpu_used_cores',
      'memory_limit_bytes',
      'memory_used_bytes',
      'target_queue_count',
      'target_inflight_count',
    ]) {
      if (row[key] !== undefined && row[key] !== null) {
        requireFiniteNonnegative(row[key], `Resource JSONL line ${index + 1} ${key}`);
      }
    }
    byRun.get(row.run_id).push({ ...row, timestamp_ms: timestampMs, line: index + 1 });
  });

  for (const { sample, startMs, endMs } of samples) {
    const seen = new Set();
    for (const row of byRun.get(sample.run_id)) {
      if (row.timestamp_ms < startMs || row.timestamp_ms >= endMs) {
        fail(
          `Resource JSONL line ${row.line} timestamp is outside run ${sample.run_id}'s measurement window`,
        );
      }
      const offsetMs = row.timestamp_ms - startMs;
      const intervalMs = plan.sample_interval_seconds * 1000;
      const sampleSlot = Math.round(offsetMs / intervalMs);
      if (
        sampleSlot < 0 ||
        sampleSlot >= sample.expectedSamples ||
        Math.abs(offsetMs - sampleSlot * intervalMs) > 1
      ) {
        fail(
          `Resource JSONL line ${row.line} timestamp is not aligned to the declared sampling interval`,
        );
      }
      const key = `${row.source}:${row.timestamp_ms}`;
      if (seen.has(key))
        fail(`Resource JSONL has a duplicate ${row.source} sample for run ${sample.run_id}`);
      seen.add(key);
      const expectedResource =
        row.source === 'target' ? sample.controlled.target : sample.controlled.generator;
      for (const [field, identityField] of [
        ['cpu_limit_cores', 'cpu_limit_cores'],
        ['memory_limit_bytes', 'memory_limit_bytes'],
      ]) {
        const identityValue = identityFieldValue(expectedResource, identityField);
        if (
          row[field] !== undefined &&
          row[field] !== null &&
          identityValue !== undefined &&
          identityValue !== null &&
          row[field] !== identityValue
        ) {
          fail(
            `Resource JSONL line ${row.line} ${field} conflicts with run ${sample.run_id}'s declared identity`,
          );
        }
      }
    }
  }
  return byRun;
}

function identityFieldValue(identity, field) {
  return identity[field];
}

function analyzeResources(rows, expectedSamples) {
  const coverageRows = rows.filter((row) => {
    const cpuAvailable =
      Number.isFinite(row.cpu_limit_cores) &&
      row.cpu_limit_cores > 0 &&
      Number.isFinite(row.cpu_used_cores);
    const memoryAvailable =
      Number.isFinite(row.memory_limit_bytes) &&
      row.memory_limit_bytes > 0 &&
      Number.isFinite(row.memory_used_bytes);
    return cpuAvailable || memoryAvailable;
  });
  const cpuRows = rows.filter(
    (row) =>
      Number.isFinite(row.cpu_limit_cores) &&
      row.cpu_limit_cores > 0 &&
      Number.isFinite(row.cpu_used_cores),
  );
  const memoryRows = rows.filter(
    (row) =>
      Number.isFinite(row.memory_limit_bytes) &&
      row.memory_limit_bytes > 0 &&
      Number.isFinite(row.memory_used_bytes),
  );
  const cpuHigh = cpuRows.filter(
    (row) => row.cpu_used_cores / row.cpu_limit_cores >= HIGH_UTILIZATION,
  );
  const memoryHigh = memoryRows.filter(
    (row) => row.memory_used_bytes / row.memory_limit_bytes >= HIGH_UTILIZATION,
  );
  const highByTimestamp = new Map();
  for (const row of [...cpuHigh, ...memoryHigh]) highByTimestamp.set(row.timestamp_ms, row);
  const pressureSamples = [...highByTimestamp.keys()].length;
  const coverage = coverageRows.length / expectedSamples;
  const cpuCoverage = cpuRows.length / expectedSamples;
  const memoryCoverage = memoryRows.length / expectedSamples;

  return {
    expected_samples: expectedSamples,
    rows_received: rows.length,
    measured_samples: coverageRows.length,
    coverage_fraction: Math.min(1, coverage),
    cpu_measured_samples: cpuRows.length,
    cpu_coverage_fraction: Math.min(1, cpuCoverage),
    memory_measured_samples: memoryRows.length,
    memory_coverage_fraction: Math.min(1, memoryCoverage),
    cpu_high_samples: cpuHigh.length,
    memory_high_samples: memoryHigh.length,
    pressure_samples: pressureSamples,
    pressure_fraction_of_expected: Math.min(1, pressureSamples / expectedSamples),
    pressure_observed:
      coverage >= MINIMUM_RESOURCE_COVERAGE &&
      pressureSamples >= Math.ceil(expectedSamples * HIGH_SAMPLE_FRACTION),
    cpu_pressure_observed:
      cpuCoverage >= MINIMUM_RESOURCE_COVERAGE &&
      cpuHigh.length >= Math.ceil(expectedSamples * HIGH_SAMPLE_FRACTION),
  };
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  if (sorted.length === 0) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function percentChange(baseline, challenger) {
  if (!Number.isFinite(baseline) || !Number.isFinite(challenger) || baseline === 0) return null;
  return (challenger / baseline - 1) * 100;
}

function assessSample(entry, rows, plan) {
  const { sample, expectedSamples, sloMetrics } = entry;
  const targetRows = rows.filter((row) => row.source === 'target');
  const generatorRows = rows.filter((row) => row.source === 'generator');
  const target = analyzeResources(targetRows, expectedSamples);
  const generator = analyzeResources(generatorRows, expectedSamples);
  const sloFailures = [];
  const p95 = sloMetrics.p95_latency_ms;
  const errorRate = sloMetrics.error_rate_percent;
  if (Number.isFinite(p95) && p95 > plan.slo_thresholds.p95_latency_ms) {
    sloFailures.push(`p95 latency ${p95} ms exceeded ${plan.slo_thresholds.p95_latency_ms} ms`);
  }
  if (Number.isFinite(errorRate) && errorRate > plan.slo_thresholds.error_rate_percent) {
    sloFailures.push(
      `error rate ${errorRate}% exceeded ${plan.slo_thresholds.error_rate_percent}%`,
    );
  }
  const metricsComplete = Number.isFinite(p95) && Number.isFinite(errorRate);
  const sloState = !metricsComplete ? 'unknown' : sloFailures.length > 0 ? 'failed' : 'passed';
  const possibleGeneratorPressure =
    generator.cpu_coverage_fraction >= MINIMUM_RESOURCE_COVERAGE
      ? generator.cpu_pressure_observed
      : null;

  let classification;
  let reasons = [];
  if (sample.achieved_load.valid === false) {
    classification = 'INVALID_GENERATOR';
    reasons = [sample.achieved_load.reason || 'Achieved-load validation failed.'];
    if (sloFailures.length > 0) reasons.push(...sloFailures);
  } else if (!metricsComplete) {
    classification = 'UNDETERMINED';
    reasons = ['Required p95 latency or error-rate measurement is missing.'];
  } else if (sample.native_failures.length > 0 && sloFailures.length === 0) {
    classification = 'UNDETERMINED';
    reasons = ['Native failures are present but the declared SLO metrics do not explain them.'];
  } else if (sloFailures.length === 0 && sample.native_failures.length === 0) {
    classification = 'SLO_WITHIN_LIMITS';
    reasons = ['Achieved load is valid and the declared SLO metrics passed.'];
  } else if (target.coverage_fraction < MINIMUM_RESOURCE_COVERAGE) {
    classification = 'UNDETERMINED';
    reasons = [
      `Target resource coverage was ${(target.coverage_fraction * 100).toFixed(1)}%; at least 80% is required.`,
      ...sloFailures,
    ];
  } else if (target.pressure_observed) {
    classification = 'TARGET_PRESSURE_OBSERVED';
    reasons = [
      `Valid achieved load and failing SLOs coincided with target CPU or memory at or above 90% in ${target.pressure_samples} of ${expectedSamples} expected samples.`,
      ...sloFailures,
    ];
  } else {
    classification = 'UNDETERMINED';
    reasons = [
      'A failing SLO was not accompanied by qualifying target CPU or memory observations.',
      ...sloFailures,
    ];
  }

  if (sample.achieved_load.valid === false && possibleGeneratorPressure === true) {
    reasons.push(
      'Generator CPU was at or above 90% of its limit in at least half of expected samples.',
    );
  } else if (sample.achieved_load.valid === false && possibleGeneratorPressure === null) {
    reasons.push(
      'Possible generator pressure is unknown because CPU resource coverage or limits are missing.',
    );
  }

  return {
    run_id: sample.run_id,
    condition: sample.condition,
    target: cloneJson(sample.controlled.target),
    framework: cloneJson(sample.controlled.framework),
    generator: cloneJson(sample.controlled.generator),
    environment: cloneJson(sample.controlled.environment),
    workload: {
      mode: sample.controlled.workload.mode,
      configured_arrival: cloneJson(sample.controlled.workload.configured_arrival),
      max_vus:
        sample.controlled.workload.mode === 'vus' ? sample.controlled.workload.max_vus : null,
      interpretation:
        sample.controlled.workload.mode === 'vus'
          ? 'Configured VUs; actual request throughput is observed and is not a configured arrival rate.'
          : 'Configured fixed request arrival rate.',
    },
    actual_throughput: cloneJson(sample.actual_throughput),
    duration_seconds: sample.duration_seconds,
    achieved_load: cloneJson(sample.achieved_load),
    native_failures: [...sample.native_failures],
    time_bounds: cloneJson(sample.time_bounds),
    slo_metrics: cloneJson(sloMetrics),
    slo_state: sloState,
    slo_failures: sloFailures,
    resource_coverage: { target, generator },
    possible_generator_pressure: possibleGeneratorPressure,
    classification,
    reasons,
    causal_limit:
      'Resource utilization is an observed association. This panel does not establish that a resource limit caused latency or errors.',
  };
}

function compareCohorts(samples, diagnoses, plan) {
  const baseline = samples.filter((entry) => entry.sample.condition === plan.baseline_condition);
  const challenger = samples.filter(
    (entry) => entry.sample.condition === plan.challenger_condition,
  );
  const baselinePathValue = plan.sole_intervention.baseline_value;
  const challengerPathValue = plan.sole_intervention.challenger_value;
  const reasons = [];
  let interventionMismatch = false;
  let cohortMismatch = false;

  const allEntries = [...baseline, ...challenger];
  const expectedValues = new Map([
    [plan.baseline_condition, baselinePathValue],
    [plan.challenger_condition, challengerPathValue],
  ]);
  for (const entry of allEntries) {
    const actual = getPathValue(entry.sample, plan.sole_intervention.path);
    if (actual !== expectedValues.get(entry.sample.condition)) {
      interventionMismatch = true;
      reasons.push(
        `Run ${entry.sample.run_id} does not match the plan's declared intervention value.`,
      );
    }
  }

  if (allEntries.length > 0) {
    const first = cloneJson(allEntries[0].sample.controlled);
    setPathValue(first, plan.sole_intervention.path.replace(/^controlled\./u, ''), undefined);
    const expectedIdentity = stableStringify(first);
    for (const entry of allEntries.slice(1)) {
      const identity = cloneJson(entry.sample.controlled);
      setPathValue(identity, plan.sole_intervention.path.replace(/^controlled\./u, ''), undefined);
      if (stableStringify(identity) !== expectedIdentity) {
        cohortMismatch = true;
        reasons.push(
          `Run ${entry.sample.run_id} changes a controlled identity outside the declared intervention.`,
        );
      }
    }
  }

  if (allEntries.length > 1) {
    const expectedDuration = allEntries[0].sample.duration_seconds;
    for (const entry of allEntries.slice(1)) {
      if (entry.sample.duration_seconds !== expectedDuration) {
        cohortMismatch = true;
        reasons.push(`Run ${entry.sample.run_id} has a different measurement duration.`);
      }
    }
  }

  const invalidLoad = allEntries.some((entry) => entry.sample.achieved_load.valid !== true);
  if (invalidLoad) {
    reasons.push(
      'At least one sample has invalid achieved load; capacity outcomes are not compared.',
    );
  }
  const nativeFailures = allEntries.some((entry) => entry.sample.native_failures.length > 0);
  if (nativeFailures) {
    reasons.push(
      'At least one sample contains native execution failures; capacity outcomes are not compared.',
    );
  }
  const incompleteMetrics = allEntries.some(
    (entry) =>
      !Number.isFinite(entry.sloMetrics.p95_latency_ms) ||
      !Number.isFinite(entry.sloMetrics.error_rate_percent),
  );
  if (incompleteMetrics) {
    reasons.push('At least one sample lacks a required latency or error-rate metric.');
  }
  const insufficientN =
    baseline.length < plan.minimum_samples_per_condition ||
    challenger.length < plan.minimum_samples_per_condition;
  if (insufficientN) {
    reasons.push(
      `Each condition requires ${plan.minimum_samples_per_condition} samples; baseline has ${baseline.length} and challenger has ${challenger.length}.`,
    );
  }

  let status = 'COMPARABLE_DESCRIPTIVE';
  if (interventionMismatch) status = 'MISMATCHED_INTERVENTION';
  else if (cohortMismatch) status = 'MISMATCHED_COHORT';
  else if (invalidLoad) status = 'INVALID_LOAD';
  else if (nativeFailures) status = 'NATIVE_FAILURES';
  else if (incompleteMetrics) status = 'INCOMPLETE_METRICS';
  else if (insufficientN) status = 'INSUFFICIENT_N';

  if (interventionMismatch || cohortMismatch) {
    for (const diagnosis of diagnoses) {
      if (diagnosis.classification === 'INVALID_GENERATOR') continue;
      diagnosis.classification = 'UNDETERMINED';
      diagnosis.reasons.unshift(
        'Controlled identities do not form a matched cohort for this intervention.',
      );
    }
  }

  const summarize = (entries) => {
    const p95Values = entries
      .map((entry) => entry.sloMetrics.p95_latency_ms)
      .filter(Number.isFinite);
    const errorValues = entries
      .map((entry) => entry.sloMetrics.error_rate_percent)
      .filter(Number.isFinite);
    const throughputValues = entries
      .map((entry) => entry.sample.actual_throughput.value)
      .filter(Number.isFinite);
    const states = entries.map(
      (entry) => diagnoses.find((item) => item.run_id === entry.sample.run_id)?.classification,
    );
    return {
      sample_count: entries.length,
      median_p95_latency_ms: median(p95Values),
      median_error_rate_percent: median(errorValues),
      median_actual_throughput_requests_per_second: median(throughputValues),
      classification_counts: Object.fromEntries(
        [...new Set(states.filter(Boolean))]
          .sort()
          .map((state) => [state, states.filter((value) => value === state).length]),
      ),
    };
  };
  const baselineSummary = summarize(baseline);
  const challengerSummary = summarize(challenger);
  const canDescribeDelta = status === 'COMPARABLE_DESCRIPTIVE';

  return {
    status,
    baseline_condition: plan.baseline_condition,
    challenger_condition: plan.challenger_condition,
    sole_intervention: {
      path: plan.sole_intervention.path,
      baseline_value: baselinePathValue,
      challenger_value: challengerPathValue,
    },
    baseline: baselineSummary,
    challenger: challengerSummary,
    descriptive_delta_percent: canDescribeDelta
      ? {
          median_p95_latency_ms: percentChange(
            baselineSummary.median_p95_latency_ms,
            challengerSummary.median_p95_latency_ms,
          ),
          median_error_rate_percent: percentChange(
            baselineSummary.median_error_rate_percent,
            challengerSummary.median_error_rate_percent,
          ),
          median_actual_throughput_requests_per_second: percentChange(
            baselineSummary.median_actual_throughput_requests_per_second,
            challengerSummary.median_actual_throughput_requests_per_second,
          ),
        }
      : null,
    reasons: [...new Set(reasons)],
    causal_conclusion:
      'No causal conclusion is made. A predeclared matched intervention with workload and generator held constant is a separate experiment.',
  };
}

function analyzeCapacityEvidence(planPath) {
  const resolvedPlan = path.resolve(planPath);
  const planDirectory = path.dirname(resolvedPlan);
  const plan = readJson(resolvedPlan, 'Plan');
  validatePlan(plan);

  const samples = [];
  const runIds = new Set();
  plan.sample_files.forEach((entry, index) => {
    const samplePath = resolveInputPath(
      planDirectory,
      entry.path,
      `Plan sample_files[${index}].path`,
    );
    const sample = readJson(samplePath, `Summary ${entry.path}`);
    const validated = validateSample(sample, entry.condition, plan, `Summary ${entry.path}`);
    if (runIds.has(sample.run_id)) fail(`Duplicate run_id ${sample.run_id}`);
    runIds.add(sample.run_id);
    samples.push(validated);
  });

  const interventionPath = plan.sole_intervention.path;
  if (getPathValue(samples[0].sample, interventionPath) === undefined) {
    fail(`Plan sole_intervention.path ${interventionPath} is missing from the summaries`);
  }
  const resourcePath = plan.resource_file
    ? resolveInputPath(planDirectory, plan.resource_file, 'Plan resource_file')
    : null;
  const resources = parseResources(resourcePath, samples, plan);
  const diagnoses = samples.map((entry) =>
    assessSample(entry, resources.get(entry.sample.run_id) ?? [], plan),
  );

  return {
    schema_version: 1,
    experiment_id: plan.experiment_id,
    source_kind: plan.source_kind,
    slo_thresholds: cloneJson(plan.slo_thresholds),
    decision_policy: {
      minimum_resource_coverage: MINIMUM_RESOURCE_COVERAGE,
      high_utilization_fraction: HIGH_UTILIZATION,
      high_samples_required_fraction: HIGH_SAMPLE_FRACTION,
      minimum_samples_per_condition: plan.minimum_samples_per_condition,
      expected_samples_per_run: Object.fromEntries(
        samples.map((entry) => [entry.sample.run_id, entry.expectedSamples]),
      ),
      sample_interval_seconds: plan.sample_interval_seconds,
    },
    sample_diagnoses: diagnoses,
    comparison: compareCohorts(samples, diagnoses, plan),
    limits: [
      'Target pressure is observed association, not proof of a bottleneck or cause.',
      'Missing limits and resource samples remain unknown and are never converted to zero utilization.',
      'A VU-only workload is not reinterpreted as a fixed request arrival rate.',
      'This offline analysis does not run k6, Docker, or change resource limits.',
    ],
  };
}

function markdownReport(result) {
  const rows = result.sample_diagnoses.map((sample) => {
    const resourceSummary = (resource) => {
      const percent = (resource.coverage_fraction * 100).toFixed(1);
      const cpuPercent = (resource.cpu_coverage_fraction * 100).toFixed(1);
      const memoryPercent = (resource.memory_coverage_fraction * 100).toFixed(1);
      return `${resource.measured_samples}/${resource.expected_samples} samples (${percent}%); CPU ${cpuPercent}%; memory ${memoryPercent}%`;
    };
    const targetLimits = [
      `CPU ${sample.target.cpu_limit_cores ?? 'unknown'} cores`,
      `memory ${sample.target.memory_limit_bytes ?? 'unknown'} bytes`,
    ].join(', ');
    const generatorLimits = [
      `CPU ${sample.generator.cpu_limit_cores ?? 'unknown'} cores`,
      `memory ${sample.generator.memory_limit_bytes ?? 'unknown'} bytes`,
    ].join(', ');
    const failures = sample.native_failures.length > 0 ? sample.native_failures.join('; ') : 'None';
    const achievedLoad = sample.achieved_load.reason
      ? `${sample.achieved_load.valid}: ${sample.achieved_load.reason}`
      : String(sample.achieved_load.valid);
    return [
      sample.run_id,
      sample.condition,
      `${sample.target.id}@${sample.target.revision}; ${targetLimits}`,
      `${sample.framework.name}@${sample.framework.version}; ${sample.framework.revision}`,
      `${sample.generator.id}; ${generatorLimits}`,
      sample.environment.id,
      `${sample.workload.mode}: ${sample.workload.configured_arrival.value} ${sample.workload.configured_arrival.unit}${sample.workload.max_vus === null ? '' : ` (max ${sample.workload.max_vus} VUs)`}`,
      `${sample.actual_throughput.value} ${sample.actual_throughput.unit}`,
      `${sample.duration_seconds} s`,
      `${sample.time_bounds.start_at} to ${sample.time_bounds.end_at}`,
      achievedLoad,
      `${sample.slo_state}; p95 ${sample.slo_metrics.p95_latency_ms ?? 'unknown'} ms; errors ${sample.slo_metrics.error_rate_percent ?? 'unknown'}%`,
      `target ${resourceSummary(sample.resource_coverage.target)}; generator ${resourceSummary(sample.resource_coverage.generator)}`,
      sample.classification,
      `${sample.reasons.join(' ')} Native failures: ${failures}`,
    ]
      .map((cell) => String(cell).replace(/\|/gu, '\\|').replace(/\s+/gu, ' '))
      .join(' | ');
  });
  const comparison = result.comparison;
  const output = [
    `# Capacity evidence: ${result.experiment_id}`,
    '',
    `Source kind: **${result.source_kind}**. This report does not execute a load test.`,
    '',
    `SLO thresholds: p95 latency ≤${result.slo_thresholds.p95_latency_ms} ms; error rate ≤${result.slo_thresholds.error_rate_percent}%.`,
    '',
    `Comparison status: **${comparison.status}**. Baseline: \`${comparison.baseline_condition}\`; challenger: \`${comparison.challenger_condition}\`.`,
    `Declared intervention: \`${comparison.sole_intervention.path}\` changed from \`${comparison.sole_intervention.baseline_value}\` to \`${comparison.sole_intervention.challenger_value}\`.`,
    '',
    ...(comparison.reasons.length > 0
      ? [`Comparison limits: ${comparison.reasons.join(' ')}`, '']
      : []),
    '| Run | Condition | Target identity and limits | Framework identity | Generator identity and limits | Environment | Configured workload | Actual throughput | Duration | Measurement window | Achieved load | SLO measurements | Resource coverage | Classification | Reason and native failures |',
    '| --- | --- | --- | --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row} |`),
    '',
    '## Descriptive cohorts',
    '',
    `- Baseline: ${comparison.baseline.sample_count} samples; median p95 ${comparison.baseline.median_p95_latency_ms ?? 'unknown'} ms; median error rate ${comparison.baseline.median_error_rate_percent ?? 'unknown'}%; median actual throughput ${comparison.baseline.median_actual_throughput_requests_per_second ?? 'unknown'} requests/s.`,
    `- Challenger: ${comparison.challenger.sample_count} samples; median p95 ${comparison.challenger.median_p95_latency_ms ?? 'unknown'} ms; median error rate ${comparison.challenger.median_error_rate_percent ?? 'unknown'}%; median actual throughput ${comparison.challenger.median_actual_throughput_requests_per_second ?? 'unknown'} requests/s.`,
    `- Causal limit: ${comparison.causal_conclusion}`,
    '',
    ...result.limits.map((limit) => `- ${limit}`),
    '',
  ];
  return `${output.join('\n')}\n`;
}

function parseArgs(args) {
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (!['--plan', '--out'].includes(flag)) fail(`Unknown argument ${flag}`);
    if (values[flag]) fail(`Duplicate argument ${flag}`);
    const value = args[index + 1];
    if (!value || value.startsWith('--')) fail(`${flag} requires a value`);
    values[flag] = value;
    index += 1;
  }
  if (!values['--plan'] || !values['--out']) {
    fail(
      'Usage: node scripts/analyze-capacity-evidence.cjs --plan <plan.json> --out <report-base-path>',
    );
  }
  return { planPath: values['--plan'], outputBase: values['--out'] };
}

function main(args) {
  const { planPath, outputBase } = parseArgs(args);
  const result = analyzeCapacityEvidence(planPath);
  const resolvedBase = path.resolve(outputBase);
  fs.mkdirSync(path.dirname(resolvedBase), { recursive: true });
  fs.writeFileSync(`${resolvedBase}.json`, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(`${resolvedBase}.md`, markdownReport(result));
  console.log(`Capacity evidence JSON: ${resolvedBase}.json`);
  console.log(`Capacity evidence Markdown: ${resolvedBase}.md`);
  console.log(`Comparison status: ${result.comparison.status}`);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { analyzeCapacityEvidence, markdownReport };
