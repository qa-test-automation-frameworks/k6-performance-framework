const fs = require('node:fs');
const path = require('node:path');
const pin = fs.readFileSync(path.join(__dirname, '..', '.nvmrc'), 'utf8').trim();
if (!/^\d+\.\d+\.\d+$/.test(pin)) throw new Error('.nvmrc must pin a stable Node.js release');
const required = require('../package.json').packageManager.replace(/^npm@/, '');

function assertSupportedNode(version) {
  const expected = pin.split('.').map(Number);
  const actual = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)?.slice(1).map(Number);
  if (
    !actual ||
    actual[0] !== expected[0] ||
    actual[1] < expected[1] ||
    (actual[1] === expected[1] && actual[2] < expected[2])
  ) {
    throw new Error(
      `This repository requires Node.js ${pin} or a newer patch/minor in the same major; detected ${version}. Install the version in .nvmrc before running npx --yes npm@${required} ci.`,
    );
  }
}

if (require.main === module) {
  try {
    assertSupportedNode(process.versions.node);
    const actual = process.env.npm_config_user_agent?.match(/\bnpm\/([^\s]+)/)?.[1];
    if (actual !== required) {
      throw new Error(
        `This repository requires npm ${required}; detected ${actual ?? 'an unknown npm version'}. Run: npx --yes npm@${required} ci`,
      );
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { assertSupportedNode };
