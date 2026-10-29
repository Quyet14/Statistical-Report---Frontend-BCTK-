const { test } = require('node:test');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');
const { check, serialize } = require('../scripts/deployment-config.cjs');
const front = { NODE_ENV: 'production', FRONTEND_ORIGIN: 'https://192.168.81.178:3443', API_BACKEND_URL: 'http://127.0.0.1:3010/api', TRUSTED_EDGE_ENABLED: 'true', TRUSTED_EDGE_SECRET: 'edge'.repeat(12), BFF_PROXY_SECRET: 'proxy'.repeat(12) };
const back = { NODE_ENV: 'production', JWT_SECRET: 'jwt'.repeat(20), BFF_PROXY_SECRET: front.BFF_PROXY_SECRET, RATE_LIMIT_REDIS_URL: 'redis://:password@127.0.0.1:6379', DB_HOST: 'localhost', DB_USERNAME: 'app', DB_DATABASE: 'app', SMTP_HOST: 'smtp', SMTP_USER: 'user', SMTP_PASS: 'private', DB_SYNCHRONIZE: 'false' };
test('deployment checker accepts matched LAN HTTPS configuration', () => { assert.deepEqual(check(front, back), []); });
test('deployment checker rejects mismatched keys and remote plaintext API', () => {
  const errors = check({ ...front, API_BACKEND_URL: 'http://remote.example/api' }, { ...back, BFF_PROXY_SECRET: 'different'.repeat(10) });
  assert.ok(errors.some(error => error.includes('API_BACKEND_URL'))); assert.ok(errors.some(error => error.includes('BFF_PROXY_SECRET')));
});
test('generated env files preserve special password characters without logging them', () => {
  const input = { SMTP_PASS: 'value#with space$and"quotes', JWT_SECRET: 'secret-value' };
  assert.deepEqual(dotenv.parse(serialize(input)), input);
});
