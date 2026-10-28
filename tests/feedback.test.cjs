const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/feedback.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = vm.createContext({ exports: {}, Error });
vm.runInContext(compiled, context);
const { runWithFeedback, taskOutcomeFeedback } = context.exports;

test('success feedback waits until persistence finishes', async () => {
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const messages = [];
  const operation = runWithFeedback(() => pending, (message) => messages.push(message), { title: 'Saved' });
  assert.equal(messages.length, 0);
  resolve({ id: 12 });
  const result = await operation;
  assert.equal(result.ok, true);
  assert.equal(result.value.id, 12);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].title, 'Saved');
});

test('failed writes produce only an error and return failure to keep forms open', async () => {
  const messages = [];
  const result = await runWithFeedback(async () => { throw new Error('network unavailable'); }, (message) => messages.push(message), { title: 'Saved', presentation: 'completion' });
  assert.equal(result.ok, false);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].kind, 'error');
  assert.notEqual(messages[0].presentation, 'completion');
});

test('permission failures show a helpful message rather than success', async () => {
  const messages = [];
  await runWithFeedback(async () => { throw new Error('Request failed: 403'); }, (message) => messages.push(message), { title: 'Saved' });
  assert.match(messages[0].description, /không có quyền/);
});

test('completion dialog appears only for a transition into done', () => {
  assert.equal(taskOutcomeFeedback('doing', 'done', 'Task A').presentation, 'completion');
  assert.equal(taskOutcomeFeedback('todo', 'done', 'Task B').presentation, 'completion');
  assert.equal(taskOutcomeFeedback('done', 'done', 'Task A').presentation, 'dialog');
  assert.equal(taskOutcomeFeedback('done', 'doing', 'Task A').presentation, 'dialog');
  assert.equal(taskOutcomeFeedback(undefined, 'done', 'Task A').presentation, 'dialog');
});

test('checklist feedback uses the persisted task result to recognize final completion', async () => {
  const messages = [];
  await runWithFeedback(async () => ({ status: 'done', progress: 100 }), (message) => messages.push(message), (result) => taskOutcomeFeedback('doing', result.status, 'Task A'));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].presentation, 'completion');
  assert.equal(messages[0].description, 'Task A');
});
