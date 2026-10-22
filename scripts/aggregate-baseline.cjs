'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const { assertCompatibleHistory, workloadIdentity } = require('./workload-identity.cjs');
const { classifySummary } = require('./report-disposition.cjs');

const IDENTITY_FIELDS = [
  'targetId',
  'targetCommit',
  'environment',
  'frameworkCommit',
  'k6Version',
  'runnerClass',
  'workloadName',
];
const OPTIONAL_IDENTITY_FIELDS = ['runnerImage', 'cpuLimitCores', 'memoryLimitBytes'];
const REQUIRED_METRICS = [
  ['http_req_duration', 'p(95)'],
  ['http_req_duration', 'p(99)'],
  ['http_req_failed', 'rate'],
  ['http_reqs', 'count'],
  ['http_reqs', 'rate'],
  ['iterations', 'count'],
  ['iterations', 'rate'],
  ['dropped_iterations', 'count'],
];

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const isKnownString = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  value === value.trim() &&
  value.toLowerCase() !== 'unknown';

function canonicalRelativePath(value) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.includes('\\') ||
    /^[A-Za-z]:/.test(value) ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value === '.' ||
    value.startsWith('../')
  ) {
    throw new Error(`Source path is not canonical and relative: ${String(value)}`);
  }
  return value;
}

function readMetric(source, metric, key) {
  const values = source.summary.metrics?.[metric];
  const value = isRecord(values) ? values[key] : undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${source.path} is missing a finite nonnegative ${metric}.${key}`);
  }
  if (
    key === 'rate' &&
    (metric === 'http_req_failed' ||
      (metric.startsWith('custom_') && metric.endsWith('_success_rate'))) &&
    value > 1
  ) {
    throw new Error(`${source.path} has an out-of-range ${metric}.${key}`);
  }
  return value;
}

function validateWorkload(metadata, sourcePath) {
  let identity;
  try {
    identity = workloadIdentity(metadata);
  } catch (error) {
    throw new Error(`${sourcePath} has an invalid workload identity: ${error.message}`);
  }
  if (!isKnownString(identity.profile)) {
    throw new Error(`${sourcePath} has a missing or unknown workload profile`);
  }
  if (
    identity.workloadSchema === 'journey-arrival-v1' &&
    metadata.targetRequestsPerSecond !== null
  ) {
    throw new Error(`${sourcePath} must preserve the journey workload's null request-rate target`);
  }
  if (
    identity.workloadSchema === 'journey-arrival-v1' &&
    ['measurementSeconds', 'warmupSeconds', 'minimumAchievedFraction', 'requestDrainSeconds'].some(
      (field) => metadata[field] !== null,
    )
  ) {
    throw new Error(`${sourcePath} has request-rate-only fields on a journey workload`);
  }
  if (
    identity.workloadSchema !== 'journey-arrival-v1' &&
    metadata.targetRequestsPerSecond !== identity.targetRequestsPerSecond
  ) {
    throw new Error(`${sourcePath} has inconsistent request-rate workload metadata`);
  }
  if (identity.minimumAchievedFraction !== undefined && identity.minimumAchievedFraction > 1) {
    throw new Error(`${sourcePath} has an out-of-range minimumAchievedFraction`);
  }
  return identity;
}

function validateInputs(sources, env) {
  if (!Array.isArray(sources) || sources.length < 3) {
    throw new Error('At least three performance summaries are required');
  }
  const sourcePaths = new Set();
  const sourceBasenames = new Set();
  const runIds = new Set();

  for (const source of sources) {
    if (!isRecord(source) || !isRecord(source.summary) || !isRecord(source.summary.metadata)) {
      throw new Error('Each source must contain a summary object with metadata');
    }
    source.path = canonicalRelativePath(source.path);
    const basename = path.posix.basename(source.path);
    if (sourcePaths.has(source.path)) throw new Error(`Duplicate source path: ${source.path}`);
    if (sourceBasenames.has(basename)) throw new Error(`Duplicate source basename: ${basename}`);
    sourcePaths.add(source.path);
    sourceBasenames.add(basename);

    const metadata = source.summary.metadata;
    for (const field of IDENTITY_FIELDS) {
      if (!isKnownString(metadata[field])) {
        throw new Error(`${source.path} is missing a known metadata.${field}`);
      }
    }
    for (const field of ['runId']) {
      if (
        typeof metadata[field] !== 'string' ||
        !/^[A-Za-z0-9_-]{1,120}$/.test(metadata[field]) ||
        metadata[field].toLowerCase() === 'unknown'
      ) {
        throw new Error(`${source.path} is missing a valid metadata.${field}`);
      }
    }
    if (runIds.has(metadata.runId)) throw new Error(`Duplicate runId: ${metadata.runId}`);
    runIds.add(metadata.runId);

    for (const field of OPTIONAL_IDENTITY_FIELDS) {
      if (!Object.hasOwn(metadata, field)) continue;
      if (field === 'runnerImage') {
        if (!isKnownString(metadata[field])) {
          throw new Error(`${source.path} has an invalid metadata.${field}`);
        }
      } else if (
        typeof metadata[field] !== 'number' ||
        !Number.isFinite(metadata[field]) ||
        metadata[field] <= 0
      ) {
        throw new Error(`${source.path} has an invalid metadata.${field}`);
      }
    }
    validateWorkload(metadata, source.path);

    const disposition = classifySummary(source.summary);
    if (disposition.status !== 'PASS') {
      const detail = disposition.reasons.length > 0 ? `: ${disposition.reasons.join('; ')}` : '';
      throw new Error(`${source.path} cannot form a new baseline (${disposition.status})${detail}`);
    }
    for (const [metric, key] of REQUIRED_METRICS) readMetric(source, metric, key);
    if (source.sha256 === undefined) {
      source.sha256 = sha256(Buffer.from(JSON.stringify(source.summary)));
    } else if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)) {
      throw new Error(`${source.path} has an invalid source SHA-256 digest`);
    }
  }

  const firstMetadata = sources[0].summary.metadata;
  const commonWorkload = validateWorkload(firstMetadata, sources[0].path);
  for (const source of sources.slice(1)) {
    const metadata = source.summary.metadata;
    try {
      assertCompatibleHistory(firstMetadata, metadata);
    } catch (error) {
      throw new Error(`${source.path} is incompatible with ${sources[0].path}: ${error.message}`);
    }
    for (const field of ['frameworkCommit', 'workloadName']) {
      if (metadata[field] !== firstMetadata[field]) {
        throw new Error(`Incompatible ${field}: ${source.path} differs from ${sources[0].path}`);
      }
    }
    for (const field of OPTIONAL_IDENTITY_FIELDS) {
      if (Object.hasOwn(firstMetadata, field) !== Object.hasOwn(metadata, field)) {
        throw new Error(
          `Incompatible optional identity field ${field}: not present in every input`,
        );
      }
      if (Object.hasOwn(firstMetadata, field) && metadata[field] !== firstMetadata[field]) {
        throw new Error(`Incompatible optional identity field ${field}`);
      }
    }
    validateWorkload(metadata, source.path);
  }

  const environmentAssertions = [
    ['TARGET_ID', 'targetId'],
    ['TARGET_COMMIT', 'targetCommit'],
    ['TARGET_ENV', 'environment'],
    ['FRAMEWORK_COMMIT', 'frameworkCommit'],
    ['K6_VERSION', 'k6Version'],
    ['RUNNER_CLASS', 'runnerClass'],
    ['RUNNER_IMAGE', 'runnerImage'],
    ['WORKLOAD_NAME', 'workloadName'],
    ['CPU_LIMIT_CORES', 'cpuLimitCores'],
    ['MEMORY_LIMIT_BYTES', 'memoryLimitBytes'],
  ];
  for (const [environmentName, field] of environmentAssertions) {
    if (env[environmentName] === undefined) continue;
    const expected =
      field === 'cpuLimitCores' || field === 'memoryLimitBytes'
        ? Number(env[environmentName])
        : env[environmentName];
    if (sources[0].summary.metadata[field] !== expected) {
      throw new Error(`${environmentName} must match the validated input identity (${field})`);
    }
  }

  return { firstMetadata, commonWorkload };
}

function commonMetricKeys(sources) {
  return Object.entries(sources[0].summary.metrics)
    .filter(([name, values]) => {
      if (!isRecord(values)) return false;
      const keys = Object.keys(values);
      const isLatency =
        name === 'http_req_duration' ||
        name.startsWith('http_req_duration{name:') ||
        (name.startsWith('custom_') && name.endsWith('_duration_ms'));
      const isFailure =
        name === 'http_req_failed' ||
        name.startsWith('http_req_failed{name:') ||
        (name.startsWith('custom_') && name.endsWith('_success_rate'));
      return (
        (isLatency && keys.some((key) => key === 'p(95)' || key === 'p(99)')) ||
        (isFailure && keys.includes('rate'))
      );
    })
    .map(([name]) => name)
    .filter((name) => sources.every((source) => isRecord(source.summary.metrics?.[name])));
}

function median(values) {
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    throw new Error('Cannot calculate a median from non-finite values');
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function aggregateMetric(sources, metric) {
  const keys = new Set(
    sources.flatMap((source) => Object.keys(source.summary.metrics[metric] ?? {})),
  );
  return Object.fromEntries(
    [...keys]
      .filter((key) => ['p(95)', 'p(99)', 'rate'].includes(key))
      .map((key) => [key, median(sources.map((source) => readMetric(source, metric, key)))]),
  );
}

function aggregateBaselineSamples(sources, options = {}) {
  sources = Array.isArray(sources)
    ? sources.map((source) => (isRecord(source) ? { ...source } : source))
    : sources;
  const env = options.env ?? process.env;
  const { firstMetadata, commonWorkload } = validateInputs(sources, env);
  const sourceFiles = sources.map((source) => path.posix.basename(source.path));
  const sourcePaths = sources.map((source) => source.path);
  const sourceSha256 = Object.fromEntries(
    sources.map((source) => [path.posix.basename(source.path), source.sha256]),
  );
  const sourceArtifacts = sources.map((source) => ({ path: source.path, sha256: source.sha256 }));
  const metrics = Object.fromEntries(
    commonMetricKeys(sources).map((metric) => [metric, aggregateMetric(sources, metric)]),
  );
  metrics.http_reqs = {
    count: median(sources.map((source) => readMetric(source, 'http_reqs', 'count'))),
    rate: median(sources.map((source) => readMetric(source, 'http_reqs', 'rate'))),
  };
  metrics.iterations = {
    count: median(sources.map((source) => readMetric(source, 'iterations', 'count'))),
    rate: median(sources.map((source) => readMetric(source, 'iterations', 'rate'))),
  };
  metrics.dropped_iterations = {
    count: median(sources.map((source) => readMetric(source, 'dropped_iterations', 'count'))),
  };

  const metadata = {
    status: 'measured',
    sampleCount: sources.length,
    sourceFiles,
    sourcePaths,
    sourceSha256,
    sourceArtifacts,
    runIds: sources.map((source) => source.summary.metadata.runId),
    targetId: firstMetadata.targetId,
    targetCommit: firstMetadata.targetCommit,
    environment: firstMetadata.environment,
    frameworkCommit: firstMetadata.frameworkCommit,
    k6Version: firstMetadata.k6Version,
    runnerClass: firstMetadata.runnerClass,
    runner: firstMetadata.runnerImage ?? firstMetadata.runnerClass,
    workloadSchema: commonWorkload.workloadSchema,
    workload: { name: firstMetadata.workloadName, ...commonWorkload },
  };
  for (const field of OPTIONAL_IDENTITY_FIELDS) {
    if (Object.hasOwn(firstMetadata, field)) metadata[field] = firstMetadata[field];
  }
  const workflowRunUrl = env.WORKFLOW_RUN_URL;
  if (workflowRunUrl) metadata.workflowRun = workflowRunUrl;

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    metadata,
    metrics,
  };
}

function sourceFromFile(file, projectRoot) {
  if (typeof file !== 'string' || file.length === 0) throw new Error('Input path is required');
  const absolutePath = path.resolve(projectRoot, file);
  const relativePath = path.relative(projectRoot, absolutePath);
  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(`Summary input must resolve within the project: ${file}`);
  }
  const sourcePath = relativePath.split(path.sep).join('/');
  const bytes = fs.readFileSync(absolutePath);
  const summary = JSON.parse(bytes.toString('utf8'));
  if (!isRecord(summary)) throw new Error(`${sourcePath} must contain a summary object`);
  return { path: sourcePath, bytes, sha256: sha256(bytes), summary };
}

function writeBaseline(outputPath, baseline, sources, projectRoot) {
  const absoluteOutput = path.resolve(projectRoot, outputPath);
  if (sources.some((source) => path.resolve(projectRoot, source.path) === absoluteOutput)) {
    throw new Error('Baseline output must not overwrite a source summary');
  }
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  const temporary = `${absoluteOutput}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(baseline, null, 2)}\n`, { flag: 'wx' });
    fs.renameSync(temporary, absoluteOutput);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}

function aggregateBaselineFiles(inputPaths, options = {}) {
  const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
  const sources = inputPaths.map((file) => sourceFromFile(file, projectRoot));
  const baseline = aggregateBaselineSamples(sources, { env: options.env ?? process.env });
  if (options.outputPath) writeBaseline(options.outputPath, baseline, sources, projectRoot);
  return baseline;
}

function main() {
  const inputs = process.argv.slice(2);
  if (inputs.length < 3) {
    throw new Error(
      'usage: node scripts/aggregate-baseline.cjs <summary-1.json> <summary-2.json> <summary-3.json> [...]',
    );
  }
  const output = process.env.BASELINE_OUTPUT || 'baseline/load-summary.json';
  const baseline = aggregateBaselineFiles(inputs, { outputPath: output });
  console.log(`Wrote measured baseline from ${baseline.metadata.sampleCount} validated runs`);
}

if (require.main === module) main();

module.exports = { aggregateBaselineFiles, aggregateBaselineSamples, median };
