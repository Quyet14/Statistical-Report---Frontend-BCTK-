const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tsLoader } = require('./helpers/ts-loader.cjs');
test('activity restores across reload, expires after 30 minutes, and new OTP login resets it', () => {
  const values = new Map();
  const window = { localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) } };
  const first = tsLoader({ window })('src/lib/session-activity.ts');
  first.startSessionActivity(); const at = first.lastActivity();
  const reload = tsLoader({ window })('src/lib/session-activity.ts');
  assert.equal(reload.lastActivity(), at);
  assert.equal(reload.sessionIsIdle(at + 29 * 60000), false);
  assert.equal(reload.sessionIsIdle(at + 30 * 60000), true);
  reload.endSessionActivity(); assert.equal(first.sessionIsIdle(), true);
  first.startSessionActivity(); assert.equal(reload.sessionIsIdle(), false);
});
test('activity timers work when browser storage is unavailable', () => {
  const activity = tsLoader({ window: { localStorage: { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } } } })('src/lib/session-activity.ts');
  activity.startSessionActivity(); assert.ok(activity.lastActivity());
  assert.equal(activity.sessionIsIdle(activity.lastActivity() + 1800000), true);
});
