'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const BASELINE_PATH = 'baseline/load-summary.json';
const PROVENANCE_PATH = 'baseline/provenance.json';
const EXPLANATION_PATH = 'docs/baseline-provenance.md';
const HASH_PATTERN = /^[a-f0-9]{64}$/;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function safeRepoFile(root, relativePath, allowedDirectory) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    relativePath.includes('\\') ||
    path.posix.isAbsolute(relativePath) ||
    path.posix.normalize(relativePath) !== relativePath ||
    !relativePath.startsWith(`${allowedDirectory}/`)
  ) {
    return null;
  }

  const rootPath = path.resolve(root);
  const resolved = path.resolve(rootPath, relativePath);
  if (!resolved.startsWith(`${rootPath}${path.sep}`)) return null;
  try {
    const realRoot = fs.realpathSync(rootPath);
    const realPath = fs.realpathSync(resolved);
    const realAllowedDirectory = fs.realpathSync(path.join(rootPath, allowedDirectory));
    if (
      !realPath.startsWith(`${realRoot}${path.sep}`) ||
      !realPath.startsWith(`${realAllowedDirectory}${path.sep}`) ||
      !fs.statSync(realPath).isFile()
    ) {
      return null;
    }
    return realPath;
  } catch {
    return null;
  }
}

function repositoryHref(relativePath, sourceRef) {
  const ref = /^[a-f0-9]{40,64}$/i.test(sourceRef ?? '') ? sourceRef : 'main';
  return `https://github.com/qa-test-automation-frameworks/k6-performance-framework/blob/${ref}/${relativePath
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

function workloadValue(metadata, key) {
  if (isRecord(metadata.workload) && Object.hasOwn(metadata.workload, key)) {
    return metadata.workload[key];
  }
  const aliases = {
    targetRps: ['targetRps', 'targetRequestsPerSecond', 'targetIterationsPerSecond'],
    maxVus: ['maxVus'],
    profile: ['profile'],
    name: ['workloadName'],
  };
  for (const candidate of aliases[key] ?? [key]) {
    if (Object.hasOwn(metadata, candidate)) return metadata[candidate];
  }
  return undefined;
}

/**
 * Reads and verifies the repository's historical baseline provenance separately
 * from current run summaries.
 * @param {string} projectRoot
 * @param {{sourceRef?: string}} [options]
 */
function classifyBaselineProvenance(projectRoot, options = {}) {
  const reasons = [];
  const addReason = (reason) => {
    if (!reasons.includes(reason)) reasons.push(reason);
  };
  let baselineRaw;
  let baseline;
  let baselineSha256 = null;
  let baselineReadError = null;
  try {
    const baselineFile = safeRepoFile(projectRoot, BASELINE_PATH, 'baseline');
    if (!baselineFile) throw new Error('Baseline summary path does not resolve inside baseline/.');
    baselineRaw = fs.readFileSync(baselineFile);
    baselineSha256 = sha256(baselineRaw);
    baseline = JSON.parse(baselineRaw.toString('utf8'));
    if (!isRecord(baseline)) throw new Error('The baseline summary must be a JSON object.');
  } catch (error) {
    baselineReadError = error?.code
      ? `Unable to read baseline summary (${error.code}).`
      : String(error?.message ?? 'Unable to read baseline summary').slice(0, 250);
    addReason(`Baseline summary is unavailable or invalid: ${baselineReadError}`);
  }

  let provenanceRaw;
  let provenance;
  try {
    const provenanceFile = safeRepoFile(projectRoot, PROVENANCE_PATH, 'baseline');
    if (!provenanceFile) {
      const message = fs.existsSync(path.join(projectRoot, PROVENANCE_PATH))
        ? 'Provenance manifest path does not resolve inside baseline/.'
        : 'Provenance manifest is missing.';
      throw new Error(message);
    }
    provenanceRaw = fs.readFileSync(provenanceFile, 'utf8');
    provenance = JSON.parse(provenanceRaw);
    if (!isRecord(provenance)) throw new Error('The provenance manifest must be a JSON object.');
  } catch (error) {
    if (error?.code === 'ENOENT') addReason('Provenance manifest is missing.');
    else if (error?.code) addReason(`Provenance manifest is unreadable (${error.code}).`);
    else if (String(error?.message).includes('Provenance manifest is missing')) {
      addReason('Provenance manifest is missing.');
    } else if (String(error?.message).includes('does not resolve inside baseline')) {
      addReason('Provenance manifest path does not resolve inside baseline/.');
    } else
      addReason(
        `Provenance manifest is invalid: ${String(error?.message ?? 'Unable to parse manifest').slice(0, 250)}`,
      );
  }

  const metadata = isRecord(baseline?.metadata) ? baseline.metadata : {};
  const output = {
    status: 'PROVENANCE_INVALID',
    baselinePath: BASELINE_PATH,
    baselineSha256,
    provenanceSchemaVersion: isRecord(provenance) ? (provenance.schemaVersion ?? null) : null,
    provenanceDisposition: isRecord(provenance) ? (provenance.disposition ?? null) : null,
    sourceInputsAvailable:
      isRecord(provenance) && typeof provenance.sourceInputsAvailable === 'boolean'
        ? provenance.sourceInputsAvailable
        : null,
    sourceArtifacts: [],
    limitations: [],
    reasons,
    generatedAt: typeof baseline?.generatedAt === 'string' ? baseline.generatedAt : null,
    sampleCount:
      Number.isSafeInteger(metadata.sampleCount) && metadata.sampleCount >= 0
        ? metadata.sampleCount
        : null,
    targetId: typeof metadata.targetId === 'string' ? metadata.targetId : 'unknown',
    targetCommit: typeof metadata.targetCommit === 'string' ? metadata.targetCommit : 'unknown',
    frameworkCommit:
      typeof metadata.frameworkCommit === 'string' ? metadata.frameworkCommit : 'unknown',
    workloadSchema:
      typeof metadata.workloadSchema === 'string'
        ? metadata.workloadSchema
        : 'not recorded in historical aggregate',
    workload: isRecord(metadata.workload) ? metadata.workload : {},
    explanationPath: EXPLANATION_PATH,
    explanationHref: null,
  };

  if (!baselineReadError && !isRecord(baseline?.metadata)) {
    addReason('Baseline summary metadata is missing or malformed.');
  }
  if (!isRecord(provenance)) {
    output.reasons = reasons;
    return output;
  }

  if (![1, 2].includes(provenance.schemaVersion)) {
    addReason('Unsupported provenance schemaVersion; expected 1 or 2.');
  }
  if (provenance.baselinePath !== BASELINE_PATH) {
    addReason(`baselinePath must be ${BASELINE_PATH}.`);
  }
  if (!HASH_PATTERN.test(provenance.baselineSha256 ?? '')) {
    addReason('baselineSha256 must be a lowercase SHA-256 digest.');
  } else if (baselineSha256 && provenance.baselineSha256 !== baselineSha256) {
    addReason('Baseline summary digest does not match baselineSha256.');
  }

  const allowedDispositions = new Set([
    'historical-inputs-unavailable',
    'reproducible-measured',
    'measured-retained',
  ]);
  if (!allowedDispositions.has(provenance.disposition)) {
    addReason('Unsupported provenance disposition.');
  }
  if (typeof provenance.sourceInputsAvailable !== 'boolean') {
    addReason('sourceInputsAvailable must be a boolean.');
  }
  if (
    !Array.isArray(provenance.limitations) ||
    provenance.limitations.some((item) => typeof item !== 'string')
  ) {
    addReason('limitations must be an array of strings.');
  } else {
    output.limitations = provenance.limitations;
  }
  if (!Array.isArray(provenance.sourceArtifacts)) {
    addReason('sourceArtifacts must be an array.');
  }
  if (provenance.disposition === 'historical-inputs-unavailable') {
    if (provenance.sourceInputsAvailable !== false) {
      addReason('Historical unavailable provenance must set sourceInputsAvailable to false.');
    }
    if (Array.isArray(provenance.limitations) && provenance.limitations.length === 0) {
      addReason('Historical unavailable provenance must document its limitations.');
    }
  }
  if (
    ['reproducible-measured', 'measured-retained'].includes(provenance.disposition) &&
    provenance.sourceInputsAvailable !== true
  ) {
    addReason('Reproducible measured provenance must set sourceInputsAvailable to true.');
  }

  if (
    provenance.disposition === 'measured-retained' &&
    (provenance.schemaVersion !== 2 || output.sampleCount < 5)
  ) {
    addReason('Measured-retained provenance requires schema 2 and at least five samples.');
  }
  const explanationPath = provenance.explanationPath;
  const explanationFile = safeRepoFile(projectRoot, explanationPath, 'docs');
  if (!explanationFile || explanationPath !== EXPLANATION_PATH) {
    addReason(`explanationPath must resolve to ${EXPLANATION_PATH}.`);
  } else {
    output.explanationPath = explanationPath;
    output.explanationHref = repositoryHref(explanationPath, options.sourceRef);
  }

  const sourcePaths = new Set();
  const sourceNames = new Set();
  const parsedSources = [];
  if (Array.isArray(provenance.sourceArtifacts)) {
    for (const [index, artifact] of provenance.sourceArtifacts.entries()) {
      if (
        !isRecord(artifact) ||
        typeof artifact.path !== 'string' ||
        !HASH_PATTERN.test(artifact.sha256 ?? '')
      ) {
        addReason(`sourceArtifacts[${index}] must include a path and lowercase SHA-256 digest.`);
        continue;
      }
      const sourceFile = safeRepoFile(projectRoot, artifact.path, 'baseline');
      if (!sourceFile || artifact.path === BASELINE_PATH || artifact.path === PROVENANCE_PATH) {
        addReason(`sourceArtifacts[${index}] path must resolve inside baseline/.`);
        continue;
      }
      const sourceName = path.posix.basename(artifact.path);
      if (sourcePaths.has(artifact.path) || sourceNames.has(sourceName)) {
        addReason(`Duplicate source artifact path or basename: ${artifact.path}.`);
        continue;
      }
      sourcePaths.add(artifact.path);
      sourceNames.add(sourceName);
      let bytes;
      try {
        bytes = fs.readFileSync(sourceFile);
      } catch {
        addReason(`Unable to read source artifact: ${artifact.path}.`);
        continue;
      }
      const actualSha = sha256(bytes);
      if (actualSha !== artifact.sha256) {
        addReason(`Source artifact digest does not match: ${artifact.path}.`);
        continue;
      }
      let summary;
      try {
        summary = JSON.parse(bytes.toString('utf8'));
      } catch {
        addReason(`Source artifact is not valid JSON: ${artifact.path}.`);
        continue;
      }
      if (!isRecord(summary) || !isRecord(summary.metadata)) {
        addReason(`Source artifact lacks summary metadata: ${artifact.path}.`);
        continue;
      }
      parsedSources.push({ ...artifact, summary });
    }
  }
  output.sourceArtifacts = parsedSources.map(({ path: sourcePath, sha256: digest }) => ({
    path: sourcePath,
    sha256: digest,
  }));

  if (['reproducible-measured', 'measured-retained'].includes(provenance.disposition)) {
    const sourceFiles = metadata.sourceFiles;
    const sourceDigestMap = metadata.sourceSha256;
    const expectedCount = output.sampleCount;
    if (
      !Number.isSafeInteger(expectedCount) ||
      expectedCount < 1 ||
      !Array.isArray(sourceFiles) ||
      sourceFiles.some((name) => typeof name !== 'string') ||
      sourceFiles.length !== expectedCount ||
      new Set(sourceFiles).size !== sourceFiles.length
    ) {
      addReason(
        'Baseline sourceFiles and sampleCount do not describe a unique complete source set.',
      );
    }
    if (!isRecord(sourceDigestMap)) {
      addReason('Baseline sourceSha256 mapping is missing or malformed.');
    }
    if (
      provenance.sourceArtifacts.length !== expectedCount ||
      parsedSources.length !== expectedCount
    ) {
      addReason('Verified source artifact count does not match baseline sampleCount.');
    }
    const sourceByName = new Map(
      parsedSources.map((source) => [path.posix.basename(source.path), source]),
    );
    if (Array.isArray(sourceFiles)) {
      for (const sourceName of sourceFiles) {
        const source = sourceByName.get(sourceName);
        if (!source) {
          addReason(`Baseline source file is not present in the verified manifest: ${sourceName}.`);
          continue;
        }
        if (!isRecord(sourceDigestMap) || sourceDigestMap[sourceName] !== source.sha256) {
          addReason(`Baseline sourceSha256 does not match ${sourceName}.`);
        }
        const sourceMetadata = source.summary.metadata;
        for (const key of [
          'targetId',
          'targetCommit',
          'frameworkCommit',
          'k6Version',
          'runnerClass',
        ]) {
          if (typeof metadata[key] === 'string' && sourceMetadata[key] !== metadata[key]) {
            addReason(`Source identity differs from the aggregate for ${key}: ${sourceName}.`);
          }
        }
        if (isRecord(metadata.workload)) {
          for (const [key, expected] of Object.entries(metadata.workload)) {
            if (workloadValue(sourceMetadata, key) !== expected) {
              addReason(`Source workload differs from the aggregate for ${key}: ${sourceName}.`);
            }
          }
        }
      }
    }
  }

  if (reasons.length === 0) {
    output.status = ['reproducible-measured', 'measured-retained'].includes(provenance.disposition)
      ? 'REPRODUCIBLE — SOURCE INPUTS VERIFIED'
      : 'HISTORICAL — SOURCE INPUTS UNAVAILABLE';
  }
  output.reasons = reasons;
  return output;
}

module.exports = { classifyBaselineProvenance };
