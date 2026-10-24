'use strict';

const fs = require('node:fs');
const crypto = require('node:crypto');
const { median } = require('./aggregate-baseline.cjs');

function deriveTolerance(sources) {
  if (!Array.isArray(sources) || sources.length < 5)
    throw new Error('At least five calibration samples are required');
  const keys = [
    ...new Set(
      sources.flatMap(({ summary }) =>
        Object.entries(summary.metrics || {})
          .filter(
            ([metric]) =>
              metric === 'http_req_duration' ||
              metric.startsWith('http_req_duration{name:') ||
              (metric.startsWith('custom_') && metric.endsWith('_duration_ms')),
          )
          .flatMap(([metric, values]) =>
            Object.keys(values)
              .filter((statistic) => ['p(95)', 'p(99)'].includes(statistic))
              .map((statistic) => JSON.stringify([metric, statistic])),
          ),
      ),
    ),
  ];
  if (!keys.length) throw new Error('No percentile metrics found');
  const perMetric = {};
  for (const key of keys) {
    const [metric, statistic] = JSON.parse(key);
    const values = sources.map(({ summary }) => summary.metrics?.[metric]?.[statistic]);
    if (values.some((value) => !Number.isFinite(value) || value < 0))
      throw new Error(`Missing or invalid ${metric}.${statistic}`);
    const center = median(values);
    const max = Math.max(...values);
    // Zero-valued calibration cannot support a finite relative tolerance.
    if (center <= 0) throw new Error(`Nonpositive median for ${metric}.${statistic}`);
    perMetric[`${metric}.${statistic}`] = {
      median: center,
      max,
      relative: Math.max(0.2, max / center - 1 + 0.1),
      absoluteMs: Math.max(1.0, (max - center) * 1.5),
    };
  }
  return {
    schemaVersion: 1,
    derivedFrom: sources.map(({ path, sha256, runUrl }) => ({ path, sha256, runUrl })),
    method: 'relative=max(0.20,max/median-1+0.10); absoluteMs=max(1.0,(max-median)*1.5)',
    margin: 0.1,
    floorRelative: 0.2,
    floorAbsoluteMs: 1.0,
    perMetric,
  };
}

if (require.main === module) {
  const sources = process.argv.slice(2).map((path) => {
    const bytes = fs.readFileSync(path);
    return {
      path,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      runUrl: process.env.WORKFLOW_RUN_URL,
      summary: JSON.parse(bytes),
    };
  });
  const output = process.env.TOLERANCE_OUTPUT || 'baseline/tolerance.json';
  fs.mkdirSync(require('node:path').dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(deriveTolerance(sources), null, 2) + '\n');
}

module.exports = { deriveTolerance };
