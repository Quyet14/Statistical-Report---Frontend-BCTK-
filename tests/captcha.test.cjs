const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tsLoader } = require('./helpers/ts-loader.cjs');
const { CaptchaStore } = tsLoader()('src/lib/captcha.ts');
test('CAPTCHA endpoint returns a PNG without an answer and binds an HttpOnly cookie', async () => {
  const { NextRequest } = require('next/server');
  const load = tsLoader();
  const { GET } = load('src/app/api/auth/captcha/route.ts');
  const response = await GET(new NextRequest('http://localhost:3000/api/auth/captcha'));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const payload = await response.json();
  assert.deepEqual(Object.keys(payload), ['image']);
  assert.match(payload.image, /^data:image\/png;base64,/);
  const cookie = response.headers.getSetCookie().join(';');
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=strict/i);
  const token = cookie.match(/careops_captcha=([^;]+)/)[1];
  assert.equal(payload.image.includes(token), false);
});
test('cross-site CAPTCHA requests are rejected', async () => {
  const { NextRequest } = require('next/server');
  const { GET } = tsLoader()('src/app/api/auth/captcha/route.ts');
  assert.equal((await GET(new NextRequest('http://localhost:3000/api/auth/captcha', { headers: { 'Sec-Fetch-Site': 'cross-site' } }))).status, 403);
});
test('CAPTCHA accepts one case-insensitive answer and rejects replay', () => {
  const store = new CaptchaStore(); const token = store.issue('AB2345', 'client', undefined, 1000);
  assert.equal(store.consume(token, 'ab2345', 'client', 1001), true);
  assert.equal(store.consume(token, 'AB2345', 'client', 1002), false);
});
test('CAPTCHA rejects expiry, wrong answers, client changes, and refreshed challenges', () => {
  for (const [answer, client, now] of [['AB2345', 'client', 301001], ['ZZ9999', 'client', 1001], ['AB2345', 'other', 1001]]) {
    const store = new CaptchaStore(); const token = store.issue('AB2345', 'client', undefined, 1000);
    assert.equal(store.consume(token, answer, client, now), false);
    assert.equal(store.consume(token, 'AB2345', 'client', 1002), false);
  }
  const store = new CaptchaStore(); const token = store.issue('AB2345', 'client');
  store.issue('BC2345', 'client', token);
  assert.equal(store.consume(token, 'AB2345', 'client'), false);
});
test('CAPTCHA issuance is rate limited and recovers after the window', () => {
  const store = new CaptchaStore();
  for (let i = 0; i < 20; i++) assert.ok(store.issue('AB2345', 'client', undefined, 1000));
  assert.equal(store.issue('AB2345', 'client', undefined, 1001), null);
  assert.ok(store.issue('AB2345', 'client', undefined, 61000));
});
test('OTP email display masks the personal identifier including short names', () => {
  const { maskEmail } = tsLoader()('src/lib/auth-display.ts');
  assert.equal(maskEmail('tranquyet098@gmail.com'), 'tr***@gmail.com');
  assert.equal(maskEmail('ab@gmail.com'), 'a***@gmail.com');
  assert.equal(maskEmail('invalid'), '***');
});
