const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/auth.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function session() {
  const entries = new Map();
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
  const exports = {};
  const context = vm.createContext({ exports, require: () => ({ API_BASE_URL: 'https://api.example.test/api' }), window: { localStorage: storage }, localStorage: storage, document: { cookie: '' }, fetch: null });
  vm.runInContext(compiled, context);
  return { auth: exports, storage, context };
}

test('old admin token never overwrites the current manager profile', () => {
  const { auth, storage } = session();
  const user = { id: 2, name: 'Head A', email: 'head@example.test', role: 'manager', departmentId: 10 };
  const oldPayload = Buffer.from(JSON.stringify({ sub: 2, role: 'admin', email: user.email })).toString('base64url');
  storage.setItem('accessToken', `old.${oldPayload}.signature`);
  auth.saveUser(user);
  assert.equal(auth.getStoredUser().role, 'manager');
  assert.equal(JSON.parse(storage.getItem('currentUser')).role, 'manager');
});

test('page reload obtains and persists new permissions and department from the server', async () => {
  const { auth, storage, context } = session();
  auth.saveUser({ id: 2, name: 'Before', email: 'head@example.test', role: 'staff', departmentId: 10 });
  storage.setItem('accessToken', 'existing-access-token');
  const updated = { id: 2, name: 'After', email: 'head@example.test', role: 'manager', departmentId: 20 };
  context.fetch = async (url, options) => {
    assert.equal(url, 'https://api.example.test/api/auth/me');
    assert.equal(options.headers.Authorization, 'Bearer existing-access-token');
    assert.equal(options.cache, 'no-store');
    return { ok: true, text: async () => JSON.stringify(updated) };
  };
  await auth.refreshCurrentUser();
  assert.deepEqual(JSON.parse(storage.getItem('currentUser')), updated);
  assert.equal(auth.getStoredUser().role, 'manager');
});

test('removing department assignment clears its cached value rather than retaining the old department', async () => {
  const { auth, storage, context } = session();
  auth.saveUser({ id: 2, email: 'head@example.test', name: 'Head', role: 'manager', departmentId: 10 });
  storage.setItem('accessToken', 'token');
  context.fetch = async () => ({ ok: true, text: async () => JSON.stringify({ id: 2, email: 'head@example.test', name: 'Head', role: 'manager', departmentId: null }) });
  await auth.refreshCurrentUser();
  assert.equal(auth.getStoredUser().departmentId, null);
});

test('revoked sessions clear cached identity and tokens', async () => {
  const { auth, storage, context } = session();
  storage.setItem('accessToken', 'token');
  storage.setItem('refreshToken', 'refresh');
  auth.saveUser({ id: 1, role: 'admin' });
  context.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'Disabled account' }) });
  await assert.rejects(auth.refreshCurrentUser(), (error) => error.status === 401);
  assert.equal(storage.getItem('accessToken'), null);
  assert.equal(storage.getItem('refreshToken'), null);
  assert.equal(auth.getStoredUser(), null);
});

test('unavailable permissions endpoint rejects instead of trusting stale admin privileges', async () => {
  const { auth, storage, context } = session();
  storage.setItem('accessToken', 'token');
  auth.saveUser({ id: 1, role: 'admin' });
  context.fetch = async () => ({ ok: false, status: 500, json: async () => ({ message: 'Unavailable' }) });
  await assert.rejects(auth.refreshCurrentUser(), (error) => error.status === 500);
});

test('invalid cached JSON does not crash session initialization', () => {
  const { auth, storage } = session();
  storage.setItem('currentUser', '{broken');
  assert.equal(auth.getStoredUser(), null);
});

test('supports cookie-backed sessions without trusting malformed cookie values', () => {
  const { auth, context } = session();
  context.document.cookie = 'accessToken=cookie-token';
  assert.equal(auth.getStoredToken(), 'cookie-token');
  context.document.cookie = 'accessToken=%invalid';
  assert.equal(auth.getStoredToken(), null);
});
