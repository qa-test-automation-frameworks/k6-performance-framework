// Legacy targetRps meant arrival iterations, never fixed HTTP request throughput.
// This adapter preserves historical numbers; it cannot turn a journey baseline into a request one.
function workloadIdentity(metadata) {
  const workload = metadata?.workload ?? metadata;
  const legacy = workload?.workloadSchema === undefined && workload?.targetRps !== undefined;
  const schema = workload?.workloadSchema ?? (legacy ? 'journey-arrival-v1' : undefined);
  const iterations = legacy ? workload.targetRps : workload?.targetIterationsPerSecond;
  const requests = schema === 'journey-arrival-v1' ? null : workload?.targetRequestsPerSecond;
  if (
    !['journey-arrival-v1', 'single-request-arrival-v1', 'single-request-arrival-v2'].includes(
      schema,
    ) ||
    !Number.isSafeInteger(iterations) ||
    iterations <= 0 ||
    !Number.isSafeInteger(workload?.maxVus) ||
    workload.maxVus <= 0 ||
    (schema !== 'journey-arrival-v1' && requests !== iterations)
  ) {
    throw new Error('Missing, invalid or unsupported workload identity');
  }
  const identity = {
    workloadSchema: schema,
    targetIterationsPerSecond: iterations,
    targetRequestsPerSecond: requests,
    maxVus: workload.maxVus,
    profile: workload.profile,
  };
  if (schema !== 'journey-arrival-v1') {
    for (const field of ['measurementSeconds', 'warmupSeconds', 'minimumAchievedFraction']) {
      if (!Number.isFinite(workload[field]) || workload[field] <= 0) {
        throw new Error(`Missing request-rate ${field}`);
      }
      identity[field] = workload[field];
    }
  }
  if (schema === 'single-request-arrival-v2') {
    if (workload.requestDrainSeconds !== 2) {
      throw new Error('Missing or unsupported request-rate completion drain');
    }
    identity.requestDrainSeconds = workload.requestDrainSeconds;
  }
  return identity;
}

function assertCompatibleWorkloads(before, after) {
  const a = workloadIdentity(before);
  const b = workloadIdentity(after);
  const fields = new Set([...Object.keys(a), ...Object.keys(b)]);
  const differences = [...fields].filter(
    (field) => a[field] === undefined || b[field] === undefined || a[field] !== b[field],
  );
  if (differences.length) throw new Error(`Incompatible workload: ${differences.join(', ')}`);
  return a;
}

module.exports = { workloadIdentity, assertCompatibleWorkloads };
