import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthSummary } from '../../src/lib/summary.js';

const e = (date, amount, category) => ({ type: 'expense', date, amount, category });

test('compares month-to-date with the same days last month', () => {
  const s = monthSummary([
    e('2026-11-02', 1000, 'Food'), e('2026-11-05', 500, 'Transport'), e('2026-11-06', 999, 'Food'),   // 11-06 is after "today"
    e('2026-10-03', 600, 'Food'), e('2026-10-04', 900, 'Transport'), e('2026-10-20', 5000, 'Rent'),  // 10-20 is past the cutoff
    { type: 'income', date: '2026-11-01', amount: 30000, category: 'Salary' },
  ], '2026-11-05');
  assert.equal(s.spent, 1500); assert.equal(s.prevSpent, 1500); assert.equal(s.change, 0);
  assert.deepEqual(s.biggest.map(c => [c.category, c.diff]), [['Food', 400], ['Transport', -400]]);
  assert.equal(s.top, 'Food');
});

test('no previous month to compare with', () => {
  const s = monthSummary([e('2026-11-01', 250, 'Food')], '2026-11-01');
  assert.equal(s.change, null); assert.equal(s.day, 1);
});

test('31st of a month compares with all of a shorter previous month', () => {
  const s = monthSummary([e('2026-03-31', 100, 'Food'), e('2026-02-28', 400, 'Food')], '2026-03-31');
  assert.equal(s.prevSpent, 400);
  assert.equal(s.change, -0.75);
});
