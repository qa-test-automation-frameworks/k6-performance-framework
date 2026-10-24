'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

function configuration(env = process.env) {
  if (env.ENABLE_LATENCY_PROXY !== '1') throw new Error('ENABLE_LATENCY_PROXY=1 is required');
  const upstream = new URL(env.UPSTREAM || 'http://127.0.0.1:3000');
  const port = Number(env.PROXY_PORT || 3001);
  const delayMs = Number(env.DELAY_MS || 0);
  const pathRegex = env.DELAY_PATH_REGEX || '^/api/articles(\\?|$)';
  if (
    upstream.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname) ||
    upstream.username ||
    upstream.password ||
    upstream.pathname !== '/' ||
    upstream.search ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !Number.isFinite(delayMs) ||
    delayMs < 0 ||
    delayMs > 1000
  )
    throw new Error(
      'Proxy requires an HTTP loopback origin, a valid port, and DELAY_MS from 0 to 1000',
    );
  return { upstream, port, delayMs, pathRegex, matcher: new RegExp(pathRegex) };
}

function createProxy(config) {
  const stats = {
    delayMs: config.delayMs,
    pathRegex: config.pathRegex,
    matched: 0,
    delayed: 0,
    forwarded: 0,
  };
  const server = http.createServer((request, response) => {
    // Keep the configured origin even for absolute-form request targets.
    const requestPath = request.url.startsWith('/') ? request.url : '/';
    config.matcher.lastIndex = 0;
    const matches = config.matcher.test(requestPath);
    if (matches) stats.matched++;
    const forward = () => {
      stats.forwarded++;
      const upstreamRequest = http.request(
        {
          hostname: config.upstream.hostname.replace(/^\[|\]$/g, ''),
          port: config.upstream.port || 80,
          method: request.method,
          path: requestPath,
          headers: { ...request.headers, host: config.upstream.host },
        },
        (upstreamResponse) => {
          response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
          upstreamResponse.pipe(response);
        },
      );
      upstreamRequest.on('error', () => {
        if (!response.headersSent) response.writeHead(502);
        response.end('loopback upstream unavailable');
      });
      request.on('aborted', () => upstreamRequest.destroy());
      response.on('close', () => upstreamRequest.destroy());
      request.pipe(upstreamRequest);
    };
    if (matches && config.delayMs > 0) {
      stats.delayed++;
      setTimeout(forward, config.delayMs);
    } else forward();
  });
  return { server, stats };
}

if (require.main === module) {
  const config = configuration();
  const { server, stats } = createProxy(config);
  server.listen(config.port, '127.0.0.1', () =>
    console.log(`Latency proxy ready on ${config.port}`),
  );
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, () => {
      const output = process.env.PROXY_STATS_FILE || 'reports/latency-proxy-stats.json';
      fs.mkdirSync(path.dirname(output), { recursive: true });
      fs.writeFileSync(output, JSON.stringify(stats, null, 2) + '\n');
      server.close(() => process.exit(0));
      server.closeIdleConnections();
    });
}

module.exports = { configuration, createProxy };
