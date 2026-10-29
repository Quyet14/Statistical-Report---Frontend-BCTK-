const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tsLoader } = require('./helpers/ts-loader.cjs');
function session() {
  const entries = new Map(); const redirects = [];
  const storage = { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key) };
  const state = { fetch: () => { throw new Error('Unexpected request'); } };
  const load = tsLoader({ window: { localStorage: storage, sessionStorage: storage, location: { pathname: '/checklist', replace: url => redirects.push(url) } }, document: { cookie: '' }, fetch: (...args) => state.fetch(...args) });
  return { auth: load('src/lib/auth.ts'), api: load('src/lib/api/index.ts').api, storage, state, redirects };
}
test('session state ignores legacy tokens and cached roles', () => {
  const { auth, storage } = session();
  storage.setItem('accessToken', 'old-token'); storage.setItem('currentUser', JSON.stringify({ id: 1, role: 'admin' }));
  assert.equal(auth.getStoredUser(), null);
  auth.saveUser({ id: 2, role: 'manager' });
  assert.equal(auth.getStoredUser().role, 'manager');
  assert.equal(auth.saveTokens, undefined);
});
test('reload obtains current role and department using an HttpOnly session', async () => {
  const { auth, state } = session();
  auth.saveUser({ id: 2, role: 'admin', departmentId: 10 });
  state.fetch = async (url, options) => {
    assert.equal(url, '/api/auth/me'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.headers.Authorization, undefined);
    return Response.json({ id: 2, name: 'Head', email: 'head@example.test', role: 'manager', departmentId: null });
  };
  await auth.refreshCurrentUser();
  assert.equal(auth.getStoredUser().role, 'manager'); assert.equal(auth.getStoredUser().departmentId, null);
});
test('protected 401 clears identity and legacy tokens then redirects to sign in', async () => {
  const { auth, api, storage, state, redirects } = session();
  auth.saveUser({ id: 2, role: 'staff' }); storage.setItem('accessToken', 'old');
  state.fetch = async () => Response.json({ message: 'Expired' }, { status: 401 });
  await assert.rejects(api.get('/tasks'), error => error.status === 401);
  assert.equal(auth.getStoredUser(), null); assert.equal(storage.getItem('accessToken'), null); assert.equal(redirects[0], '/login?reason=expired');
});
test('403 keeps the session and reports insufficient permission', async () => {
  const { auth, api, state, redirects } = session(); auth.saveUser({ id: 2, role: 'manager' });
  state.fetch = async () => Response.json({}, { status: 403 });
  await assert.rejects(api.get('/reports'), error => error.status === 403);
  assert.equal(auth.getStoredUser().role, 'manager'); assert.equal(redirects.length, 0);
});
test('login uses only normalized email and password and never treats a 401 as session expiry', async () => {
  const { auth, state, redirects } = session();
  state.fetch = async (url, options) => { assert.equal(url, '/api/auth/login'); assert.deepEqual(JSON.parse(options.body), { email: 'user@example.test', password: 'private-password' }); return Response.json({}, { status: 401 }); };
  await assert.rejects(auth.login(' User@Example.Test ', 'private-password'), error => error.status === 401);
  assert.equal(redirects.length, 0);
});
test('OTP client rejects non-six-digit values without sending requests', async () => {
  const { auth } = session();
  for (const otp of ['12345', '1234567', 'abcdef']) await assert.rejects(auth.verifyLoginOtp('a@example.test', otp), error => error.status === 400);
});
test('logout clears the server cookie before completing, without calling backend refresh', async () => {
  const { auth, state } = session(); auth.saveUser({ id: 2, role: 'staff' });
  state.fetch = async (url, options) => { assert.equal(url, '/api/auth/logout'); assert.equal(options.method, 'POST'); return Response.json({}); };
  await auth.clearTokens(); assert.equal(auth.getStoredUser(), null);
});
test('unavailable identity endpoint never falls back to cached permissions', async () => {
  const { auth, state } = session(); state.fetch = async () => Response.json({}, { status: 503 });
  await assert.rejects(auth.refreshCurrentUser(), error => error.status === 503); assert.equal(auth.getStoredUser(), null);
});

test('temporary logout failure preserves the current identity so revocation can be retried', async () => {
  const { auth, state } = session(); auth.saveUser({ id: 2, role: 'manager' });
  state.fetch = async () => Response.json({}, { status: 503 });
  await assert.rejects(auth.clearTokens()); assert.equal(auth.getStoredUser().id, 2);
});

test('returning on a remembered browser restores an idle session and resets the activity timer', async () => {
  const { auth, state, storage } = session(); storage.setItem('careops-session-ended', String(Date.now()));
  state.fetch = async (url, options) => { assert.equal(url, '/api/auth/resume-device'); assert.equal(options.method, 'POST'); return Response.json({ user: { id: 2, email: 'head@example.test', name: 'Head', role: 'manager' } }); };
  await auth.refreshCurrentUser(); assert.equal(auth.getStoredUser().id, 2); assert.equal(storage.getItem('careops-session-ended'), '0');
});
