'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { once } = require('node:events');
const { configuration, createProxy } = require('../latency-proxy.cjs');
const { deriveTolerance } = require('../derive-tolerance.cjs');

test('proxy requires explicit enablement and a bounded loopback configuration', () => {
  assert.throws(() => configuration({}), /ENABLE_LATENCY_PROXY/);
  for (const UPSTREAM of ['http://example.com', 'https://127.0.0.1', 'http://127.0.0.1.evil.test'])
    assert.throws(() => configuration({ ENABLE_LATENCY_PROXY: '1', UPSTREAM }), /loopback/);
  for (const DELAY_MS of ['1001', '-1', 'NaN', 'Infinity'])
    assert.throws(() => configuration({ ENABLE_LATENCY_PROXY: '1', DELAY_MS }), /DELAY_MS/);
  assert.equal(
    configuration({ ENABLE_LATENCY_PROXY: '1', UPSTREAM: 'http://[::1]:3000' }).port,
    3001,
  );
});

test('proxy streams bodies and delays only the configured path; zero delay passes through', async () => {
  const upstream = http.createServer((request, response) => request.pipe(response));
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  try {
    for (const delayMs of [0, 80]) {
      const { server, stats } = createProxy(
        configuration({
          ENABLE_LATENCY_PROXY: '1',
          UPSTREAM: `http://127.0.0.1:${upstream.address().port}`,
          DELAY_MS: String(delayMs),
        }),
      );
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        for (const endpoint of ['/api/articles?limit=1', '/api/tags', '/api/articles/slug']) {
          const started = performance.now();
          const response = await fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, {
            method: 'POST',
            body: 'streamed body',
          });
          assert.equal(await response.text(), 'streamed body');
          if (delayMs && endpoint.includes('?')) assert.ok(performance.now() - started >= 70);
        }
        assert.equal(stats.matched, 1);
        assert.equal(stats.delayed, delayMs ? 1 : 0);
        assert.equal(stats.forwarded, 3);
      } finally {
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
      }
    }
  } finally {
    upstream.closeAllConnections();
    await new Promise((resolve) => upstream.close(resolve));
  }
});

const sources = [8, 9, 10, 11, 12].map((value) => ({
  summary: { metrics: { http_req_duration: { 'p(95)': value, 'p(99)': value * 2 } } },
}));
test('tolerance derivation follows the measured relative and absolute formulas', () => {
  const result = deriveTolerance(sources);
  assert.equal(result.perMetric['http_req_duration.p(95)'].median, 10);
  assert.ok(Math.abs(result.perMetric['http_req_duration.p(95)'].relative - 0.3) < 1e-12);
  assert.equal(result.perMetric['http_req_duration.p(95)'].absoluteMs, 3);
  assert.equal(result.perMetric['http_req_duration.p(99)'].absoluteMs, 6);
  assert.throws(() => deriveTolerance(sources.slice(0, 4)), /five/);
  assert.throws(
    () => deriveTolerance([...sources.slice(0, 4), { summary: { metrics: {} } }]),
    /Missing/,
  );
});

test('cohort inputs reject insufficient samples, unsafe labels, and a mislabeled arm', () => {
  const { inputs } = require('../calibration-cohort.cjs');
  const base = {
    CALIBRATION_EXPECTED_IMAGE: 'ubuntu24-20261023.334.3',
    CALIBRATION_ARM: 'aa',
    CALIBRATION_SAMPLES: '5',
    CALIBRATION_DELAY_MS: '0',
    CALIBRATION_LABEL: 'calibration',
  };
  assert.equal(inputs(base).samples, 5);
  for (const changes of [
    { CALIBRATION_EXPECTED_IMAGE: '' },
    { CALIBRATION_EXPECTED_IMAGE: 'unbounded' },
    { CALIBRATION_SAMPLES: '4' },
    { CALIBRATION_SAMPLES: 'NaN' },
    { CALIBRATION_LABEL: '../path' },
    { CALIBRATION_DELAY_MS: '5' },
    { CALIBRATION_ARM: 'degraded' },
  ])
    assert.throws(() => inputs({ ...base, ...changes }), /Invalid calibration/);
});

test('image preflight accepts the declared identity and rejects a different or missing image', () => {
  const { verifyRunnerImage } = require('../calibration-cohort.cjs');
  const image = 'ubuntu24-20261023.334.3';
  assert.doesNotThrow(() => verifyRunnerImage(image, image));
  assert.throws(() => verifyRunnerImage(image, 'ubuntu24-20261012.334.1'), /Runner image mismatch/);
  assert.throws(() => verifyRunnerImage(image, undefined), /Runner image mismatch/);
});
