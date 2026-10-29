const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual fallback route handlers without starting a server or database.
function routes(query) {
  const handlers = new Map();
  const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');
  const section = source.slice(source.indexOf("app.get('/api/users',"), source.indexOf("app.get(['/api/kpi'"));
  const app = Object.fromEntries(['get', 'post', 'patch', 'delete'].map((method) => [method, (url, ...chain) => handlers.set(`${method} ${url}`, chain.at(-1))]));
  vm.runInNewContext(section, { app, pool: { query }, requireAuth() {}, requireAdmin() {}, bcrypt: { hash() { throw new Error('Manager must never hash passwords'); } } });
  return handlers;
}

async function invoke(handler, user, body, id = '3') {
  const result = { status: 200, body: undefined };
  const response = { status(code) { result.status = code; return this; }, json(value) { result.body = value; return this; } };
  await handler({ user, body, params: { id } }, response);
  return result;
}
const head = { id: 2, role: 'manager', departmentId: 10 };

test('fallback manager directory scopes the database query to own staff', async () => {
  const handlers = routes(async (sql, values) => {
    assert.match(sql, /WHERE departmentId = \? AND role = 'staff'/);
    assert.deepEqual(Array.from(values), [10]);
    return [[{ id: 3 }]];
  });
  const result = await invoke(handlers.get('get /api/users/managed'), head);
  assert.equal(result.status, 200);
  assert.equal(result.body[0].id, 3);
});

test('fallback manager update rejects privilege fields, self updates and missing department', async () => {
  const handlers = routes(async () => { throw new Error('No database writes expected'); });
  const update = handlers.get('patch /api/users/:id');
  for (const body of [{ role: 'admin' }, { departmentId: 20 }, { password: 'newpassword' }, { branchId: 2 }]) assert.equal((await invoke(update, head, body)).status, 403);
  assert.equal((await invoke(update, head, { name: 'Self' }, '2')).status, 403);
  assert.equal((await invoke(update, { ...head, departmentId: null }, { isActive: false })).status, 403);
});

test('fallback disabling an employee includes department and role in the atomic write', async () => {
  const calls = [];
  const handlers = routes(async (sql, values) => {
    calls.push({ sql, values: Array.from(values) });
    return sql.startsWith('UPDATE') ? [{ affectedRows: 1 }] : [[{ id: 3, isActive: false }]];
  });
  const result = await invoke(handlers.get('patch /api/users/:id'), head, { isActive: false });
  assert.equal(result.status, 200);
  assert.match(calls[0].sql, /WHERE id = \? AND departmentId = \? AND role = 'staff'/);
  assert.deepEqual(calls[0].values, [false, '3', 10]);
  assert.equal(result.body.isActive, false);
});

test('fallback denies writes when target is outside the managed department', async () => {
  const handlers = routes(async () => [{ affectedRows: 0 }]);
  assert.equal((await invoke(handlers.get('patch /api/users/:id'), head, { isActive: false })).status, 403);
});
