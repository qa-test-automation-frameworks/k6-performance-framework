'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  cgroupCpuPercent,
  cgroupDirectories,
  hostCpuPercent,
  memoryExceeded,
  parseCpuMax,
  parseCpuSet,
  parseCpuStat,
  parseHostCpu,
  parseMeminfo,
  resolveResources,
  runMonitor,
  updateThrottleStreak,
} = require('../perf04-runner-monitor.cjs');

test('parses host allocations and cgroup CPU controls', () => {
  assert.equal(parseCpuMax('250000 100000'), 2.5);
  assert.equal(parseCpuMax('max 100000'), null);
  assert.equal(parseCpuMax('0 100000'), null);
  assert.equal(parseCpuSet('0-3,6,8-9'), 7);
  assert.equal(parseCpuSet('bad'), null);
  assert.deepEqual(parseMeminfo('MemTotal: 16384 kB\nMemAvailable: 4096 kB'), {
    totalBytes: 16 * 1024 * 1024,
    usedBytes: 12 * 1024 * 1024,
  });
  assert.deepEqual(
    parseCpuStat('nr_periods 10\nnr_throttled 2\nthrottled_usec 900\nusage_usec 5000'),
    {
      throttledPeriods: 2,
      throttledUsec: 900,
      usageUsec: 5000,
    },
  );
});

test('computes CPU utilization from monotonic host counters', () => {
  assert.deepEqual(parseHostCpu('cpu  100 0 50 800 10 0 0 0'), { total: 960, idle: 810 });
  assert.equal(hostCpuPercent({ total: 100, idle: 80 }, { total: 200, idle: 150 }), 30);
  assert.equal(cgroupCpuPercent({ usageUsec: 1000 }, { usageUsec: 51000 }, 1000, 2), 2.5);
  assert.equal(hostCpuPercent(null, { total: 200, idle: 150 }), null);
});

test('uses the strictest visible cgroup allocation and records host fallbacks', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perf04-cgroup-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const procRoot = path.join(root, 'proc');
  const cgroupRoot = path.join(root, 'cgroup');
  const leaf = path.join(cgroupRoot, 'runner', 'job');
  fs.mkdirSync(path.join(procRoot, 'self'), { recursive: true });
  fs.mkdirSync(leaf, { recursive: true });
  fs.writeFileSync(path.join(procRoot, 'self/cgroup'), '0::/runner/job\n');
  fs.writeFileSync(path.join(procRoot, 'meminfo'), 'MemTotal: 100000 kB\nMemAvailable: 60000 kB\n');
  fs.writeFileSync(path.join(cgroupRoot, 'memory.max'), '90000000');
  fs.writeFileSync(path.join(cgroupRoot, 'memory.current'), '40000000');
  fs.writeFileSync(path.join(cgroupRoot, 'cpu.max'), '400000 100000');
  fs.writeFileSync(
    path.join(cgroupRoot, 'cpu.stat'),
    'usage_usec 500000\nnr_periods 100\nnr_throttled 2\nthrottled_usec 3000',
  );
  fs.writeFileSync(path.join(leaf, 'memory.max'), '80000000');
  fs.writeFileSync(path.join(leaf, 'memory.current'), '50000000');
  fs.writeFileSync(path.join(leaf, 'cpu.max'), '200000 100000');
  fs.writeFileSync(
    path.join(leaf, 'cpu.stat'),
    'usage_usec 250000\nnr_periods 80\nnr_throttled 4\nthrottled_usec 8000',
  );

  const resolved = resolveResources({ procRoot, cgroupRoot, hostCpuCount: 8 });
  assert.equal(resolved.cpuLimitCores, 2);
  assert.equal(resolved.cpuLimitSource, 'cgroup-quota');
  assert.equal(resolved.memoryLimitBytes, 80000000);
  assert.equal(resolved.memoryUsageFile, path.join(leaf, 'memory.current'));
  assert.equal(resolved.throttleFile, path.join(leaf, 'cpu.stat'));
  assert.equal(resolved.cpuUsageAvailable, true);
  assert.equal(resolved.resourceStatus, 'observed');
});

test('conservatively detects resource stop conditions and throttle streaks', () => {
  assert.equal(memoryExceeded(90, 100), true);
  assert.equal(memoryExceeded(89, 100), false);
  assert.equal(memoryExceeded(null, 100), false);
  const previous = { throttledPeriods: 12, throttledUsec: 1000 };
  const throttled = updateThrottleStreak(
    previous,
    { throttledPeriods: 13, throttledUsec: 1500 },
    29,
  );
  assert.deepEqual(throttled, { streak: 30, deltaPeriods: 1, deltaUsec: 500 });
  assert.deepEqual(
    updateThrottleStreak(previous, { throttledPeriods: 12, throttledUsec: 1000 }, 29),
    { streak: 0, deltaPeriods: 0, deltaUsec: 0 },
  );
});

test('rejects cgroup traversal and marks missing resource counters inconclusive', (t) => {
  assert.deepEqual(cgroupDirectories('0::/../../etc\n', '/tmp/cgroup'), []);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perf04-unknown-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const procRoot = path.join(root, 'proc');
  const cgroupRoot = path.join(root, 'cgroup');
  fs.mkdirSync(path.join(procRoot, 'self'), { recursive: true });
  fs.mkdirSync(cgroupRoot, { recursive: true });
  fs.writeFileSync(path.join(procRoot, 'self/cgroup'), '0::/\n');
  fs.writeFileSync(path.join(procRoot, 'meminfo'), 'MemTotal: 100000 kB\nMemAvailable: 50000 kB\n');
  const resolved = resolveResources({ procRoot, cgroupRoot, hostCpuCount: 4 });
  assert.equal(resolved.cpuLimitCores, 4);
  assert.equal(resolved.memoryLimitBytes, 100000 * 1024);
  assert.equal(resolved.resourceStatus, 'inconclusive');
});

test('writes a bounded runner envelope while the load is active', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'perf04-monitor-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stateDirectory = path.join(root, 'state');
  const csv = path.join(root, 'reports', 'runner.csv');
  const summary = path.join(root, 'reports', 'runner.json');
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.writeFileSync(path.join(stateDirectory, 'load-started-at.txt'), new Date().toISOString());
  const finish = setTimeout(() => {
    fs.writeFileSync(path.join(stateDirectory, 'load-finished'), 'done');
  }, 500);
  const status = await runMonitor({
    PERF04_STATE_DIR: stateDirectory,
    PERF04_RESOURCE_CSV: csv,
    PERF04_RESOURCE_JSON: summary,
    GITHUB_RUN_ID: '123',
    GITHUB_RUN_ATTEMPT: '1',
    GITHUB_SHA: '0123456789abcdef0123456789abcdef01234567',
    GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_REPOSITORY: 'qa-test-automation-frameworks/k6-performance-framework',
    TARGET_COMMIT: 'c8c66858a436a6e07f445fffe2253a65ff6dcb58',
    TARGET_ID: 'realworld-local',
    K6_VERSION: '2.0.0',
    RUNNER_CLASS: 'github-hosted',
    RUNNER_ARCH: 'X64',
    PERF04_NPM_CACHE_HIT: 'false',
  });
  clearTimeout(finish);
  assert.equal(status, 0);
  const lines = fs.readFileSync(csv, 'utf8').trim().split('\n');
  assert.equal(lines[0].startsWith('timestamp_utc,cpu_utilization_percent,'), true);
  assert.equal(lines.length >= 2, true);
  const result = JSON.parse(fs.readFileSync(summary, 'utf8'));
  assert.equal(result.runId, '123');
  assert.equal(result.targetSha, 'c8c66858a436a6e07f445fffe2253a65ff6dcb58');
  assert.equal(typeof result.status, 'string');
  assert.equal(typeof result.endedAt, 'string');
});

test('keeps the main load to one full-profile run and propagates comparator failures', () => {
  const workflow = fs.readFileSync(
    path.join(__dirname, '../../.github/workflows/main-load.yml'),
    'utf8',
  );
  assert.equal([...workflow.matchAll(/k6 run dist\/load\/articles-load\.js/g)].length, 1);
  assert.match(workflow, /set -o pipefail\s+test -f baseline\/load-summary\.json/);
  assert.match(workflow, /sample_order:/);
  assert.match(workflow, /PERF04_SAMPLE_ORDER/);
});
