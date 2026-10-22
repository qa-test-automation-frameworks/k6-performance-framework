'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

function parseCpuSet(value) {
  const cpus = new Set();
  for (const item of String(value ?? '')
    .trim()
    .split(',')) {
    if (!item) continue;
    const match = /^(\d+)(?:-(\d+))?$/.exec(item);
    if (!match) return null;
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (end < start || end - start > 4095) return null;
    for (let cpu = start; cpu <= end; cpu += 1) cpus.add(cpu);
  }
  return cpus.size || null;
}

function parseCpuQuota(value) {
  const [quota, period] = String(value ?? '')
    .trim()
    .split(/\s+/);
  const periodValue = Number(period);
  if (quota === 'max' || !Number.isFinite(periodValue) || periodValue <= 0) return null;
  const quotaValue = Number(quota);
  if (!Number.isFinite(quotaValue) || quotaValue <= 0) return null;
  return quotaValue / periodValue;
}

function parseMeminfo(text) {
  const values = Object.fromEntries(
    String(text ?? '')
      .split(/\r?\n/)
      .map((line) => {
        const match = /^([^:]+):\s+(\d+)\s+kB$/.exec(line);
        return match ? [match[1], Number(match[2]) * 1024] : null;
      })
      .filter(Boolean),
  );
  const total = values.MemTotal;
  const available = values.MemAvailable;
  return {
    totalBytes: Number.isSafeInteger(total) && total > 0 ? total : null,
    usedBytes:
      Number.isSafeInteger(total) && Number.isSafeInteger(available) && available <= total
        ? total - available
        : null,
  };
}

function parseCpuStat(text) {
  const values = Object.fromEntries(
    String(text ?? '')
      .split(/\r?\n/)
      .map((line) => {
        const match = /^(nr_periods|nr_throttled|throttled_usec|usage_usec)\s+(\d+)$/.exec(
          line.trim(),
        );
        return match ? [match[1], Number(match[2])] : null;
      })
      .filter(Boolean),
  );
  return Number.isSafeInteger(values.nr_throttled) && Number.isSafeInteger(values.throttled_usec)
    ? {
        throttledPeriods: values.nr_throttled,
        throttledUsec: values.throttled_usec,
        usageUsec: Number.isSafeInteger(values.usage_usec) ? values.usage_usec : null,
      }
    : null;
}

function parseHostCpu(text) {
  const line = String(text ?? '')
    .split(/\r?\n/)
    .find((item) => item.startsWith('cpu '));
  if (!line) return null;
  const values = line.trim().split(/\s+/).slice(1).map(Number);
  if (values.length < 4 || values.some((value) => !Number.isSafeInteger(value) || value < 0))
    return null;
  const idle = values[3] + (values[4] ?? 0);
  return { total: values.reduce((sum, value) => sum + value, 0), idle };
}

function hostCpuPercent(previous, current) {
  if (!previous || !current) return null;
  const total = current.total - previous.total;
  const idle = current.idle - previous.idle;
  if (total <= 0 || idle < 0 || idle > total) return null;
  return Number((((total - idle) / total) * 100).toFixed(3));
}

function cgroupCpuPercent(previous, current, elapsedMs, allocatedCores) {
  if (
    !previous ||
    !current ||
    !Number.isFinite(previous.usageUsec) ||
    !Number.isFinite(current.usageUsec) ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0 ||
    !Number.isFinite(allocatedCores) ||
    allocatedCores <= 0
  )
    return null;
  const elapsedUsec = elapsedMs * 1000;
  const cpuUsec = current.usageUsec - previous.usageUsec;
  if (cpuUsec < 0) return null;
  return Number(((cpuUsec / (elapsedUsec * allocatedCores)) * 100).toFixed(3));
}

function memoryExceeded(currentBytes, limitBytes, fraction = 0.9) {
  return Number.isFinite(currentBytes) && Number.isFinite(limitBytes) && limitBytes > 0
    ? currentBytes >= limitBytes * fraction
    : false;
}

function updateThrottleStreak(previous, current, streak) {
  if (!previous || !current) return { streak: 0, deltaPeriods: null, deltaUsec: null };
  const deltaPeriods = current.throttledPeriods - previous.throttledPeriods;
  const deltaUsec = current.throttledUsec - previous.throttledUsec;
  if (deltaPeriods < 0 || deltaUsec < 0) return { streak: 0, deltaPeriods: null, deltaUsec: null };
  return {
    streak: deltaPeriods > 0 ? streak + 1 : 0,
    deltaPeriods,
    deltaUsec,
  };
}

function cgroupDirectories(procCgroupText, cgroupRoot) {
  const line = String(procCgroupText ?? '')
    .split(/\r?\n/)
    .find((item) => item.startsWith('0::'));
  if (!line) return [];
  const root = path.resolve(cgroupRoot);
  const relative = line.slice(3).replace(/^\/+/, '');
  let current = path.resolve(root, relative);
  if (current !== root && !current.startsWith(`${root}${path.sep}`)) return [];
  const directories = [];
  while (current === root || current.startsWith(`${root}${path.sep}`)) {
    directories.push(current);
    if (current === root) break;
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return directories;
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch {
    return null;
  }
}

function resolveResources({
  procRoot = '/proc',
  cgroupRoot = '/sys/fs/cgroup',
  hostCpuCount,
} = {}) {
  const directories = cgroupDirectories(readText(path.join(procRoot, 'self/cgroup')), cgroupRoot);
  const memoryLimits = directories
    .map((directory) => ({ directory, value: readText(path.join(directory, 'memory.max')) }))
    .map(({ directory, value }) => ({ directory, limitBytes: Number(value) }))
    .filter(({ limitBytes }) => Number.isSafeInteger(limitBytes) && limitBytes > 0)
    .sort((left, right) => left.limitBytes - right.limitBytes);
  const quotaLimits = directories
    .map((directory) => ({
      directory,
      value: parseCpuQuota(readText(path.join(directory, 'cpu.max'))),
    }))
    .filter(({ value }) => Number.isFinite(value) && value > 0);
  const setLimits = directories
    .map((directory) => ({
      directory,
      value: parseCpuSet(readText(path.join(directory, 'cpuset.cpus.effective'))),
    }))
    .filter(({ value }) => Number.isFinite(value) && value > 0);
  const cpus =
    Number.isSafeInteger(hostCpuCount) && hostCpuCount > 0
      ? hostCpuCount
      : typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
  const cpuCandidates = [
    ...quotaLimits.map((item) => ({ cores: item.value, source: 'cgroup-quota' })),
    ...setLimits.map((item) => ({ cores: item.value, source: 'cgroup-cpuset' })),
  ];
  const cpuLimit = cpuCandidates.length
    ? cpuCandidates.reduce((lowest, item) => (item.cores < lowest.cores ? item : lowest))
    : Number.isFinite(cpus) && cpus > 0
      ? { cores: cpus, source: 'host-allocation' }
      : { cores: null, source: 'unknown' };
  const procMemory = parseMeminfo(readText(path.join(procRoot, 'meminfo')) ?? '');
  const memoryLimit = memoryLimits[0]
    ? {
        bytes: memoryLimits[0].limitBytes,
        source: 'cgroup-limit',
        usageFile: path.join(memoryLimits[0].directory, 'memory.current'),
      }
    : procMemory.totalBytes
      ? { bytes: procMemory.totalBytes, source: 'host-allocation', usageFile: null }
      : { bytes: null, source: 'unknown', usageFile: null };
  const throttleDirectory = directories.find((directory) =>
    parseCpuStat(readText(path.join(directory, 'cpu.stat')) ?? ''),
  );
  const throttleFile = throttleDirectory ? path.join(throttleDirectory, 'cpu.stat') : null;
  const cpuUsageAvailable = throttleFile
    ? Number.isFinite(parseCpuStat(readText(throttleFile) ?? '')?.usageUsec)
    : false;
  return {
    cpuLimitCores: cpuLimit.cores,
    cpuLimitSource: cpuLimit.source,
    cpuUsageFile: throttleFile,
    cpuUsageAvailable,
    memoryLimitBytes: memoryLimit.bytes,
    memoryLimitSource: memoryLimit.source,
    memoryUsageFile: memoryLimit.usageFile,
    throttleFile,
    resourceStatus:
      cpuLimit.cores && memoryLimit.bytes && throttleFile ? 'observed' : 'inconclusive',
    cgroupDirectories: directories,
  };
}

function readMemoryUsage(resources, procRoot = '/proc') {
  if (resources.memoryUsageFile) {
    const value = Number(readText(resources.memoryUsageFile));
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
  }
  const memory = parseMeminfo(readText(path.join(procRoot, 'meminfo')) ?? '');
  return memory.usedBytes;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function appendCsv(file, values) {
  fs.appendFileSync(file, `${values.map(csvCell).join(',')}\n`);
}

function utcNow() {
  return new Date().toISOString();
}

function processExists(pid) {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function workloadPid(file) {
  const pid = Number(readText(file));
  return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
}

async function runMonitor(env = process.env) {
  const output = env.PERF04_RESOURCE_CSV;
  const summaryPath = env.PERF04_RESOURCE_JSON;
  const stateDirectory = env.PERF04_STATE_DIR;
  if (!output || !summaryPath || !stateDirectory)
    throw new Error('PERF-04 monitor paths are required');
  const readyFile = path.join(stateDirectory, 'target-ready');
  const finishedFile = path.join(stateDirectory, 'load-finished');
  const pidFile = path.join(stateDirectory, 'load.pid');
  const stopFile = path.join(stateDirectory, 'stop-reason.txt');
  const resources = resolveResources();
  const startedAt = utcNow();
  const hostImage = `${env.ImageOS ?? 'unknown'}-${env.ImageVersion ?? 'unknown'}`;
  const summary = {
    schemaVersion: 1,
    status: resources.resourceStatus,
    runId: env.GITHUB_RUN_ID ?? null,
    attempt: Number(env.GITHUB_RUN_ATTEMPT ?? 0) || null,
    runUrl:
      env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
        ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
        : null,
    sampleOrder: env.PERF04_SAMPLE_ORDER ?? 'not-designated',
    startedAt,
    endedAt: null,
    workloadStartedAt: null,
    workloadEndedAt: null,
    frameworkSha: env.GITHUB_SHA ?? null,
    targetSha: env.TARGET_COMMIT ?? null,
    targetId: env.TARGET_ID ?? null,
    k6Version: env.K6_VERSION ?? null,
    profile: 'full',
    runnerImage: hostImage,
    runnerClass: env.RUNNER_CLASS ?? 'unknown',
    runnerArch: env.RUNNER_ARCH ?? 'unknown',
    npmCacheHit: env.PERF04_NPM_CACHE_HIT ?? 'unknown',
    cpuLimitCores: resources.cpuLimitCores,
    cpuLimitSource: resources.cpuLimitSource,
    cpuUtilizationSource: resources.cpuUsageAvailable ? 'runner-cgroup' : 'host',
    memoryLimitBytes: resources.memoryLimitBytes,
    memoryLimitSource: resources.memoryLimitSource,
    cpuThrottlingObserved: Boolean(resources.throttleFile),
    cpuPeakPercent: null,
    memoryPeakBytes: null,
    maxConsecutiveThrottledSeconds: 0,
    throttleSeconds: 0,
    throttleWindowSeconds: 0,
    targetHealth: { probes: 0, failures: 0, maxConsecutiveFailures: 0 },
    stopReason: null,
  };

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.mkdirSync(stateDirectory, { recursive: true });
  fs.writeFileSync(
    output,
    'timestamp_utc,cpu_utilization_percent,cpu_throttled_periods_delta,cpu_throttled_usec_delta,memory_current_bytes,memory_limit_bytes,target_health\n',
  );
  writeJson(summaryPath, summary);

  let previousCpu = parseHostCpu(readText('/proc/stat') ?? '');
  let previousThrottle = resources.throttleFile
    ? parseCpuStat(readText(resources.throttleFile) ?? '')
    : null;
  let previousSampleTime = performance.now();
  let throttleStreak = 0;
  let lastTargetHealth = 'not-ready';
  let lastProbeResult = null;
  let probeInFlight = false;
  let consecutiveProbeFailures = 0;
  let nextProbeAt = Date.now();

  const probe = async () => {
    probeInFlight = true;
    const current = await fetch(
      env.PERF04_TARGET_HEALTH_URL ?? 'http://localhost:3000/api/articles?limit=1',
      {
        signal: AbortSignal.timeout(2000),
        headers: { accept: 'application/json' },
      },
    )
      .then((response) => response.ok)
      .catch(() => false);
    lastProbeResult = current;
    probeInFlight = false;
    nextProbeAt = Date.now() + 5000;
  };

  while (!fs.existsSync(finishedFile)) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const sampleTime = performance.now();
    const elapsedMs = sampleTime - previousSampleTime;
    previousSampleTime = sampleTime;
    const timestamp = utcNow();
    const currentCpu = parseHostCpu(readText('/proc/stat') ?? '');
    const currentThrottle = resources.throttleFile
      ? parseCpuStat(readText(resources.throttleFile) ?? '')
      : null;
    const cpuPercent =
      cgroupCpuPercent(previousThrottle, currentThrottle, elapsedMs, resources.cpuLimitCores) ??
      hostCpuPercent(previousCpu, currentCpu);
    previousCpu = currentCpu;
    if (
      cpuPercent !== null &&
      (summary.cpuPeakPercent === null || cpuPercent > summary.cpuPeakPercent)
    ) {
      summary.cpuPeakPercent = cpuPercent;
    }

    const memoryBytes = readMemoryUsage(resources);
    if (
      memoryBytes !== null &&
      (summary.memoryPeakBytes === null || memoryBytes > summary.memoryPeakBytes)
    ) {
      summary.memoryPeakBytes = memoryBytes;
    }
    const throttle = updateThrottleStreak(previousThrottle, currentThrottle, throttleStreak);
    previousThrottle = currentThrottle;
    throttleStreak = throttle.streak;
    if (throttle.deltaPeriods !== null) {
      summary.throttleWindowSeconds += 1;
      summary.throttleSeconds += throttle.deltaPeriods > 0 ? 1 : 0;
      summary.maxConsecutiveThrottledSeconds = Math.max(
        summary.maxConsecutiveThrottledSeconds,
        throttleStreak,
      );
    }
    if (cpuPercent === null || memoryBytes === null || throttle.deltaPeriods === null) {
      summary.status = 'inconclusive';
    }

    if (fs.existsSync(readyFile) && !probeInFlight && Date.now() >= nextProbeAt) void probe();
    if (lastProbeResult !== null) {
      summary.targetHealth.probes += 1;
      if (lastProbeResult) {
        lastTargetHealth = 'healthy';
        consecutiveProbeFailures = 0;
      } else {
        lastTargetHealth = 'unhealthy';
        consecutiveProbeFailures += 1;
        summary.targetHealth.failures += 1;
        summary.targetHealth.maxConsecutiveFailures = Math.max(
          summary.targetHealth.maxConsecutiveFailures,
          consecutiveProbeFailures,
        );
      }
      lastProbeResult = null;
      nextProbeAt = Date.now() + 5000;
    }

    appendCsv(output, [
      timestamp,
      cpuPercent,
      throttle.deltaPeriods,
      throttle.deltaUsec,
      memoryBytes,
      resources.memoryLimitBytes,
      lastTargetHealth,
    ]);
    summary.workloadStartedAt ??= readText(path.join(stateDirectory, 'load-started-at.txt'));
    summary.workloadEndedAt = readText(path.join(stateDirectory, 'load-ended-at.txt')) ?? null;
    writeJson(summaryPath, summary);

    let stopReason = null;
    if (memoryExceeded(memoryBytes, resources.memoryLimitBytes)) {
      stopReason = `memory usage reached at least 90% of the recorded limit (${memoryBytes}/${resources.memoryLimitBytes} bytes)`;
    } else if (resources.throttleFile && throttleStreak >= 30) {
      stopReason = 'CPU throttling increased in 30 consecutive one-second samples';
    } else if (consecutiveProbeFailures >= 2) {
      stopReason = 'target health probe failed twice in a row';
    }
    if (stopReason) {
      summary.stopReason = stopReason;
      summary.endedAt = utcNow();
      writeJson(stopFile, { stoppedAt: summary.endedAt, reason: stopReason });
      const pid = workloadPid(pidFile);
      if (pid && processExists(pid)) {
        try {
          process.kill(pid, 'SIGINT');
        } catch {}
      }
      writeJson(summaryPath, summary);
      return 1;
    }
  }

  summary.endedAt = utcNow();
  summary.workloadStartedAt ??= readText(path.join(stateDirectory, 'load-started-at.txt'));
  summary.workloadEndedAt = readText(path.join(stateDirectory, 'load-ended-at.txt')) ?? null;
  writeJson(summaryPath, summary);
  return 0;
}

if (require.main === module) {
  runMonitor()
    .then((status) => {
      process.exitCode = status;
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.stack : String(error));
      process.exitCode = 2;
    });
}

module.exports = {
  cgroupDirectories,
  cgroupCpuPercent,
  hostCpuPercent,
  memoryExceeded,
  parseCpuMax: parseCpuQuota,
  parseCpuSet,
  parseCpuStat,
  parseHostCpu,
  parseMeminfo,
  resolveResources,
  runMonitor,
  updateThrottleStreak,
};
