const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const { tsLoader } = require('./helpers/ts-loader.cjs');
function bridge(fetch, env = {}) {
  const load = tsLoader({ fetch, process: { env: { NODE_ENV: 'test', API_BACKEND_URL: 'http://localhost:3010/api', FRONTEND_ORIGIN: 'https://careops.example.test', TRUSTED_EDGE_ENABLED: 'true', TRUSTED_EDGE_SECRET: 'edge-secret-for-test-at-least-32-bytes', BFF_PROXY_SECRET: 'bff-signing-secret-for-test-at-least-32-bytes', ...env } } });
  const route = load('src/app/api/[...path]/route.ts');
  return (endpoint, { method = 'GET', body, headers = {}, cookie = 'careops_session=current-token', omitOrigin = false, captcha = true } = {}) => {
    if (endpoint === 'auth/login' && captcha) {
      const token = load('src/lib/captcha.ts').captchaStore.issue('AB2345', '203.0.113.1');
      cookie += `; careops_captcha=${token}`;
      body = { ...body, captcha: 'AB2345' };
    }
    const url = `https://careops.example.test/api/${endpoint}`;
    return route[method](new NextRequest(url, { method, headers: { ...(!omitOrigin ? { Origin: 'https://careops.example.test' } : {}), 'X-CareOps-Edge-Key': 'edge-secret-for-test-at-least-32-bytes', 'X-CareOps-Client-IP': '203.0.113.1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body !== undefined ? JSON.stringify(body) : undefined }), { params: Promise.resolve({ path: endpoint.split('?')[0].split('/') }) });
  };
}

test('login rejects missing or incorrect CAPTCHA without sending credentials upstream', async () => {
  let calls = 0;
  const request = bridge(() => { calls++; throw new Error('Must not forward'); });
  const response = await request('auth/login', { method: 'POST', body: { email: 'a@example.test', password: 'password' }, captcha: false });
  assert.equal(response.status, 400);
  assert.match((await response.json()).message, /CAPTCHA/);
  assert.equal(calls, 0);
});

test('valid CAPTCHA is removed before forwarding the backend DTO', async () => {
  const request = bridge(async (_url, options) => {
    assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)), { email: 'a@example.test', password: 'password', userAgent: '' });
    return Response.json({ message: 'OTP sent' });
  });
  assert.equal((await request('auth/login', { method: 'POST', body: { email: 'a@example.test', password: 'password' } })).status, 200);
});
test('OTP success keeps both tokens out of browser JSON and sets an HttpOnly session', async () => {
  const request = bridge(async (url, options) => { assert.equal(String(url), 'http://localhost:3010/api/auth/verify-login-otp'); assert.equal(options.headers.Authorization, undefined); return Response.json({ accessToken: 'private-access', refreshToken: 'private-refresh', user: { id: 1, role: 'admin' } }, { headers: { 'X-CareOps-Backend': 'nest-v1' } }); }, { NODE_ENV: 'production' });
  const response = await request('auth/verify-login-otp', { method: 'POST', body: { email: 'a@example.test', otp: '123456' } });
  const payload = await response.json(); assert.equal(payload.user.id, 1); assert.equal(payload.accessToken, undefined); assert.equal(payload.refreshToken, undefined);
  const cookies = response.headers.getSetCookie().join(';'); assert.match(cookies, /careops_session=private-access/); assert.match(cookies, /HttpOnly/i); assert.match(cookies, /Secure/); assert.match(cookies, /SameSite=lax/i); assert.match(cookies, /Max-Age=900/);
});
test('protected calls forward only the HttpOnly session token and preserve query strings', async () => {
  const request = bridge(async (url, options) => { assert.equal(String(url), 'http://localhost:3010/api/kpi/ranking?period=month'); assert.equal(options.headers.Authorization, 'Bearer current-token'); return Response.json([]); });
  assert.equal((await request('kpi/ranking?period=month', { headers: { Authorization: 'Bearer attacker-controlled' } })).status, 200);
});
test('missing session rejects protected calls without contacting the backend', async () => {
  const response = await bridge(() => { throw new Error('Must not forward'); })('users', { cookie: '' }); assert.equal(response.status, 401);
});

test('refresh-cookie-only reload renews first and keeps both tokens private', async () => {
  const calls = [];
  const request = bridge(async (url, options) => {
    calls.push(String(url));
    if (String(url).endsWith('/auth/refresh')) {
      assert.equal(options.method, 'POST');
      assert.deepEqual(JSON.parse(options.body), { refreshToken: 'private-refresh' });
      return Response.json({ accessToken: 'renewed-access', refreshToken: 'rotated-refresh', user: { id: 2 } });
    }
    assert.equal(options.headers.Authorization, 'Bearer renewed-access');
    return Response.json({ id: 2, role: 'manager' });
  });
  const response = await request('auth/me', { cookie: 'careops_refresh=private-refresh' });
  assert.equal(response.status, 200); assert.equal(calls.length, 2);
  assert.equal((await response.json()).role, 'manager');
  const cookies = response.headers.getSetCookie().join(';');
  assert.match(cookies, /careops_session=renewed-access/); assert.match(cookies, /careops_refresh=rotated-refresh/); assert.match(cookies, /HttpOnly/);
});

test('protected writes renew before execution and are forwarded exactly once', async () => {
  let writes = 0;
  const request = bridge(async (url, options) => {
    if (String(url).endsWith('/auth/refresh')) return Response.json({ accessToken: 'renewed', refreshToken: 'next', user: { id: 2 } });
    writes++; assert.equal(options.method, 'PATCH'); assert.deepEqual(JSON.parse(new TextDecoder().decode(options.body)), { name: 'Updated' });
    return Response.json({ id: 2 });
  });
  assert.equal((await request('users/2', { method: 'PATCH', cookie: 'careops_refresh=private-refresh', body: { name: 'Updated' } })).status, 200);
  assert.equal(writes, 1);
});

test('explicit renewal uses only the HttpOnly refresh cookie, never a browser token', async () => {
  const request = bridge(async (url, options) => {
    assert.match(String(url), /auth\/refresh$/); assert.deepEqual(JSON.parse(options.body), { refreshToken: 'cookie-token' });
    return Response.json({ accessToken: 'private-access', refreshToken: 'private-next', user: { id: 2 } });
  });
  const response = await request('auth/refresh', { method: 'POST', body: { refreshToken: 'attacker-token' }, cookie: 'careops_refresh=cookie-token' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { user: { id: 2 } });
});

test('expired refresh clears both cookies while temporary failures preserve them', async () => {
  for (const status of [401, 429, 503]) {
    const response = await bridge(async () => Response.json({}, { status, headers: { 'Retry-After': '20' } }))('auth/refresh', { method: 'POST', body: {}, cookie: 'careops_refresh=private-refresh' });
    assert.equal(response.status, status);
    if (status === 401) { assert.match(response.headers.getSetCookie().join(';'), /careops_refresh=;/); assert.match(response.headers.getSetCookie().join(';'), /careops_session=;/); }
    else assert.equal(response.headers.getSetCookie().length, 0);
  }
});

test('logout revokes the backend session and clears both cookies', async () => {
  const request = bridge(async (url, options) => { assert.match(String(url), /auth\/logout$/); assert.deepEqual(JSON.parse(options.body), { refreshToken: 'private-refresh' }); return Response.json({}); });
  const response = await request('auth/logout', { method: 'POST', body: {}, cookie: 'careops_refresh=private-refresh' });
  assert.equal(response.status, 200); assert.match(response.headers.getSetCookie().join(';'), /careops_refresh=;/);
});

test('OTP opt-in stores remembered-device secret only in an HttpOnly cookie with a fixed 30-day cap', async () => {
  const response = await bridge(async () => Response.json({ accessToken: 'access', refreshToken: 'refresh', deviceToken: 'device-secret', deviceExpiresAt: Date.now() + 90 * 86400000, user: { id: 2 } }))('auth/verify-login-otp', { method: 'POST', body: { otp: '123456', rememberDevice: true } });
  const cookies = response.headers.getSetCookie().join(';'); assert.match(cookies, /careops_device=device-secret/); assert.match(cookies, /Max-Age=2592000/); assert.match(cookies, /HttpOnly/);
  assert.deepEqual(await response.json(), { user: { id: 2 } });
});

test('password login on a remembered device authenticates without exposing tokens or forwarding browser device claims', async () => {
  const response = await bridge(async (_url, options) => {
    const fields = JSON.parse(new TextDecoder().decode(options.body));
    assert.equal(fields.deviceToken, 'real-cookie'); assert.equal(fields.userAgent, 'real-browser'); assert.equal(fields.captcha, undefined);
    return Response.json({ accessToken: 'access', refreshToken: 'refresh', deviceToken: 'rotated-device', deviceExpiresAt: Date.now() + 86400000, user: { id: 2 } });
  })('auth/login', { method: 'POST', body: { email: 'a@example.test', password: 'password', deviceToken: 'forged', userAgent: 'forged', rememberDevice: true }, headers: { 'User-Agent': 'real-browser' }, cookie: 'careops_device=real-cookie' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { user: { id: 2 }, authenticated: true });
});

test('device-only reload restores a session using the verified cookie and marks restoration without secrets', async () => {
  const request = bridge(async (url, options) => {
    if (String(url).endsWith('/auth/resume-device')) { assert.deepEqual(JSON.parse(options.body), { deviceToken: 'device-cookie', userAgent: 'browser' }); return Response.json({ accessToken: 'access', refreshToken: 'refresh', deviceToken: 'rotated', deviceExpiresAt: Date.now() + 86400000, user: { id: 2 } }); }
    assert.equal(options.headers.Authorization, 'Bearer access'); return Response.json({ id: 2, email: 'a@example.test', role: 'manager' });
  });
  const response = await request('auth/me', { headers: { 'User-Agent': 'browser' }, cookie: 'careops_device=device-cookie' });
  assert.equal(response.status, 200); assert.equal((await response.json()).sessionRestored, true); assert.match(response.headers.getSetCookie().join(';'), /careops_device=rotated/);
});

test('logout disables remembered entry even without a refresh cookie but preserves OTP trust cookie', async () => {
  const response = await bridge(async (url, options) => { assert.match(String(url), /auth\/logout$/); assert.deepEqual(JSON.parse(options.body), { deviceToken: 'device-cookie', userAgent: '' }); return Response.json({}); })('auth/logout', { method: 'POST', body: {}, cookie: 'careops_device=device-cookie' });
  assert.equal(response.status, 200); assert.doesNotMatch(response.headers.getSetCookie().join(';'), /careops_device=;/);
});

test('idle session ending preserves automatic remembered entry; forgetting revokes and removes it', async () => {
  const request = bridge(async (url, options) => {
    if (String(url).endsWith('/auth/end-session')) assert.deepEqual(JSON.parse(options.body), { refreshToken: 'refresh' });
    else { assert.match(String(url), /auth\/forget-device$/); assert.equal(JSON.parse(options.body).deviceToken, 'device'); }
    return Response.json({});
  });
  const ended = await request('auth/end-session', { method: 'POST', body: {}, cookie: 'careops_refresh=refresh; careops_device=device' });
  assert.equal(ended.status, 200); assert.doesNotMatch(ended.headers.getSetCookie().join(';'), /careops_device=;/);
  const forgotten = await request('auth/forget-device', { method: 'POST', body: {}, cookie: 'careops_refresh=refresh; careops_device=device' });
  assert.equal(forgotten.status, 200); assert.match(forgotten.headers.getSetCookie().join(';'), /careops_device=;/);
});

test('device status exposes only state and expiry, never account or device secrets', async () => {
  const response = await bridge(async () => Response.json({ remembered: true, autoLogin: false, expiresAt: 2000000, deviceToken: 'secret', email: 'private@example.test' }))('auth/device-status', { method: 'POST', body: {}, cookie: 'careops_device=device' });
  assert.deepEqual(await response.json(), { remembered: true, autoLogin: false, expiresAt: 2000000 });
});
test('protected 401 deletes the session; incorrect public login does not', async () => {
  const request = bridge(async () => Response.json({ message: 'Invalid' }, { status: 401 }));
  assert.match((await request('auth/me')).headers.getSetCookie().join(';'), /careops_session=;/);
  assert.equal((await request('auth/login', { method: 'POST', body: {} })).headers.getSetCookie().length, 0);
});
test('write requests reject cross-site origins and non-JSON forms', async () => {
  const request = bridge(() => { throw new Error('Must not forward'); });
  assert.equal((await request('users', { method: 'POST', body: {}, headers: { Origin: 'https://evil.example.test' } })).status, 403);
  assert.equal((await request('users', { method: 'POST', body: {}, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('users', { method: 'POST', body: {}, omitOrigin: true })).status, 403);
});

test('proxy rejection codes distinguish wrong access address from account permissions', async () => {
  const request = bridge(() => { throw new Error('Must not forward'); });
  const origin = await request('auth/login', { method: 'POST', body: {}, headers: { Origin: 'http://localhost:3000' } });
  assert.equal(origin.status, 403);
  assert.equal((await origin.json()).code, 'INVALID_REQUEST_ORIGIN');
  const edge = await request('auth/login', { method: 'POST', body: {}, headers: { 'X-CareOps-Edge-Key': 'wrong' } });
  assert.equal(edge.status, 403);
  assert.equal((await edge.json()).code, 'UNTRUSTED_GATEWAY');
});

test('production rejects a legacy or mistaken backend lacking the Nest marker', async () => {
  assert.equal((await bridge(async () => Response.json({ message: 'Legacy service' }), { NODE_ENV: 'production' })('auth/login', { method: 'POST', body: {} })).status, 502);
});
test('429 forwards Retry-After without attempting a retry', async () => {
  let calls = 0; const request = bridge(async () => { calls++; return new Response('Too many requests', { status: 429, headers: { 'Retry-After': '45' } }); });
  const response = await request('auth/login', { method: 'POST', body: {} }); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '45'); assert.equal(calls, 1);
});
test('logout clears cookies locally without requiring a backend logout API', async () => {
  const response = await bridge(() => { throw new Error('Must not forward'); })('auth/logout', { method: 'POST', body: {} }); assert.equal(response.status, 200); assert.match(response.headers.getSetCookie().join(';'), /Max-Age=0/);
});
test('password reset clears the previous session', async () => {
  const response = await bridge(async () => Response.json({ message: 'Updated' }))('auth/reset-password', { method: 'POST', body: {} }); assert.equal(response.status, 200); assert.match(response.headers.getSetCookie().join(';'), /careops_session=;/);
});
test('proxy rejects unsupported paths and oversized bodies before forwarding', async () => {
  const request = bridge(() => { throw new Error('Must not forward'); });
  assert.equal((await request('unknown/users')).status, 404);
  assert.equal((await request('users', { method: 'POST', body: { name: 'x'.repeat(65536) } })).status, 413);
});
test('backend URLs with or without api suffix work and remote production HTTP is rejected', async () => {
  for (const base of ['https://backend.example.test', 'https://backend.example.test/api/']) {
    const response = await bridge(async url => { assert.equal(String(url), 'https://backend.example.test/api/users'); return Response.json([]); }, { API_BACKEND_URL: base })('users'); assert.equal(response.status, 200);
  }
  assert.equal((await bridge(() => { throw new Error('Must not forward'); }, { NODE_ENV: 'production', API_BACKEND_URL: 'http://remote.example.test' })('users')).status, 503);
});
