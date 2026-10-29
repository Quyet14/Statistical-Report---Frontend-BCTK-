const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/access.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsObject });
const { canAccessRoute } = exportsObject;

test('admin can manage both employees and departments', () => {
  for (const route of ['/employees', '/departments', '/settings']) assert.equal(canAccessRoute('admin', route), true);
});

test('department heads have employee management without hospital administration', () => {
  assert.equal(canAccessRoute('manager', '/employees'), true);
  for (const route of ['/departments', '/settings', '/reports']) assert.equal(canAccessRoute('manager', route), false);
});

test('staff and unknown roles cannot open management routes', () => {
  for (const role of ['staff', 'unknown', '']) {
    for (const route of ['/employees', '/departments', '/settings']) assert.equal(canAccessRoute(role, route), false);
  }
});

test('route matching respects boundaries and child route permissions', () => {
  assert.equal(canAccessRoute('manager', '/employees/3'), true);
  assert.equal(canAccessRoute('manager', '/employees-evil'), false);
  assert.equal(canAccessRoute('staff', '/employees/3'), false);
});

test('department heads can open department details without administration routes', () => {
  assert.equal(canAccessRoute('manager', '/departments/10'), true);
  for (const route of ['/departments', '/departments/new', '/departments/10/edit']) assert.equal(canAccessRoute('manager', route), false);
  assert.equal(canAccessRoute('staff', '/departments/10'), false);
});

test('all authenticated roles can open their own account page', () => {
  for (const role of ['admin', 'manager', 'staff']) assert.equal(canAccessRoute(role, '/account'), true);
});
