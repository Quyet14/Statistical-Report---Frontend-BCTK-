const { test } = require('node:test');
const assert = require('node:assert/strict');
const dotenv = require('dotenv');
const { runtimeSettings } = require('../scripts/prepare-lan-runtime.cjs');
test('LAN settings use dedicated loopback ports and the current origin while retaining secrets and release', () => {
  const front = 'PORT=3000\nFRONTEND_ORIGIN=https://192.168.100.6:3443\nBFF_PROXY_SECRET=keep-bff\nTRUSTED_EDGE_SECRET=keep-edge\nCAREOPS_RELEASE=device\n';
  const back = 'PORT=3010\nJWT_SECRET=keep-jwt\nRATE_LIMIT_PREFIX=keep-prefix\nRATE_LIMIT_REDIS_URL=redis://:keep-password@127.0.0.1:6379\n';
  const value = runtimeSettings(front, back, '192.168.81.178'); const f = dotenv.parse(value.frontend); const b = dotenv.parse(value.backend);
  assert.equal(f.PORT, '3300'); assert.equal(b.PORT, '3310'); assert.equal(b.HOST, '127.0.0.1'); assert.equal(f.API_BACKEND_URL, 'http://127.0.0.1:3310/api');
  assert.equal(f.FRONTEND_ORIGIN, 'https://192.168.81.178:3443'); assert.equal(f.BFF_PROXY_SECRET, 'keep-bff'); assert.equal(f.TRUSTED_EDGE_SECRET, 'keep-edge'); assert.equal(f.CAREOPS_RELEASE, 'device');
  assert.equal(b.JWT_SECRET, 'keep-jwt'); assert.equal(b.RATE_LIMIT_PREFIX, 'keep-prefix'); assert.equal(b.RATE_LIMIT_REDIS_URL, 'redis://:keep-password@127.0.0.1:6379');
});
test('LAN settings reject public addresses and conflicting internal ports', () => {
  for (const host of ['8.8.8.8', 'example.test', '127.0.0.1']) assert.throws(() => runtimeSettings('', '', host));
  assert.throws(() => runtimeSettings('', '', '192.168.81.178', 3300, 3300));
  assert.throws(() => runtimeSettings('', '', '192.168.81.178', 3443, 3310));
});
