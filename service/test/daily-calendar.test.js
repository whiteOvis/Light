import assert from 'node:assert/strict';
import test from 'node:test';
import { currentDayOfYear } from '../src/service.js';

test('daily calendar uses local dates across DST, leap days, and New Year', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['America/Los_Angeles', 'Europe/Berlin', 'Australia/Sydney']) {
      process.env.TZ = zone;
      for (const [date, expected] of [
        ['2026-01-01T00:00:00', 1], ['2026-09-16T00:00:00', 259],
        ['2026-03-08T03:00:00', 67], ['2026-11-01T01:00:00', 305],
        ['2024-02-29T00:00:00', 60], ['2024-12-31T23:59:59', 366],
      ]) assert.equal(currentDayOfYear(new Date(date)), expected, `${zone}: ${date}`);
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
