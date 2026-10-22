'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const { classifyBaselineProvenance } = require('../baseline-provenance.cjs');
const builderPath = path.resolve(__dirname, '..', 'build-report-site.cjs');
const repositoryRoot = path.resolve(__dirname, '../..');

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

function makeReproducibleProject(root) {
  fs.mkdirSync(path.join(root, 'baseline', 'artifacts'), { recursive: true });
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(root, 'docs', 'baseline-provenance.md'), '# Fixture provenance\n');

  const workload = { name: 'load', targetRps: 20, maxVus: 100, profile: 'full' };
  const identity = {
    targetId: 'fixture-target',
    targetCommit: 'target-sha',
    frameworkCommit: 'framework-sha',
    k6Version: '2.0.0',
    runnerClass: 'fixture-runner',
    workload,
  };
  const sourceFiles = ['source-1-summary.json', 'source-2-summary.json', 'source-3-summary.json'];
  const sourceSha256 = {};
  for (const sourceName of sourceFiles) {
    const source = JSON.stringify({
      metadata: identity,
      metrics: { http_req_duration: { 'p(95)': 2 } },
    });
    fs.writeFileSync(path.join(root, 'baseline', 'artifacts', sourceName), source);
    sourceSha256[sourceName] = hash(source);
  }
  const baseline = {
    generatedAt: '2026-10-20T00:00:00.000Z',
    metadata: { ...identity, sampleCount: sourceFiles.length, sourceFiles, sourceSha256 },
    metrics: { http_req_duration: { 'p(95)': 2 } },
  };
  const baselineRaw = JSON.stringify(baseline);
  fs.writeFileSync(path.join(root, 'baseline', 'load-summary.json'), baselineRaw);
  const provenance = {
    schemaVersion: 1,
    baselinePath: 'baseline/load-summary.json',
    baselineSha256: hash(baselineRaw),
    disposition: 'reproducible-measured',
    sourceInputsAvailable: true,
    sourceArtifacts: sourceFiles.map((sourceName) => ({
      path: `baseline/artifacts/${sourceName}`,
      sha256: sourceSha256[sourceName],
    })),
    limitations: [],
    explanationPath: 'docs/baseline-provenance.md',
  };
  fs.writeFileSync(path.join(root, 'baseline', 'provenance.json'), JSON.stringify(provenance));
  return { baseline, provenance, sourceFiles };
}

test('committed June aggregate remains explicitly historical with unavailable sources', () => {
  const result = classifyBaselineProvenance(repositoryRoot);
  const baseline = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'baseline', 'load-summary.json'), 'utf8'),
  );
  assert.equal(result.status, 'HISTORICAL — SOURCE INPUTS UNAVAILABLE');
  assert.equal(result.generatedAt, '2026-06-14T07:07:46.553Z');
  assert.equal(result.sampleCount, 3);
  assert.equal(result.sourceInputsAvailable, false);
  assert.deepEqual(result.sourceArtifacts, []);
  for (const sourceName of baseline.metadata.sourceFiles) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, 'baseline', sourceName)), false);
  }
  assert.equal(result.workloadSchema, 'not recorded in historical aggregate');
  assert.equal(fs.existsSync(path.join(repositoryRoot, result.explanationPath)), true);
  assert.match(result.explanationHref, /blob\/main\/docs\/baseline-provenance\.md$/);
});

test('three retained, matching source inputs produce a reproducible-measured disposition', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-provenance-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const fixture = makeReproducibleProject(root);
  const result = classifyBaselineProvenance(root, { sourceRef: 'a'.repeat(40) });
  assert.equal(result.status, 'REPRODUCIBLE — SOURCE INPUTS VERIFIED');
  assert.equal(result.sourceInputsAvailable, true);
  assert.equal(result.sampleCount, 3);
  assert.equal(result.sourceArtifacts.length, 3);
  assert.deepEqual(
    result.sourceArtifacts.map((source) => path.posix.basename(source.path)),
    fixture.sourceFiles,
  );
  assert.match(
    result.explanationHref,
    new RegExp(`/blob/${'a'.repeat(40)}/docs/baseline-provenance\\.md$`),
  );
});

test('a retained input whose content differs from its declared digest is invalid', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-provenance-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  makeReproducibleProject(root);
  fs.appendFileSync(path.join(root, 'baseline', 'artifacts', 'source-1-summary.json'), ' ');
  const result = classifyBaselineProvenance(root);
  assert.equal(result.status, 'PROVENANCE_INVALID');
  assert.match(result.reasons.join(' '), /Source artifact digest does not match/);
});

test('missing provenance and unsupported schema versions are invalid', (t) => {
  const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-missing-'));
  t.after(() => fs.rmSync(missingRoot, { recursive: true, force: true }));
  makeReproducibleProject(missingRoot);
  fs.rmSync(path.join(missingRoot, 'baseline', 'provenance.json'));
  const missing = classifyBaselineProvenance(missingRoot);
  assert.equal(missing.status, 'PROVENANCE_INVALID');
  assert.match(missing.reasons.join(' '), /manifest is missing/);

  const unknownRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-schema-'));
  t.after(() => fs.rmSync(unknownRoot, { recursive: true, force: true }));
  const { provenance } = makeReproducibleProject(unknownRoot);
  fs.writeFileSync(
    path.join(unknownRoot, 'baseline', 'provenance.json'),
    JSON.stringify({ ...provenance, schemaVersion: 99 }),
  );
  const unknown = classifyBaselineProvenance(unknownRoot);
  assert.equal(unknown.status, 'PROVENANCE_INVALID');
  assert.match(unknown.reasons.join(' '), /Unsupported provenance schemaVersion/);

  const enumRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-enum-'));
  t.after(() => fs.rmSync(enumRoot, { recursive: true, force: true }));
  const { provenance: enumManifest } = makeReproducibleProject(enumRoot);
  fs.writeFileSync(
    path.join(enumRoot, 'baseline', 'provenance.json'),
    JSON.stringify({ ...enumManifest, disposition: 'pass' }),
  );
  const unknownEnum = classifyBaselineProvenance(enumRoot);
  assert.equal(unknownEnum.status, 'PROVENANCE_INVALID');
  assert.match(unknownEnum.reasons.join(' '), /Unsupported provenance disposition/);
});

test('duplicate source artifact paths are rejected', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-duplicate-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { provenance } = makeReproducibleProject(root);
  provenance.sourceArtifacts[1] = { ...provenance.sourceArtifacts[0] };
  fs.writeFileSync(path.join(root, 'baseline', 'provenance.json'), JSON.stringify(provenance));
  const result = classifyBaselineProvenance(root);
  assert.equal(result.status, 'PROVENANCE_INVALID');
  assert.match(result.reasons.join(' '), /Duplicate source artifact path or basename/);
});

test('explanation paths are checked against repository files', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-baseline-explanation-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { provenance } = makeReproducibleProject(root);
  fs.rmSync(path.join(root, 'docs', 'baseline-provenance.md'));
  fs.writeFileSync(path.join(root, 'baseline', 'provenance.json'), JSON.stringify(provenance));
  const result = classifyBaselineProvenance(root);
  assert.equal(result.status, 'PROVENANCE_INVALID');
  assert.match(result.reasons.join(' '), /explanationPath must resolve/);
  assert.equal(result.explanationHref, null);
});

test('a passing current run does not turn the June aggregate into a current PASS', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'k6-pages-historical-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'reports'));
  fs.mkdirSync(path.join(root, 'baseline'));
  fs.mkdirSync(path.join(root, 'docs'));
  fs.copyFileSync(
    path.join(repositoryRoot, 'baseline', 'load-summary.json'),
    path.join(root, 'baseline', 'load-summary.json'),
  );
  fs.copyFileSync(
    path.join(repositoryRoot, 'baseline', 'provenance.json'),
    path.join(root, 'baseline', 'provenance.json'),
  );
  fs.copyFileSync(
    path.join(repositoryRoot, 'docs', 'baseline-provenance.md'),
    path.join(root, 'docs', 'baseline-provenance.md'),
  );
  const currentSummary = {
    metadata: {
      workloadSchema: 'journey-arrival-v1',
      targetId: 'current-target',
      profile: 'smoke',
    },
    metrics: { http_req_duration: { 'p(95)': 3 }, http_req_failed: { rate: 0 } },
    thresholds: { http_req_duration: { 'p(95)<10': { ok: true } } },
    failures: [],
    achievedLoad: null,
  };
  fs.writeFileSync(
    path.join(root, 'reports', 'current-summary.json'),
    JSON.stringify(currentSummary),
  );
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({
      private: true,
      scripts: { 'report:site': `node ${JSON.stringify(builderPath)}` },
    }),
  );

  const bundledNode = path.dirname(process.execPath);
  const run = spawnSync('npm', ['run', 'report:site'], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
    env: { ...process.env, PATH: `${bundledNode}${path.delimiter}${process.env.PATH ?? ''}` },
  });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(root, 'site', 'report-manifest.json'), 'utf8'),
  );
  const html = fs.readFileSync(path.join(root, 'site', 'index.html'), 'utf8');
  assert.equal(manifest.reports.length, 1);
  assert.equal(manifest.reports[0].disposition.status, 'PASS');
  assert.equal(manifest.baseline.status, 'HISTORICAL — SOURCE INPUTS UNAVAILABLE');
  assert.doesNotMatch(html, /load-summary\.json.*PASS/);
  assert.match(html, /HISTORICAL — SOURCE INPUTS UNAVAILABLE/);
  assert.match(html, /current run summaries only/);
});
