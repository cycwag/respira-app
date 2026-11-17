const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchDinkesWeeklyCases, getPreviousCompleteJakartaWeek } = require('../src/dinkesService');

test('computes the last completed Monday-to-Sunday week in Jakarta time', () => {
  assert.deepEqual(
    getPreviousCompleteJakartaWeek(new Date('2026-11-17T08:00:00.000Z')),
    { startDate: '2026-11-09', endDate: '2026-11-15' }
  );
});

test('rejects invalid Dinkes date ranges without making a network request', async () => {
  await assert.rejects(
    fetchDinkesWeeklyCases('2023-06-01', '2023-06-06'),
    /satu minggu penuh/
  );
  await assert.rejects(
    fetchDinkesWeeklyCases('2023-02-30', '2023-03-08'),
    /tidak valid/
  );
});
