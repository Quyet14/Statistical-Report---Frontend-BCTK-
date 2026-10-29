const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const { tsLoader } = require('./helpers/ts-loader.cjs');
const { NextRequest } = require('next/server');
function moduleFrom(file, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, process: { env: { NODE_ENV: 'test' } }, ...globals });
  return exports;
}
test('stale cookies never prevent opening login or password recovery', () => {
  const { proxy } = tsLoader()('src/proxy.ts');
  for (const pathname of ['/login', '/forgot-password']) assert.equal(proxy(new NextRequest(`http://example.test${pathname}`, { headers: { Cookie: 'accessToken=old' } })).status, 200);
});
test('legacy browser-readable token cookies no longer unlock protected routes', () => {
  const { proxy } = tsLoader()('src/proxy.ts');
  assert.equal(proxy(new NextRequest('http://example.test/employees', { headers: { Cookie: 'accessToken=legacy' } })).status, 307);
  assert.equal(proxy(new NextRequest('http://example.test/employees', { headers: { Cookie: 'careops_session=current' } })).status, 200);
  assert.equal(proxy(new NextRequest('http://example.test/employees', { headers: { Cookie: 'careops_refresh=refresh-only' } })).status, 200);
  assert.equal(proxy(new NextRequest('http://example.test/employees', { headers: { Cookie: 'careops_device=device-only' } })).status, 200);
});
test('development assets allow the LAN address used for sign in', () => {
  const config = moduleFrom('next.config.ts').default; assert.ok(config.allowedDevOrigins.includes('192.168.100.6'));
});

test('LAN development login redirects to the configured HTTPS gateway only in development', async () => {
  for (const mode of ['development', 'production']) {
    const config = moduleFrom('next.config.ts', { URL, process: { env: { NODE_ENV: mode, DEV_LOGIN_GATEWAY_ORIGIN: 'https://192.168.81.178:3443' } } }).default;
    const redirects = await config.redirects();
    assert.equal(redirects.length, mode === 'development' ? 3 : 0);
    if (mode === 'development') {
      const login = redirects.find(rule => rule.source === '/login');
      assert.equal(login.destination, 'https://192.168.81.178:3443/login');
      assert.equal(login.permanent, false);
      assert.equal(redirects.some(rule => rule.source.startsWith('/api')), false);
    }
  }
});

test('LAN gateway redirect rejects plaintext and credential-bearing targets', async () => {
  for (const gateway of ['http://192.168.81.178:3000', 'https://user:secret@example.test', 'https://example.test/other']) {
    const config = moduleFrom('next.config.ts', { URL, process: { env: { NODE_ENV: 'development', DEV_LOGIN_GATEWAY_ORIGIN: gateway } } }).default;
    await assert.rejects(config.redirects(), /exact HTTPS origin/);
  }
});
