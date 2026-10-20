const fs = require('node:fs');
const { assertCompatibleHistory } = require('./workload-identity.cjs');
const [previousPath, candidatePath] = process.argv.slice(2);
if (!previousPath || !candidatePath) throw new Error('Two history summary paths are required');
const previous = JSON.parse(fs.readFileSync(previousPath, 'utf8'));
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
assertCompatibleHistory(previous.metadata, candidate.metadata);
console.log('Compatible historical identity; metric comparison is a separate step');
