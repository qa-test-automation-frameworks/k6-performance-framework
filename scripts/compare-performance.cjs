const crypto = require('node:crypto');
const fs = require('node:fs');
const { assertCompatibleWorkloads } = require('./workload-identity.cjs');

const baselinePath = process.env.BASELINE_FILE || 'baseline/load-summary.json';
const provenancePath = process.env.BASELINE_PROVENANCE_FILE || 'baseline/provenance.json';
const candidatePath = process.env.CANDIDATE_FILE || 'reports/load-summary.json';
const tolerancePath = process.env.TOLERANCE_FILE || 'baseline/tolerance.json';
const legacyTolerance = Number(process.env.REGRESSION_TOLERANCE || '0.20');
const errorRateLimit = Number(process.env.ERROR_RATE_LIMIT || '0.02');
function assertLimits() {
  if (
    !Number.isFinite(legacyTolerance) ||
    legacyTolerance < 0 ||
    !Number.isFinite(errorRateLimit) ||
    errorRateLimit < 0 ||
    errorRateLimit > 1
  ) {
    throw new Error(
      'Comparison limits must be finite non-negative fractions; error-rate limit must be at most 1',
    );
  }
}

function assertAcceptedBaseline() {
  let provenance;
  try {
    provenance = read(provenancePath);
  } catch (error) {
    throw Object.assign(new Error(`Baseline refused: cannot read ${provenancePath}`), {
      refused: true,
    });
  }
  const baselineBytes = fs.readFileSync(baselinePath);
  const sha256 = crypto.createHash('sha256').update(baselineBytes).digest('hex');
  const sampleCount = JSON.parse(baselineBytes).metadata?.sampleCount;
  const problems = [];
  if (!Number.isSafeInteger(sampleCount) || sampleCount < (provenance.schemaVersion === 2 ? 5 : 3))
    problems.push('baseline sample count must be an integer of at least three');
  if (provenance.baselinePath !== baselinePath)
    problems.push(`provenance describes ${provenance.baselinePath}, not ${baselinePath}`);
  if (provenance.baselineSha256 !== sha256) problems.push('baseline hash differs from provenance');
  if (provenance.disposition !== 'measured-retained')
    problems.push(
      `provenance disposition "${provenance.disposition}" is not an accepted measured state (expected "measured-retained")`,
    );
  if (provenance.sourceInputsAvailable !== true) problems.push('source inputs are unavailable');
  if (!Array.isArray(provenance.sourceArtifacts) || provenance.sourceArtifacts.length < sampleCount)
    problems.push('fewer retained source artifacts than the baseline sample count');
  if (provenance.schemaVersion === 2) {
    const verified = require('./baseline-provenance.cjs').classifyBaselineProvenance(process.cwd());
    if (verified.reasons.length) problems.push(...verified.reasons);
  }
  if (problems.length) {
    throw Object.assign(
      new Error(`Baseline refused: ${problems.join('; ')}; see ${provenancePath}`),
      { refused: true },
    );
  }
}

function read(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function value(summary, metric, key) {
  const result = summary.metrics?.[metric]?.[key];
  if (!Number.isFinite(result) || result < 0)
    throw new Error(`Missing or invalid ${metric}.${key}`);
  return result;
}

function compare() {
  assertLimits();
  assertAcceptedBaseline();
  const baseline = read(baselinePath);
  const candidate = read(candidatePath);
  if ((candidate.failures?.length ?? 0) > 0 || candidate.achievedLoad?.valid === false) {
    throw new Error('Cannot compare a failed or invalid candidate experiment');
  }
  if (baseline.metadata?.status !== 'measured' || baseline.metadata?.sampleCount < 3) {
    throw new Error('Baseline must contain at least three measured controlled runs');
  }
  assertCompatibleWorkloads(baseline.metadata, candidate.metadata);
  const compatibilityFields = [
    ['targetId', baseline.metadata?.targetId, candidate.metadata?.targetId],
    ['targetCommit', baseline.metadata?.targetCommit, candidate.metadata?.targetCommit],
    ['profile', baseline.metadata?.workload?.profile, candidate.metadata?.profile],
    ['maxVus', baseline.metadata?.workload?.maxVus, candidate.metadata?.maxVus],
    ['k6Version', baseline.metadata?.k6Version, candidate.metadata?.k6Version],
    ['runnerClass', baseline.metadata?.runnerClass, candidate.metadata?.runnerClass],
  ];
  const incompatible = compatibilityFields.filter(
    ([, before, after]) => before === undefined || after === undefined || before !== after,
  );
  if (incompatible.length) {
    throw new Error(
      `Incompatible baseline: ${incompatible
        .map(([name, before, after]) => `${name}=${before ?? 'missing'}/${after ?? 'missing'}`)
        .join(', ')}`,
    );
  }
  const comparisons = Object.entries(baseline.metrics ?? {}).flatMap(([metric, values]) =>
    Object.keys(values)
      .filter((key) => key === 'p(95)' || key === 'p(99)')
      .map((key) => [metric, key, value(baseline, metric, key), value(candidate, metric, key)]),
  );
  if (comparisons.length === 0) throw new Error('No comparable percentile metrics found');
  let tolerances;
  try {
    tolerances = read(tolerancePath);
    if (tolerances.schemaVersion !== 1) throw new Error('unsupported tolerance schema');
    for (const [metric, key] of comparisons) {
      const limits = tolerances.perMetric?.[`${metric}.${key}`];
      if (
        !limits ||
        !Number.isFinite(limits.relative) ||
        limits.relative < 0 ||
        !Number.isFinite(limits.absoluteMs) ||
        limits.absoluteMs < 0
      )
        throw new Error(`missing or invalid tolerance for ${metric}.${key}`);
    }
  } catch (error) {
    throw Object.assign(new Error(`Baseline refused: ${error.message}; see ${tolerancePath}`), {
      refused: true,
    });
  }
  const failures = comparisons.filter(([metric, key, before, after]) => {
    const limits = tolerances.perMetric[`${metric}.${key}`];
    return after > before * (1 + limits.relative) && after - before > limits.absoluteMs;
  });
  const failureRates = Object.entries(baseline.metrics ?? {})
    .filter(([metric, values]) => metric.includes('failed') && typeof values.rate === 'number')
    .map(([metric]) => [metric, value(candidate, metric, 'rate')]);

  console.log('| Metric | Statistic | Baseline (ms) | Candidate (ms) | Delta (ms) | Change |');
  console.log('|---|---|---:|---:|---:|---:|');
  for (const [metric, key, before, after] of comparisons) {
    console.log(
      `| ${metric} | ${key} | ${before.toFixed(4)} | ${after.toFixed(4)} | ${(after - before).toFixed(4)} | ${(before === 0 ? (after === 0 ? 0 : Number.POSITIVE_INFINITY) : (after / before - 1) * 100).toFixed(1)}% |`,
    );
  }
  for (const [metric, rate] of failureRates) {
    if (rate >= errorRateLimit) failures.push([metric, 'rate', errorRateLimit, rate]);
  }
  if (failures.length) {
    console.error(
      `Performance regression detected: ${failures
        .map(([metric, key]) => `${metric}.${key}`)
        .join(', ')}`,
    );
    return 1;
  }
  return 0;
}

try {
  process.exitCode = compare();
} catch (error) {
  console.error(error.message);
  process.exitCode = error.refused ? 3 : 2;
}
