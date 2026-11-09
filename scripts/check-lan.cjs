const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const dotenv = require('dotenv');
const directory = path.resolve(__dirname, '../deploy/.runtime');
const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
const frontend = dotenv.parse(fs.readFileSync(path.join(directory, 'frontend.env')));
const backend = dotenv.parse(fs.readFileSync(path.join(directory, 'backend.env')));
function request(url, method = 'GET') {
  return new Promise(resolve => {
    const client = url.startsWith('https:') ? https : http;
    const pending = client.request(url, {
      method,
      rejectUnauthorized: manifest.certificate !== 'self-signed-LAN-test-only',
      headers: { Origin: manifest.origin, 'Content-Type': 'application/json', 'User-Agent': 'CareOps-LAN-health-check' },
    }, response => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', part => { text += part; });
      response.on('end', () => {
        let body; try { body = JSON.parse(text); } catch { /* HTML login is expected. */ }
        resolve({ status: response.statusCode, ...(typeof body?.ready === 'boolean' ? { ready: body.ready } : {}), ...(typeof body?.remembered === 'boolean' ? { deviceEndpoint: true } : {}) });
      });
    });
    pending.on('error', error => resolve({ error: error.code || 'CONNECTION_FAILED' }));
    pending.setTimeout(10000, () => pending.destroy(new Error('Request timeout')));
    pending.end(method === 'POST' ? '{}' : undefined);
  });
}
(async () => {
  const checks = {
    backend: await request(`http://127.0.0.1:${backend.PORT}/health/ready`),
    login: await request(`${manifest.origin}/login`),
    proxy: await request(`${manifest.origin}/api/auth/device-status`, 'POST'),
  };
  const ready = frontend.FRONTEND_ORIGIN === manifest.origin && Object.values(checks).every(check => check.status === 200);
  console.log(JSON.stringify({ ready, origin: manifest.origin, checks }, null, 2));
  if (!ready) process.exitCode = 1;
})().catch(() => { console.error('LAN health check failed'); process.exitCode = 1; });
