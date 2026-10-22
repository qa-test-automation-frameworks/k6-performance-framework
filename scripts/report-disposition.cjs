'use strict';

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const own = (value, key) => Object.hasOwn(value, key);

const describeInvalid = (path, expected) => `Invalid ${path}: expected ${expected}.`;

/**
 * Classifies the evidence in a k6 summary without recomputing native thresholds.
 * Display metrics are validated here so malformed values cannot break rendering.
 * @param {unknown} summary
 * @returns {{status: string, thresholdStatus: string, loadStatus: string, reasons: string[]}}
 */
function classifySummary(summary) {
  const reasons = [];
  const invalidReasons = [];
  const addReason = (message) => {
    if (!reasons.includes(message)) reasons.push(message);
  };
  const addInvalid = (message) => {
    if (!invalidReasons.includes(message)) invalidReasons.push(message);
    addReason(message);
  };

  if (!isRecord(summary)) {
    return {
      status: 'INVALID_INPUT',
      thresholdStatus: 'INVALID_INPUT',
      loadStatus: 'INVALID_INPUT',
      reasons: ['Invalid summary: expected an object.'],
    };
  }

  let thresholdStatus = 'INCOMPLETE';
  let nativeThresholdFailure = false;
  if (!own(summary, 'thresholds')) {
    addReason('Native threshold results are missing.');
  } else if (!isRecord(summary.thresholds)) {
    thresholdStatus = 'INVALID_INPUT';
    addInvalid(describeInvalid('thresholds', 'an object'));
  } else {
    let resultCount = 0;
    let malformed = false;
    for (const [metricName, thresholdMap] of Object.entries(summary.thresholds)) {
      if (!isRecord(thresholdMap)) {
        malformed = true;
        addInvalid(describeInvalid(`thresholds.${metricName}`, 'an object'));
        continue;
      }
      for (const [thresholdName, result] of Object.entries(thresholdMap)) {
        if (!isRecord(result) || typeof result.ok !== 'boolean') {
          malformed = true;
          addInvalid(describeInvalid(`thresholds.${metricName}.${thresholdName}.ok`, 'a boolean'));
          continue;
        }
        resultCount += 1;
        if (!result.ok) {
          nativeThresholdFailure = true;
          addReason(`Native threshold failed: ${metricName} / ${thresholdName}.`);
        }
      }
    }
    if (malformed) thresholdStatus = 'INVALID_INPUT';
    else if (resultCount === 0) {
      thresholdStatus = 'INCOMPLETE';
      addReason('No native threshold results were reported.');
    } else if (nativeThresholdFailure) thresholdStatus = 'FAIL';
    else thresholdStatus = 'PASS';
  }

  let producerFailure = false;
  let failuresAreExplicitlyEmpty = false;
  if (!own(summary, 'failures')) {
    addReason('Producer failures array is missing.');
  } else if (
    !Array.isArray(summary.failures) ||
    summary.failures.some((failure) => typeof failure !== 'string')
  ) {
    addInvalid(describeInvalid('failures', 'an array of strings'));
  } else if (summary.failures.length === 0) {
    failuresAreExplicitlyEmpty = true;
  } else {
    const nonemptyFailures = summary.failures.map((failure) => failure.trim()).filter(Boolean);
    if (nonemptyFailures.length === 0) {
      addReason('Producer failures array is nonempty but contains no nonempty failure string.');
    }
    for (const failure of nonemptyFailures) {
      producerFailure = true;
      addReason(`Producer failure: ${failure.slice(0, 500)}`);
    }
  }

  let metadata = {};
  if (own(summary, 'metadata')) {
    if (!isRecord(summary.metadata)) {
      addInvalid(describeInvalid('metadata', 'an object'));
    } else {
      metadata = summary.metadata;
    }
  }
  if (own(metadata, 'workloadSchema') && typeof metadata.workloadSchema !== 'string') {
    addInvalid(describeInvalid('metadata.workloadSchema', 'a string'));
  }
  const knownWorkloadSchemas = new Set([
    'journey-arrival-v1',
    'single-request-arrival-v1',
    'single-request-arrival-v2',
  ]);
  const workloadSchemaKnown =
    typeof metadata.workloadSchema === 'string' &&
    knownWorkloadSchemas.has(metadata.workloadSchema);
  if (!own(metadata, 'workloadSchema')) {
    addReason('Workload schema is missing; achieved-load requirements cannot be determined.');
  } else if (typeof metadata.workloadSchema === 'string' && !workloadSchemaKnown) {
    addInvalid(describeInvalid('metadata.workloadSchema', 'a supported workload schema'));
  }
  for (const key of ['targetId', 'profile']) {
    if (own(metadata, key) && typeof metadata[key] !== 'string') {
      addInvalid(describeInvalid(`metadata.${key}`, 'a string'));
    }
  }
  if (own(metadata, 'workload') && !isRecord(metadata.workload)) {
    addInvalid(describeInvalid('metadata.workload', 'an object'));
  } else if (
    isRecord(metadata.workload) &&
    own(metadata.workload, 'profile') &&
    typeof metadata.workload.profile !== 'string'
  ) {
    addInvalid(describeInvalid('metadata.workload.profile', 'a string'));
  }

  const requestRateWorkload =
    metadata.workloadSchema === 'single-request-arrival-v1' ||
    metadata.workloadSchema === 'single-request-arrival-v2';
  let loadStatus = 'NOT_APPLICABLE';
  if (!own(summary, 'achievedLoad')) {
    if (requestRateWorkload) {
      loadStatus = 'MISSING';
      addReason('Achieved-load evidence is missing for this request-rate workload.');
    }
  } else if (summary.achievedLoad === null) {
    if (requestRateWorkload) {
      loadStatus = 'MISSING';
      addReason('Achieved-load evidence is missing for this request-rate workload.');
    }
  } else if (!isRecord(summary.achievedLoad)) {
    loadStatus = 'INVALID_INPUT';
    addInvalid(describeInvalid('achievedLoad', 'an object or null'));
  } else {
    const achievedLoad = summary.achievedLoad;
    if (typeof achievedLoad.valid !== 'boolean') {
      loadStatus = 'INVALID_INPUT';
      addInvalid(describeInvalid('achievedLoad.valid', 'a boolean'));
    }
    let loadReasons = [];
    if (own(achievedLoad, 'reasons')) {
      if (
        !Array.isArray(achievedLoad.reasons) ||
        achievedLoad.reasons.some((reason) => typeof reason !== 'string')
      ) {
        loadStatus = 'INVALID_INPUT';
        addInvalid(describeInvalid('achievedLoad.reasons', 'an array of strings'));
      } else {
        loadReasons = achievedLoad.reasons.map((reason) => reason.trim()).filter(Boolean);
      }
    }
    for (const reason of loadReasons) addReason(`Achieved load: ${reason.slice(0, 500)}`);
    if (achievedLoad.valid === true && loadReasons.length > 0) {
      loadStatus = 'INVALID_INPUT';
      addInvalid(describeInvalid('achievedLoad', 'valid evidence without failure reasons'));
    }
    if (achievedLoad.valid === false && loadReasons.length === 0) {
      addReason('Achieved load is marked invalid; no load-specific reason was supplied.');
    }
    const loadNumericFields = [
      'configuredRequestsPerSecond',
      'measurementSeconds',
      'minimumAchievedFraction',
      'completedIterations',
      'startedRequests',
      'requests',
      'droppedIterations',
      'achievedIterationsPerSecond',
      'achievedRequestsPerSecond',
    ];
    for (const key of loadNumericFields) {
      if (!own(achievedLoad, key) || achievedLoad[key] === null) continue;
      const value = achievedLoad[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        loadStatus = 'INVALID_INPUT';
        addInvalid(describeInvalid(`achievedLoad.${key}`, 'a finite nonnegative number or null'));
      } else if (key === 'minimumAchievedFraction' && value > 1) {
        loadStatus = 'INVALID_INPUT';
        addInvalid(describeInvalid('achievedLoad.minimumAchievedFraction', 'a number from 0 to 1'));
      }
    }
    if (loadStatus !== 'INVALID_INPUT') loadStatus = achievedLoad.valid ? 'VALID' : 'INVALID';
    if (requestRateWorkload && loadStatus === 'NOT_APPLICABLE') loadStatus = 'MISSING';
  }

  if (!own(summary, 'metrics') || !isRecord(summary.metrics)) {
    addInvalid(describeInvalid('metrics', 'an object'));
  } else {
    const metricDefinitions = [
      ['http_req_duration', 'p(95)', 'p95', false],
      ['http_req_duration', 'p(99)', 'p99', false],
      ['http_req_failed', 'rate', 'errorRate', true],
      ['http_reqs', 'rate', 'throughput', false],
      ['dropped_iterations', 'count', 'droppedIterations', false],
    ];
    for (const [metricName, valueName, , isRate] of metricDefinitions) {
      if (!own(summary.metrics, metricName)) continue;
      const metric = summary.metrics[metricName];
      if (!isRecord(metric)) {
        addInvalid(describeInvalid(`metrics.${metricName}`, 'an object'));
        continue;
      }
      if (!own(metric, valueName)) continue;
      const value = metric[valueName];
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        (isRate && value > 1)
      ) {
        addInvalid(
          describeInvalid(
            `metrics.${metricName}.${valueName}`,
            isRate ? 'a finite number from 0 to 1' : 'a finite nonnegative number',
          ),
        );
      }
    }
  }

  let status;
  if (invalidReasons.length > 0) status = 'INVALID_INPUT';
  else if (loadStatus === 'INVALID') status = 'INVALID_LOAD';
  else if (nativeThresholdFailure || producerFailure) status = 'FAIL';
  else if (
    thresholdStatus !== 'PASS' ||
    !failuresAreExplicitlyEmpty ||
    !workloadSchemaKnown ||
    (requestRateWorkload && loadStatus !== 'VALID')
  ) {
    status = 'INCOMPLETE';
  } else status = 'PASS';

  return { status, thresholdStatus, loadStatus, reasons };
}

module.exports = { classifySummary };
