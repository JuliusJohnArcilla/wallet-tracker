// Upgrade safety: data saved by the v13 app (before this round) opens intact.
// Loads data shaped like the live v13 app saves it into the new build and checks nothing is lost.
const { JSDOM } = require('jsdom');
const { rawHtml } = require('../helpers.cjs');
const assert = require('assert');
const html = rawHtml();
const v13 = {   // what v13 writes: no budgets, old "border" pref, loans, installments, plans, a sync config
  wallets: [{ id: 'g', name: 'GCash', opening: 25000, u: 5 }, { id: 'c', name: 'BPI Card', kind: 'credit', limit: 80000, closeDay: 25, dueDay: 15, opening: -1000, u: 5 }],
  txns: [{ id: 't1', type: 'expense', amount: 500, walletId: 'g', category: 'Food', date: '2026-11-01', note: 'lunch', u: 6 }],
  goals: [{ id: 'gl', name: 'Laptop', target: 50000, u: 6 }], goalEntries: [{ id: 'ge', goalId: 'gl', amount: 2000, date: '2026-11-01', u: 6 }],
  recurring: [{ id: 'r1', type: 'expense', amount: 1899, walletId: 'g', category: 'Internet', day: 20, start: '2026-11', u: 6 }],
  installments: [], plans: [{ id: 'p1', name: 'Japan', items: [], people: 2, u: 6 }],
  loans: [{ id: 'l1', dir: 'lent', person: 'Ana', principal: 3000, total: 3000, date: '2026-11-01', due: '2026-12-01', walletId: 'g', u: 6 }],
  deleted: {}, prefs: { theme: 'dark', accent: '#9b6a5b', border: false, u: 9 },
};
function boot(storage) {
  const errors = [];
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://juliusjohnarcilla.github.io/wallet-tracker/', beforeParse(w) {
    w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.fetch = () => Promise.reject(new Error('offline'));
    Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
    w.addEventListener('error', e => errors.push(e.message));
  } }).window;
  return { w, errors, $: id => w.document.getElementById(id) };
}
const t = el => el.textContent.replace(/\s+/g, ' ');
// (a) installed before profiles existed: only walletTracker.v1
let { w, errors, $ } = boot({ 'walletTracker.v1': JSON.stringify(v13) });
assert.ok($('signup').hidden, 'no sign-up screen for an existing user'); assert.ok(!$('app').hidden);
assert.match(t($('wallet-list')), /GCash ?₱24,500\.00/);
assert.match(t($('cc-list')), /BPI Card/); assert.match(t($('loan-list')), /Ana owes you ₱3,000\.00/);
assert.match(t($('goal-list')), /Laptop/); assert.match(t($('recur-list')), /Internet/);
assert.strictEqual(w.document.documentElement.dataset.theme, 'dark', 'look kept');
assert.match($('pref-style').textContent, /--border-w: 0px/, 'old outline setting kept');
const saved = JSON.parse(w.localStorage.getItem('walletTracker.v1'));
assert.strictEqual(saved.txns.length, 1); assert.strictEqual(saved.wallets.length, 2); assert.strictEqual(saved.loans.length, 1);
// the first change saves in the new shape, with everything old still there
$('bd-cat').value = 'Food'; $('bd-limit').value = '8000'; $('budget-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
const after = JSON.parse(w.localStorage.getItem('walletTracker.v1'));
assert.strictEqual(after.budgets.length, 1); assert.strictEqual(after.txns.length, 1); assert.strictEqual(after.goalEntries.length, 1);
assert.strictEqual(after.prefs.accent, '#9b6a5b');
assert.deepStrictEqual(errors, []);
// (b) v13 with two profiles, a PIN-less main profile and sync configured
({ w, errors, $ } = boot({ 'walletTracker.v1': JSON.stringify(v13), 'walletTracker.profiles': JSON.stringify([{ id: 'main', name: 'Julius', pin: '' }]),
  'walletTracker.v1.sync': JSON.stringify({ token: 'x', gistId: 'abc1234', file: 'wallet-tracker-julius.json', lastSync: 1 }) }));
assert.ok(!$('app').hidden); assert.match($('sync-badge').textContent, /Julius/);
assert.match($('sync-detail').textContent, /wallet-tracker-julius\.json/, 'sync link kept');
assert.match(t($('wallet-list')), /GCash ?₱24,500\.00/);
console.log('v13 data opens intact in the new build');
process.exit(0);
