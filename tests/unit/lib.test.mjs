import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayIn, nextYm, prevYm, addDays, daysBetween, round2, peso, esc, isLight } from '../../src/lib/format.js';
import { normalize, merge, sig } from '../../src/lib/merge.js';
import { loanSchedule, instMonthly, instPayable, instSchedule } from '../../src/lib/schedule.js';

test('date helpers', () => {
  assert.equal(dayIn('2026-02', 31), '2026-02-28');
  assert.equal(dayIn('2028-02', 31), '2028-02-29');
  assert.equal(nextYm('2026-12'), '2027-01');
  assert.equal(prevYm('2027-01'), '2026-12');
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
  assert.equal(daysBetween('2026-11-01', '2026-11-15'), 14);
});

test('money and text', () => {
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(peso(-1234.5), '−₱1,234.50');
  assert.equal(esc('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;');
  assert.equal(isLight('#fbf7f1'), true);
  assert.equal(isLight('#4b4d26'), false);
});

test('merge keeps both sides, newest edit wins, deletions stick', () => {
  const base = normalize({ txns: [{ id: 't1', amount: 100, u: 1 }] });
  const phone = normalize({ ...base, txns: [...base.txns, { id: 't2', amount: 50, u: 5 }] });
  const pc = normalize({ ...base, txns: [{ id: 't1', amount: 120, u: 6 }] });
  let m = merge(phone, pc);
  assert.deepEqual(m.txns.map(t => `${t.id}=${t.amount}`).sort(), ['t1=120', 't2=50']);
  const pcDel = normalize({ ...m, txns: m.txns.filter(t => t.id !== 't2'), deleted: { t2: 9 } });
  m = merge(phone, pcDel);
  assert.deepEqual(m.txns.map(t => t.id), ['t1']);
  assert.equal(sig(merge(phone, pcDel)), sig(merge(pcDel, phone)), 'order does not matter');
});

test('merge keeps collections and the newest look it does not know about', () => {
  const a = normalize({ prefs: { accent: '#111', u: 5 } });
  const b = normalize({ futureThing: [{ id: 'x', u: 1 }], prefs: { accent: '#222', u: 9 } });
  const m = merge(a, b);
  assert.deepEqual(m.futureThing, [{ id: 'x', u: 1 }]);
  assert.equal(m.prefs.accent, '#222');
});

test('loan schedules', () => {
  const semi = loanSchedule({ total: 3100, freq: 'semimonthly', count: 4, firstDue: '2026-10-20' });
  assert.deepEqual(semi.map(p => p.date), ['2026-10-31', '2026-11-15', '2026-11-30', '2026-12-15']);
  assert.deepEqual(semi.map(p => p.amount), [775, 775, 775, 775]);
  const weekly = loanSchedule({ total: 1000, freq: 'weekly', count: 3, firstDue: '2026-11-12' });
  assert.deepEqual(weekly.map(p => p.amount), [333.33, 333.33, 333.34]);
  const monthly = loanSchedule({ total: 600, freq: 'monthly', count: 3, firstDue: '2026-01-31' });
  assert.deepEqual(monthly.map(p => p.date), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(loanSchedule({ principal: 500, due: '2026-12-01' }), [{ n: 1, date: '2026-12-01', amount: 500 }]);
});

test('installment schedules', () => {
  const p = { id: 'p', total: 10000, months: 6, rate: 0.5, purchaseDate: '2026-11-10' };
  assert.equal(instMonthly(p), 1716.67);
  assert.equal(instPayable(p), 10300);
  const s = instSchedule(p, 25);
  assert.equal(s[0].date, '2026-11-25');
  assert.equal(s.at(-1).date, '2027-04-25');
  assert.equal(round2(s.reduce((sum, o) => sum + o.amount, 0)), 10300, 'last payment absorbs rounding');
  assert.equal(instSchedule({ ...p, closedAt: '2027-01-01' }, 25).length, 2, 'paid-off plans stop billing');
});
