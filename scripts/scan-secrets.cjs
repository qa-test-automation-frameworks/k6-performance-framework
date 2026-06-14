const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const patterns = [
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g },
  {
    name: 'credential assignment',
    pattern: /\b(?:api[_-]?key|client[_-]?secret|password|token)\s*[:=]\s*["'][^"'$\n]{12,}["']/gi,
  },
];
const allowedFiles = new Set(['.env.example']);
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter((file) => file && fs.existsSync(file));
const findings = [];

for (const file of files) {
  const content = fs.readFileSync(file);
  if (content.includes(0)) continue;
  const text = content.toString('utf8');
  for (const { name, pattern } of patterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      if (allowedFiles.has(file)) continue;
      const line = text.slice(0, match.index).split('\n').length;
      findings.push(`${file}:${line}: ${name}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`Potential secrets detected:\n${findings.join('\n')}`);
  process.exit(1);
}

console.log(`Scanned ${files.length} tracked files; no potential secrets detected`);
