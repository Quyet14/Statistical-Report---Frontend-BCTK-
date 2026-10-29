const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { NextRequest } = require('next/server');
const { tsLoader } = require('./helpers/ts-loader.cjs');
const fs = require('node:fs');
const vm = require('node:vm');
const production = { NODE_ENV: 'production', FRONTEND_ORIGIN: 'https://careops.example.test', TRUSTED_EDGE_ENABLED: 'true', TRUSTED_EDGE_SECRET: 'edge-test-secret-with-at-least-32-bytes', BFF_PROXY_SECRET: 'bff-test-secret-with-at-least-32-bytes' };
test('writes require a verified fixed Origin or Referer and fail closed when absent', () => {
  const { verifiedWriteOrigin } = tsLoader({ process: { env: production } })('src/lib/server-security.ts');
  for (const headers of [{}, { 'Sec-Fetch-Site': 'same-origin' }, { Origin: 'null', Referer: 'https://careops.example.test/login' }, { Origin: 'https://careops.example.test.attacker.test' }, { Origin: 'https://evil.test', Host: 'evil.test' }]) assert.equal(verifiedWriteOrigin(new Headers(headers)), false);
  assert.equal(verifiedWriteOrigin(new Headers({ Origin: 'https://careops.example.test' })), true);
  assert.equal(verifiedWriteOrigin(new Headers({ Referer: 'https://careops.example.test/login' })), true);
});
test('IP assertions require the edge secret and bind method, path, IP and time', () => {
  const { signedClientHeaders } = tsLoader({ process: { env: production } })('src/lib/server-security.ts');
  const url = new URL('https://backend.test/api/users?search=abc');
  assert.throws(() => signedClientHeaders(new Headers({ 'X-Forwarded-For': '203.0.113.2' }), 'GET', url));
  const proof = signedClientHeaders(new Headers({ 'X-CareOps-Edge-Key': production.TRUSTED_EDGE_SECRET, 'X-CareOps-Client-IP': '203.0.113.2', 'X-Forwarded-For': 'attacker' }), 'GET', url);
  const expected = createHmac('sha256', production.BFF_PROXY_SECRET).update(JSON.stringify(['GET', '/api/users?search=abc', '203.0.113.2', proof['X-CareOps-Forwarded-At']])).digest('hex');
  assert.equal(proof['X-CareOps-Forwarded-Signature'], expected);
  assert.equal(proof['X-Forwarded-For'], undefined);
});
test('production CSP uses unpredictable nonces, excludes eval and preserves inline style attributes', () => {
  const { proxy } = tsLoader({ process: { env: production } })('src/proxy.ts');
  const first = proxy(new NextRequest('https://careops.example.test/login', { headers: { 'x-nonce': 'attacker-value' } }));
  const second = proxy(new NextRequest('https://careops.example.test/login'));
  const policy = first.headers.get('content-security-policy');
  assert.match(policy, /script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  assert.doesNotMatch(policy, /unsafe-eval|attacker-value/);
  assert.match(policy, /style-src-attr 'unsafe-inline'/);
  assert.notEqual(policy, second.headers.get('content-security-policy'));
});
test('legacy backend cannot start in production even with opt-in enabled', () => {
  const source = fs.readFileSync('server.js', 'utf8').split("const express = require('express');")[0];
  assert.throws(() => vm.runInNewContext(source, { process: { env: { NODE_ENV: 'production', ALLOW_LEGACY_BACKEND: 'true' } }, require: () => ({ config() {} }) }), /Legacy backend disabled/);
});
