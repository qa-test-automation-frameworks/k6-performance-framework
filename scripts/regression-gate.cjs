const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const gateModePath = process.env.GATE_MODE_FILE || 'baseline/gate-mode.json';

function readGateMode() {
  const mode = JSON.parse(fs.readFileSync(gateModePath, 'utf8'));
  const text = (key) => typeof mode[key] === 'string' && mode[key].trim() !== '';
  if (
    mode.schemaVersion !== 1 ||
    !['advisory', 'blocking'].includes(mode.mode) ||
    !text('reason') ||
    !text('exitCriteria') ||
    !/^\d{4}-\d{2}-\d{2}$/.test(mode.since ?? '')
  ) {
    throw new Error(`Invalid gate mode file ${gateModePath}`);
  }
  return mode;
}

function main() {
  let mode;
  try {
    mode = readGateMode();
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  const result = spawnSync(process.execPath, [path.join(__dirname, 'compare-performance.cjs')], {
    stdio: 'inherit',
    env: process.env,
  });
  const status = result.status ?? 2;
  if (mode.mode === 'blocking' || ![1, 3].includes(status)) return status;
  const message = `ADVISORY (not blocking): ${mode.reason} Exit criteria: ${mode.exitCriteria}`;
  console.log(message);
  console.log(`::warning title=Performance comparison is advisory::${mode.reason}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n**${message}**\n`);
  }
  return 0;
}

process.exitCode = main();
