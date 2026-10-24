'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const METRICS = [
  'http_req_duration',
  'http_req_duration{name:GET /articles}',
  'custom_tag_duration_ms',
  'custom_comment_duration_ms',
  'http_req_duration{name:GET /articles/:slug}',
  'http_req_duration{name:GET /profiles/:username}',
  'http_req_duration{name:GET /articles/:slug/comments}',
  'http_req_duration{name:GET /tags}',
  'custom_profile_duration_ms',
  'custom_article_read_duration_ms',
];

function derive(directories) {
  if (directories.length !== 3) throw new Error('Exactly three artifact directories are required');
  const sources = directories.map((directory) => {
    const file = path.join(directory, 'load-summary.json');
    const bytes = fs.readFileSync(file);
    return {
      path: file.split(path.sep).join('/'),
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      summary: JSON.parse(bytes),
    };
  });
  const metrics = Object.fromEntries(
    METRICS.map((metric) => [
      metric,
      Object.fromEntries(
        ['p(95)', 'p(99)'].map((statistic) => {
          const samples = sources.map(({ summary, path }) => {
            const value = summary.metrics?.[metric]?.[statistic];
            if (!Number.isFinite(value) || value < 0)
              throw new Error(`Missing or invalid ${metric}.${statistic} in ${path}`);
            return value;
          });
          const ordered = [...samples].sort((a, b) => a - b);
          return [statistic, { samples, min: ordered[0], median: ordered[1], max: ordered[2] }];
        }),
      ),
    ]),
  );
  return {
    schemaVersion: 1,
    method: 'Run-level percentiles; descriptive min/median/max, without pooling requests.',
    sources: sources.map(({ path, sha256 }) => ({ path, sha256 })),
    metrics,
  };
}

function checkDocument(cohort, text) {
  for (const [metric, statistics] of Object.entries(cohort.metrics)) {
    const row = text.split('\n').find((line) => line.split('|')[1]?.trim() === `\`${metric}\``);
    if (!row) throw new Error(`Document has no row for ${metric}`);
    const cells = row
      .split('|')
      .slice(2, 6)
      .map((cell) => cell.trim());
    const expected = ['p(95)', 'p(99)'].flatMap((key) => {
      const value = statistics[key];
      return [
        value.samples.map((x) => x.toFixed(4)).join(' / '),
        [value.min, value.median, value.max].map((x) => x.toFixed(4)).join(' / '),
      ];
    });
    if (JSON.stringify(cells) !== JSON.stringify(expected))
      throw new Error(
        `Published figures differ for ${metric}; do not rewrite them without investigating`,
      );
  }
}

if (require.main === module) {
  const cohort = derive(process.argv.slice(2));
  checkDocument(
    cohort,
    fs.readFileSync('docs/experiments/full-profile-validation-2026-10-22.md', 'utf8'),
  );
  const output = process.env.COHORT_OUTPUT || 'docs/experiments/data/2026-10-22/cohort.json';
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(cohort, null, 2) + '\n');
  fs.writeFileSync(
    path.join(path.dirname(output), 'SHA256SUMS'),
    cohort.sources.map(({ path, sha256 }) => `${sha256}  ${path}`).join('\n') + '\n',
  );
  console.log(
    `Verified all ${METRICS.length * 2} percentile rows against the published table; wrote ${output}`,
  );
}

module.exports = { derive, checkDocument };
