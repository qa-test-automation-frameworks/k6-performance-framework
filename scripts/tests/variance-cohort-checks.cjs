'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { derive, checkDocument } = require('../derive-variance-cohort.cjs');

const directories = ['39739132415', '39740373441', '39742063368'].map(
  (id) => `docs/experiments/data/2026-10-22/${id}`,
);

test('retained summaries reproduce the published table without changing its figures', () => {
  const cohort = derive(directories);
  checkDocument(
    cohort,
    fs.readFileSync('docs/experiments/full-profile-validation-2026-10-22.md', 'utf8'),
  );
  assert.equal(cohort.metrics.http_req_duration['p(95)'].samples.length, 3);
  assert.equal(cohort.sources.length, 3);
  assert.throws(() => checkDocument(cohort, ''), /no row/);
});

test('missing artifact and missing metric fail closed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'variance-cohort-'));
  try {
    assert.throws(() => derive([directory, ...directories.slice(1)]), /ENOENT/);
    fs.writeFileSync(path.join(directory, 'load-summary.json'), JSON.stringify({ metrics: {} }));
    assert.throws(() => derive([directory, ...directories.slice(1)]), /Missing or invalid/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
