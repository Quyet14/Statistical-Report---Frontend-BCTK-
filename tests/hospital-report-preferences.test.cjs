const { test } = require('node:test');
const assert = require('node:assert/strict');
const { tsLoader } = require('./helpers/ts-loader.cjs');
const { readHospitalReportFilters, saveHospitalReportFilters } = tsLoader()('src/lib/hospital-report-preferences.ts');

test('hospital report filters survive reopening and stay separate for each account', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const fallback = { period: 'month', date: '2026-11-23' };
  saveHospitalReportFilters(storage, 'account:1', { period: 'day', date: '2026-11-18' });
  saveHospitalReportFilters(storage, 'account:2', { period: 'year', date: '2025-05-01' });
  assert.deepEqual({ ...readHospitalReportFilters(storage, 'account:1', fallback) }, { period: 'day', date: '2026-11-18' });
  assert.deepEqual({ ...readHospitalReportFilters(storage, 'account:2', fallback) }, { period: 'year', date: '2025-05-01' });
  assert.deepEqual(readHospitalReportFilters(storage, 'new-account', fallback), fallback);
});

test('invalid or unavailable browser storage does not break report filters or overwrite the last valid date', () => {
  const fallback = { period: 'month', date: '2026-11-23' };
  for (const saved of ['invalid json', '{"period":"quarter","date":"2026-11-18"}', '{"period":"day","date":"2026-02-30"}', '{"period":"year","date":"1999-01-01"}']) {
    assert.deepEqual(readHospitalReportFilters({ getItem: () => saved }, 'key', fallback), fallback);
  }
  let writes = 0;
  saveHospitalReportFilters({ setItem: () => writes++ }, 'key', { period: 'day', date: '' });
  assert.equal(writes, 0);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(readHospitalReportFilters(blocked, 'key', fallback), fallback);
  assert.doesNotThrow(() => saveHospitalReportFilters(blocked, 'key', fallback));
});
