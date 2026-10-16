const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const reportDirectory = path.join(root, 'reports');
const targetUrl = process.env.D04_UPSTREAM_URL ?? 'http://127.0.0.1:3000/api';
const proxyPort = Number(process.env.D04_PROXY_PORT ?? '3130');
const targetCommit = process.env.TARGET_COMMIT;
const k6Binary = process.env.K6_BINARY ?? 'k6';
const expectedK6Version = process.env.D04_K6_VERSION ?? '2.0.0';
const delayMs = Number(process.env.D04_CONTROLLED_DELAY_MS ?? '125');

if (!targetCommit || !/^[0-9a-f]{40}$/i.test(targetCommit)) {
  throw new Error('TARGET_COMMIT must be the full pinned application commit SHA');
}
if (!Number.isInteger(delayMs) || delayMs < 100 || delayMs > 500) {
  throw new Error('D04_CONTROLLED_DELAY_MS must be an integer from 100 to 500');
}
fs.mkdirSync(reportDirectory, { recursive: true });

function cgroupValue(file) {
  try {
    const value = fs.readFileSync('/sys/fs/cgroup/' + file, 'utf8').trim();
    return value === 'max' ? null : value;
  } catch {
    return null;
  }
}

function spawnCaptured(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
    ...options,
  });
  if (result.error) throw result.error;
  return result;
}

const versionResult = spawnCaptured(k6Binary, ['version']);
if (versionResult.status !== 0)
  throw new Error('Unable to read k6 version: ' + versionResult.stderr);
const k6VersionOutput = (versionResult.stdout + '\n' + versionResult.stderr).trim();
const versionPattern = new RegExp('\\bv' + expectedK6Version.replaceAll('.', '\\.') + '\\b');
if (!versionPattern.test(k6VersionOutput)) {
  throw new Error('Expected k6 ' + expectedK6Version + '; got ' + k6VersionOutput);
}

const proxyLogPath = path.join(reportDirectory, 'd04-proxy.log');
const proxyLog = fs.createWriteStream(proxyLogPath, { flags: 'w' });
let currentStage = 'starting controlled-latency proxy';
const proxy = spawn(process.execPath, [path.join(__dirname, 'd04-latency-proxy.cjs')], {
  cwd: root,
  env: {
    ...process.env,
    D04_UPSTREAM_URL: targetUrl,
    D04_PROXY_PORT: String(proxyPort),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
proxy.stdout.pipe(proxyLog);
proxy.stderr.pipe(proxyLog);

async function waitForProxy() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (proxy.exitCode !== null) throw new Error('D04 proxy exited with ' + proxy.exitCode);
    try {
      const response = await fetch('http://127.0.0.1:' + proxyPort + '/__d04/health', {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok && (await response.json()).ready === true) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('D04 proxy did not become ready within 20 seconds');
}

async function setDelay(value) {
  const response = await fetch('http://127.0.0.1:' + proxyPort + '/__d04/control', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ delayMs: value }),
  });
  if (!response.ok || (await response.json()).responseDelayMs !== value) {
    throw new Error('D04 proxy did not accept the requested ' + value + ' ms delay');
  }
}

async function run() {
  currentStage = 'waiting for controlled-latency proxy readiness';
  await waitForProxy();
  const order = ['healthy', 'degraded', 'degraded', 'healthy', 'healthy', 'degraded'];
  const results = [];
  const frameworkCommit = process.env.FRAMEWORK_COMMIT ?? 'unknown';
  const runnerClass =
    (process.env.RUNNER_OS ?? os.platform()) + '-' + (process.env.RUNNER_ARCH ?? os.arch());

  for (const [index, condition] of order.entries()) {
    const repetition = results.filter((result) => result.condition === condition).length + 1;
    const delay = condition === 'healthy' ? 0 : delayMs;
    currentStage = 'setting ' + condition + ' condition for sample ' + repetition;
    await setDelay(delay);
    const summaryName = 'd04-' + condition + '-' + repetition;
    const summaryPath = path.join(reportDirectory, summaryName + '-summary.json');
    fs.rmSync(summaryPath, { force: true });
    const environment = {
      ...process.env,
      BASE_URL: 'http://127.0.0.1:' + proxyPort,
      D04_UPSTREAM_URL: targetUrl,
      D04_CONTROLLED_DELAY_MS: String(delayMs),
      TARGET_ENV: 'local',
      TARGET_ID: 'realworld-local-via-controlled-loopback-proxy',
      TARGET_COMMIT: targetCommit,
      FRAMEWORK_COMMIT: frameworkCommit,
      K6_VERSION: expectedK6Version,
      RUNNER_CLASS: runnerClass,
      TEST_PROFILE: 'd04-15rps-15s',
      SUMMARY_NAME: summaryName,
      WORKLOAD_MODE: 'request-rate',
      REQUESTS_PER_SECOND: '15',
      MAX_VUS: '30',
      WARMUP_SECONDS: '5',
      MEASUREMENT_SECONDS: '15',
      MINIMUM_ACHIEVED_FRACTION: '0.98',
    };
    currentStage = 'running k6 ' + condition + ' sample ' + repetition;
    const result = spawnCaptured(k6Binary, ['run', '--quiet', 'dist/load/request-rate-load.js'], {
      env: environment,
    });
    const stdout = summaryName + '-stdout.log';
    const stderr = summaryName + '-stderr.log';
    fs.writeFileSync(path.join(reportDirectory, stdout), result.stdout ?? '');
    fs.writeFileSync(path.join(reportDirectory, stderr), result.stderr ?? '');
    if (!fs.existsSync(summaryPath)) {
      throw new Error(
        summaryName + ' did not write its native summary (exit ' + result.status + ')',
      );
    }
    results.push({
      condition,
      repetition,
      order: index + 1,
      delayMs: delay,
      summary: path.basename(summaryPath),
      stdout,
      stderr,
      exitCode: result.status,
      signal: result.signal,
    });
    console.log(condition + ' sample ' + repetition + ': k6 exit ' + result.status);
  }

  const manifest = {
    schemaVersion: 1,
    experiment: 'D04 healthy versus controlled latency regression',
    createdAt: new Date().toISOString(),
    target: {
      id: 'realworld-local-via-controlled-loopback-proxy',
      upstreamUrl: targetUrl,
      upstreamCommit: targetCommit,
      condition:
        'same pinned target in both groups; degraded group adds a fixed proxy response delay',
    },
    intervention: { type: 'fixed response delay after upstream response', delayMs },
    tool: { k6Version: expectedK6Version, frameworkCommit },
    runner: {
      class: runnerClass,
      nodeVersion: process.version,
      availableParallelism: os.availableParallelism(),
      reportedMemoryBytes: os.totalmem(),
      cgroupCpuMax: cgroupValue('cpu.max'),
      cgroupMemoryMaxBytes: cgroupValue('memory.max'),
      topology:
        'target, reverse proxy, and load generator are colocated on one GitHub-hosted runner',
    },
    workload: {
      profile: 'single-request-arrival-v2',
      requestsPerSecond: 15,
      maxVus: 30,
      warmupSeconds: 5,
      measurementSeconds: 15,
      minimumAchievedFraction: 0.98,
      repetitionsPerCondition: 3,
      endpointMix: '80% GET /articles?limit=10&offset=0; 20% GET /tags',
    },
    order,
    results,
  };
  fs.writeFileSync(
    path.join(reportDirectory, 'd04-experiment.json'),
    JSON.stringify(manifest, null, 2) + '\n',
  );
  const aggregate = spawnCaptured(
    process.execPath,
    [
      path.join(__dirname, 'aggregate-baseline.cjs'),
      ...results
        .filter((result) => result.condition === 'healthy')
        .map((result) => path.join(reportDirectory, result.summary)),
    ],
    {
      env: {
        ...process.env,
        BASELINE_OUTPUT: path.join(reportDirectory, 'd04-healthy-median.json'),
        TARGET_COMMIT: targetCommit,
        TARGET_ID: 'realworld-local-via-controlled-loopback-proxy',
        FRAMEWORK_COMMIT: frameworkCommit,
        K6_VERSION: expectedK6Version,
        RUNNER_CLASS: runnerClass,
        WORKLOAD_NAME: 'd04-15rps-15s',
      },
    },
  );
  fs.writeFileSync(
    path.join(reportDirectory, 'd04-aggregate.log'),
    (aggregate.stdout ?? '') + (aggregate.stderr ?? ''),
  );
  if (aggregate.status !== 0) {
    throw new Error('Healthy-run aggregation failed: ' + aggregate.stderr);
  }
}

run()
  .catch((error) => {
    console.error('D04 failed during ' + currentStage);
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    proxy.kill('SIGTERM');
    proxyLog.end();
  });
