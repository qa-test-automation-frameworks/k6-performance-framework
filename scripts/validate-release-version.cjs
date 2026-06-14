const fs = require('node:fs');

const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const tag = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME;
if (!tag) throw new Error('RELEASE_TAG or GITHUB_REF_NAME is required');
if (tag !== `v${version}`) {
  throw new Error(`Release tag ${tag} does not match package version v${version}`);
}
console.log(`Release version verified: ${tag}`);
