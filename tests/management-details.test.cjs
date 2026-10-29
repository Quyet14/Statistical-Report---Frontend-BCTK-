const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/management.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { canViewDepartment, departmentMembers, validRecordId, accountCreatedDate } = exportsObject;

test('department heads can view only their assigned department', () => {
  assert.equal(canViewDepartment({ role: 'manager', departmentId: 10 }, '10'), true);
  assert.equal(canViewDepartment({ role: 'manager', departmentId: 10 }, '20'), false);
  assert.equal(canViewDepartment({ role: 'manager', departmentId: null }, '10'), false);
  assert.equal(canViewDepartment({ role: 'staff', departmentId: 10 }, '10'), false);
  assert.equal(canViewDepartment({ role: 'admin' }, '20'), true);
});

test('department roster includes disabled accounts and heads but excludes other departments', () => {
  const members = departmentMembers([
    { id: 1, departmentId: 10, role: 'manager', isActive: true },
    { id: 2, departmentId: 10, role: 'staff', isActive: false },
    { id: 3, departmentId: 20, role: 'staff', isActive: true },
    { id: 4, departmentId: null, role: 'staff', isActive: true },
  ], 10);
  assert.equal(JSON.stringify(members.map((member) => member.id)), '[1,2]');
  assert.equal(departmentMembers([{ departmentId: null }], 0).length, 0);
});

test('malformed or unsafe record IDs cannot trigger detail requests', () => {
  for (const id of ['0', '-1', '1/../../users', 'new', '1.5', '', '9007199254740993']) assert.equal(validRecordId(id), false);
  assert.equal(validRecordId('123'), true);
});

test('missing and invalid creation dates have a readable fallback', () => {
  assert.equal(accountCreatedDate(null), 'Chưa có thông tin');
  assert.equal(accountCreatedDate('invalid'), 'Chưa có thông tin');
  assert.match(accountCreatedDate('2026-10-28T00:00:00Z'), /28\/10\/2026/);
});
