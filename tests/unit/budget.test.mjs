import { test } from 'node:test';
import assert from 'node:assert/strict';
import { budgetStatus } from '../../src/lib/budget.js';

test('budget status per category for one month', () => {
  const txns = [
    { type: 'expense', category: 'Food', amount: 6500, date: '2026-11-03' },
    { type: 'expense', category: 'food ', amount: 1000, date: '2026-11-04' },   // case/space-insensitive
    { type: 'expense', category: 'Food', amount: 9999, date: '2026-10-30' },    // other month
    { type: 'income', category: 'Food', amount: 500, date: '2026-11-05' },      // not an expense
    { type: 'expense', category: 'Transport', amount: 2600, date: '2026-11-10' },
  ];
  const rows = budgetStatus([
    { id: 'a', category: 'Food', limit: 8000 },
    { id: 'b', category: 'Transport', limit: 2500 },
    { id: 'c', category: 'Fun', limit: 1000 },
  ], txns, '2026-11');
  const by = Object.fromEntries(rows.map(r => [r.id, r]));
  assert.equal(by.a.spent, 7500); assert.equal(by.a.level, 'near'); assert.equal(by.a.left, 500);
  assert.equal(by.b.level, 'over'); assert.equal(by.b.left, -100);
  assert.equal(by.c.spent, 0); assert.equal(by.c.level, 'ok');
  assert.deepEqual(rows.map(r => r.id), ['b', 'a', 'c'], 'most used first');
});
