const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Ajv2020 = require('ajv/dist/2020').default;
const addFormats = require('ajv-formats');

const schemaPath = path.join(__dirname, '../portfolio/evidence/evidence-v3.schema.json');
const policiesPath = path.join(__dirname, '../portfolio/evidence/freshness-policies.json');
const schemaBytes = fs.readFileSync(schemaPath);
const policiesBytes = fs.readFileSync(policiesPath);
const contractDigests = {
  schema: '40502a47e825755d216e35ea19716ad7de69e47accd6aed1cfb3607160e4d1b9',
  policies: '1313329c1c06bd3a056dd1ed7d25c631036cae58480fdc4e767f22a0a01a568e',
};
function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}
if (
  sha256(schemaBytes) !== contractDigests.schema ||
  sha256(policiesBytes) !== contractDigests.policies
) {
  throw new Error(
    'Pinned portfolio schema/policy snapshot hash mismatch; reconcile E01 before validation.',
  );
}
const schema = JSON.parse(schemaBytes);
const freshness = JSON.parse(policiesBytes).policies;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
ajv.addFormat('https-url', {
  type: 'string',
  validate: (value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  },
});
const validateSchema = ajv.compile(schema);

function validateRecord(record) {
  const errors = [];
  if (!validateSchema(record))
    errors.push(
      ...validateSchema.errors.map((error) => `${error.instancePath || '/'} ${error.message}`),
    );
  if (errors.length || record.kind === 'historical_attestation') return errors;
  const e = record.execution;
  const p = record.publication;
  const c = e.counts;
  const fail = (reason) => errors.push(`semantic: ${reason}`);
  if (
    record.workflow.url !==
    `https://github.com/${record.repository}/actions/runs/${record.workflow.runId}`
  )
    fail('workflow URL does not identify this repository/run');
  if (!Object.hasOwn(freshness, record.scope.freshnessPolicy)) fail('unknown freshness policy');
  if (e.disposition !== 'passed' && !e.reason?.trim())
    fail('non-passing execution requires a reason');
  if (['passed', 'failed', 'cancelled'].includes(e.disposition) && !e.completedAt)
    fail('terminal execution requires completedAt');
  if (['passed', 'failed', 'in_progress', 'cancelled'].includes(e.disposition) && !e.startedAt)
    fail('attempted execution requires startedAt');
  if (e.disposition === 'in_progress' && e.completedAt !== null)
    fail('in-progress execution cannot be completed');
  if (e.startedAt && e.completedAt && Date.parse(e.completedAt) < Date.parse(e.startedAt))
    fail('completion precedes start');
  const expected = new Set(e.shards.expected);
  const received = new Set(e.shards.received);
  if (received.size !== e.shards.received.length) fail('duplicate shard received');
  if (e.shards.received.some((shard) => !expected.has(shard))) fail('unexpected shard');
  const allShards =
    received.size === expected.size && [...expected].every((shard) => received.has(shard));
  if (e.integrity === 'complete' && !allShards)
    fail('complete integrity requires every expected shard');
  if (
    c.unit === 'not_applicable' &&
    ['selected', 'executed', 'passed', 'failed', 'skipped', 'retried'].some(
      (key) => c[key] !== null,
    )
  )
    fail('performance scope must not invent test counts');
  if (
    c.passed !== null &&
    c.failed !== null &&
    c.executed !== null &&
    c.passed + c.failed > c.executed
  )
    fail('final outcomes exceed execution count');
  if (
    c.selected !== null &&
    c.executed !== null &&
    c.skipped !== null &&
    c.executed + c.skipped > c.selected
  )
    fail('execution plus skips exceed selected count');
  if (c.retried !== null && c.executed !== null && c.retried > c.executed)
    fail('retried unique cases exceed executed unique cases');
  if (
    ['skipped', 'unavailable'].includes(e.disposition) &&
    (['executed', 'passed', 'failed', 'retried'].some((key) => c[key] > 0) || e.measurements.length)
  )
    fail('non-execution disposition cannot claim substantive results');
  if (e.integrity === 'empty' && (c.executed > 0 || e.measurements.length))
    fail('empty evidence cannot contain substantive execution');
  if (e.disposition === 'passed') {
    if (e.integrity !== 'complete' || !allShards)
      fail('pass requires complete evidence and all expected shards');
    if (!(c.executed > 0 || e.measurements.length > 0))
      fail('pass requires substantive native execution');
    if (c.failed > 0) fail('pass cannot contain failures');
    if (
      c.executed !== null &&
      c.passed !== null &&
      c.failed !== null &&
      c.executed !== c.passed + c.failed
    )
      fail('pass must reconcile final outcomes');
    if (
      c.selected !== null &&
      c.executed !== null &&
      c.skipped !== null &&
      c.selected !== c.executed + c.skipped
    )
      fail('pass must reconcile selected cases');
  }
  if (new Set(e.measurements.map((item) => item.name)).size !== e.measurements.length)
    fail('duplicate measurement identity');
  if (new Set(p.artifacts.map((item) => item.name)).size !== p.artifacts.length)
    fail('duplicate artifact identity');
  if (p.disposition === 'published' && (!p.publishedAt || !p.artifacts.length))
    fail('published evidence requires time and checksummed artifacts');
  if (p.disposition !== 'published' && (p.publishedAt !== null || p.reportUrl !== null))
    fail('unpublished evidence cannot claim current publication');
  if (['failed', 'not_applicable'].includes(p.disposition) && !p.reason?.trim())
    fail('publication disposition requires a reason');
  if (p.publishedAt && e.completedAt && Date.parse(p.publishedAt) < Date.parse(e.completedAt))
    fail('publication precedes execution completion');
  return errors;
}

function main() {
  const files = process.argv.slice(2);
  if (!files.length)
    throw new Error('Usage: node scripts/validate-portfolio-evidence.cjs <evidence.json> [...]');
  let invalid = false;
  for (const file of files) {
    try {
      const errors = validateRecord(JSON.parse(fs.readFileSync(file, 'utf8')));
      if (errors.length) {
        invalid = true;
        console.error(`${file}: invalid\n${errors.join('\n')}`);
      } else console.log(`${file}: valid`);
    } catch (error) {
      invalid = true;
      console.error(`${file}: ${error.message}`);
    }
  }
  if (invalid) process.exitCode = 1;
}

module.exports = { validateRecord };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
