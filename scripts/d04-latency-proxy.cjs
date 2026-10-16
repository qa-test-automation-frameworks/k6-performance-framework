const http = require('node:http');

const upstreamValue = process.env.D04_UPSTREAM_URL;
const port = Number(process.env.D04_PROXY_PORT ?? '3130');
if (!upstreamValue) throw new Error('D04_UPSTREAM_URL is required');
const upstream = new URL(upstreamValue);
if (
  upstream.protocol !== 'http:' ||
  !['127.0.0.1', 'localhost', '::1'].includes(upstream.hostname) ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535
) {
  throw new Error('D04 proxy accepts only an HTTP loopback upstream and valid local port');
}

let responseDelayMs = 0;
const server = http.createServer(async (request, response) => {
  if (request.url === '/__d04/health' && request.method === 'GET') {
    response.writeHead(200, { 'content-type': 'application/json' }).end('{"ready":true}');
    return;
  }
  if (request.url === '/__d04/control' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) body += chunk;
    let delay;
    try {
      delay = JSON.parse(body).delayMs;
    } catch {
      response.writeHead(400).end('invalid JSON');
      return;
    }
    if (!Number.isInteger(delay) || delay < 0 || delay > 500) {
      response.writeHead(400).end('delayMs must be an integer from 0 to 500');
      return;
    }
    responseDelayMs = delay;
    response
      .writeHead(200, { 'content-type': 'application/json' })
      .end(JSON.stringify({ responseDelayMs }));
    return;
  }

  if (request.method !== 'GET' || !request.url || !/^\/(articles|tags)(\?|$)/.test(request.url)) {
    response.writeHead(404).end('route not included in D04 probe');
    return;
  }

  const target = new URL(upstream.pathname.replace(/\/$/, '') + request.url, upstream);
  try {
    const result = await fetch(target, {
      headers: { 'X-D04-Experiment': 'controlled-latency-study' },
      signal: AbortSignal.timeout(5_000),
    });
    const payload = Buffer.from(await result.arrayBuffer());
    if (responseDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, responseDelayMs));
    }
    response.writeHead(result.status, {
      'content-type': result.headers.get('content-type') ?? 'application/octet-stream',
      'content-length': payload.length,
      'cache-control': 'no-store',
    });
    response.end(payload);
  } catch (error) {
    if (!response.headersSent) response.writeHead(502, { 'content-type': 'text/plain' });
    response.end('D04 upstream error: ' + error.message);
  }
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write('D04 proxy ready at http://127.0.0.1:' + port + '\n');
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
