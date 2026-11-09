const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tsLoader } = require('./helpers/ts-loader.cjs');
test('gateway and origin failures explain the access address without reporting an account permission failure', async () => {
  for (const code of ['INVALID_REQUEST_ORIGIN', 'UNTRUSTED_GATEWAY']) {
    const { requestJson } = tsLoader({ fetch: async () => Response.json({ code }, { status: 403 }) })('src/lib/http.ts');
    await assert.rejects(requestJson('/auth/login', { method: 'POST' }, false), error => error.status === 403 && error.message.includes('HTTPS') && !error.message.includes('không có quyền'));
  }
});
test('ordinary backend 403 still reports insufficient permission', async () => {
  const { requestJson } = tsLoader({ fetch: async () => Response.json({ message: 'Forbidden' }, { status: 403 }) })('src/lib/http.ts');
  await assert.rejects(requestJson('/reports'), error => error.status === 403 && error.message.includes('không có quyền'));
});
test('validation arrays become readable error messages', async () => {
  const { requestJson } = tsLoader({ fetch: async () => Response.json({ message: ['name must be a string', 'email must be an email'] }, { status: 400 }) })('src/lib/http.ts');
  await assert.rejects(requestJson('/users'), error => error.status === 400 && error.message.includes('email must be an email'));
});
test('429 respects Retry-After and blocks further auth requests without retrying', async () => {
  let count = 0;
  const { requestJson } = tsLoader({ fetch: async () => { count++; return new Response('Too many requests', { status: 429, headers: { 'Retry-After': '120' } }); } })('src/lib/http.ts');
  const start = Date.now();
  await assert.rejects(requestJson('/auth/login', { method: 'POST' }, false), error => error.status === 429 && error.retryAt >= start + 120000);
  await assert.rejects(requestJson('/auth/verify-login-otp', { method: 'POST' }, false), error => error.status === 429);
  assert.equal(count, 1);
});
test('Retry-After supports HTTP dates and a safe fallback', () => {
  const { retryAfterSeconds } = tsLoader()('src/lib/http.ts'); const now = Date.parse('2026-10-28T00:00:00Z');
  assert.equal(retryAfterSeconds('Wed, 28 Oct 2026 00:01:00 GMT', now), 60);
  assert.equal(retryAfterSeconds(null, now), 60);
});
test('server errors do not display internal database diagnostics', async () => {
  const { requestJson } = tsLoader({ fetch: async () => Response.json({ message: 'SQL password=secret' }, { status: 500 }) })('src/lib/http.ts');
  await assert.rejects(requestJson('/tasks'), error => error.status === 500 && !error.message.includes('secret'));
});
test('API browser transport uses cookies and never reads tokens from storage', async () => {
  const { api } = tsLoader({ window: { localStorage: { getItem() { throw new Error('Token storage must not be read'); } } }, fetch: async (url, options) => { assert.equal(url, '/api/users'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.headers.Authorization, undefined); return Response.json([]); } })('src/lib/api/index.ts');
  assert.equal((await api.get('/users')).length, 0);
});
test('multipart upload reports progress and keeps the browser-managed boundary', async () => {
  const progress = [];
  class UploadRequest {
    upload = {};
    headers = {};
    status = 201;
    responseText = '{"id":8}';
    open(method, url) { this.method = method; this.url = url; }
    setRequestHeader(name, value) { this.headers[name] = value; }
    getAllResponseHeaders() { return 'Content-Type: application/json\r\n'; }
    send(body) {
      assert.equal(this.method, 'POST');
      assert.equal(this.url, '/api/tasks/12/attachments');
      assert.ok(body instanceof FormData);
      assert.equal(this.headers['Content-Type'], undefined);
      this.upload.onprogress({ loaded: 25, total: 100, lengthComputable: true });
      this.onload();
    }
  }
  const { api } = tsLoader({ FormData, XMLHttpRequest: UploadRequest, fetch: () => { throw new Error('Fetch should not be used for progress uploads'); } })('src/lib/api/index.ts');
  const form = new FormData();
  form.append('file', new Blob(['image']), 'proof.jpg');
  const result = await api.postFormWithProgress('/tasks/12/attachments', form, (loaded, total) => progress.push([loaded, total]));
  assert.equal(result.id, 8);
  assert.deepEqual(progress, [[25, 100]]);
});
