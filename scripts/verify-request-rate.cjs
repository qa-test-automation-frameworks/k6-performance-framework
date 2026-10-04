// Black-box executor/count check against a disposable loopback HTTP fixture.
// This is not a RealWorld capacity benchmark or a production-scale claim.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const outputDirectory = 'reports/request-rate-verification';
fs.mkdirSync(outputDirectory, { recursive: true });
const runtime = spawnSync(process.env.K6_BINARY || 'k6', ['version'], { encoding: 'utf8' });
if (runtime.status !== 0 || !/^k6 v2\.0\.0\b/.test(runtime.stdout)) {
  throw new Error('Counting verification requires the declared k6 v2.0.0 runtime');
}
const sourceFilesSha256 = Object.fromEntries(
  [
    'scripts/verify-request-rate.cjs',
    'tests/load/request-rate-load.ts',
    'config/workloads.ts',
    'src/helpers/achieved-load.ts',
    'src/helpers/summary.ts',
  ].map((file) => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]),
);

async function verify(mode, rate, seconds, maxVus) {
  const observed = { warmup: 0, measurement: 0, other: 0, articles: 0, tags: 0 };
  const server = http.createServer((request, response) => {
    const phase = request.headers['x-load-phase'];
    if (phase === 'request_measurement') {
      observed.measurement += 1;
      if (request.url.startsWith('/api/articles')) observed.articles += 1;
      if (request.url === '/api/tags') observed.tags += 1;
    } else if (phase === 'request_warmup') observed.warmup += 1;
    else observed.other += 1;
    const respond = () => {
      response.writeHead(mode === 'http-error' ? 503 : 200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ articles: [], articlesCount: 0, tags: ['fixture'] }));
    };
    if (mode === 'under-driven') setTimeout(respond, 250);
    else respond();
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const name = `request-rate-verification/${mode}`;
  const env = {
    ...process.env,
    TARGET_ENV: 'local',
    BASE_URL: `http://127.0.0.1:${server.address().port}/api`,
    WORKLOAD_MODE: 'request-rate',
    REQUESTS_PER_SECOND: String(rate),
    WARMUP_SECONDS: '1',
    MEASUREMENT_SECONDS: String(seconds),
    MINIMUM_ACHIEVED_FRACTION: '0.98',
    MAX_VUS: String(maxVus),
    SUMMARY_NAME: name,
    TARGET_ID: 'disposable-count-validation-fixture',
    TARGET_COMMIT: 'fixture-defined-in-verify-request-rate-script',
    FRAMEWORK_COMMIT: process.env.FRAMEWORK_COMMIT || 'unknown',
    RUNNER_CLASS: 'colocated-loopback-validation',
    K6_VERSION: process.env.K6_VERSION || '2.0.0',
  };
  // An inherited old variable must never alter this explicitly specified new experiment.
  delete env.TARGET_RPS;
  let stdout = '';
  let stderr = '';
  let result;
  try {
    result = await new Promise((resolve, reject) => {
      const child = spawn(
        process.env.K6_BINARY || 'k6',
        ['run', '--quiet', 'dist/load/request-rate-load.js'],
        {
          env,
        },
      );
      const timer = setTimeout(() => child.kill('SIGTERM'), (seconds + 20) * 1000);
      child.stdout.on('data', (chunk) => {
        stdout += chunk;
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk;
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timer);
        resolve({ code, signal });
      });
    });
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    fs.writeFileSync(path.join(outputDirectory, `${mode}-stdout.log`), stdout);
    fs.writeFileSync(path.join(outputDirectory, `${mode}-stderr.log`), stderr);
  }
  const summary = JSON.parse(fs.readFileSync(`reports/${name}-summary.json`, 'utf8'));
  const verdict = {
    runtime: runtime.stdout.trim(),
    sourceFilesSha256,
    mode,
    nativeExit: result.code,
    signal: result.signal,
    observed,
    achievedLoad: summary.achievedLoad,
    failures: summary.failures,
    expectedMeasurementRequests: rate * seconds,
    limitation:
      'Executor/count validation fixture; colocated generator and target; not application capacity evidence.',
  };
  fs.writeFileSync(
    path.join(outputDirectory, `${mode}-observed.json`),
    `${JSON.stringify(verdict, null, 2)}\n`,
  );
  if (result.signal || result.code === null)
    throw new Error(`${mode}: runner did not finish normally`);
  if (observed.measurement !== summary.achievedLoad.requests || observed.other !== 0) {
    throw new Error(
      `${mode}: native HTTP count does not match independently observed server requests`,
    );
  }
  if (mode === 'healthy') {
    if (result.code !== 0 || !summary.achievedLoad.valid || summary.failures.length) {
      throw new Error('Healthy fixture failed: inspect native logs and achieved-load evidence');
    }
    if (observed.measurement !== rate * seconds || observed.tags !== observed.measurement / 5) {
      throw new Error('Healthy fixture did not produce the declared request count/mix');
    }
  } else if (mode === 'under-driven') {
    if (
      result.code !== 99 ||
      summary.achievedLoad.valid ||
      summary.achievedLoad.droppedIterations <= 0
    ) {
      throw new Error('Under-driven fixture did not fail the achieved-load/drop gate as intended');
    }
  } else if (
    result.code !== 99 ||
    !summary.failures.some((failure) => failure.startsWith('Checks:'))
  ) {
    throw new Error('HTTP-error fixture did not fail the functional check as intended');
  }
  console.log(
    `${mode}: expected outcome verified; native exit ${result.code}, independently observed ${observed.measurement} measurement requests`,
  );
}

(async () => {
  await verify('healthy', 500, 10, 20);
  await verify('under-driven', 20, 3, 1);
  await verify('http-error', 20, 3, 20);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
