// #7 Monthly summary card
const { JSDOM } = require('jsdom');
const assert = require('assert');
const { html } = require('../helpers.cjs');

const errors = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  const R = w.Date, FIX = new R('2026-11-05T12:00:00');
  w.Date = class extends R { constructor(...a) { super(...(a.length ? a : [FIX.getTime()])); } static now() { return FIX.getTime(); } };
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  // an existing layout saved before this section existed
  w.localStorage.setItem('walletTracker.v1', JSON.stringify({ wallets: [{ id: 'g', name: 'GCash', opening: 0 }], txns: [],
    prefs: { u: 1, sections: { order: ['stats', 'wallets', 'cards', 'loans', 'entry', 'monthly', 'charts'], hidden: [] } } }));
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id);
const t = el => el.textContent.replace(/\s+/g, ' ');
const spend = (amount, cat, date) => {
  w.document.querySelector('#type-seg [data-type="expense"]').click();
  $('f-amount').value = amount; $('f-cat').value = cat; $('f-date').value = date;
  $('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
};
assert.match(t($('sum-headline')), /No spending recorded yet/);
spend('1200', 'Food', '2026-11-02');
assert.match(t($('sum-headline')), /₱1,200\.00 spent in the first 5 days\. Nothing from October to compare with yet\./);
spend('800', 'Food', '2026-10-03');
spend('600', 'Transport', '2026-10-04');
assert.match(t($('sum-headline')), /₱1,200\.00 spent in the first 5 days — 14% less than the same days in October \(₱1,400\.00\)\./);
assert.match(t($('sum-cats')), /Transport.*▼ ₱600\.00 vs Oct/);
assert.match(t($('sum-cats')), /Food.*▲ ₱400\.00 vs Oct/);
// the new section lands right after "Balance summary" in a previously saved layout
const order = el => Number(w.document.querySelector(`[data-sec="${el}"]`).style.order);
assert.strictEqual(order('summary'), order('stats') + 1);
assert.strictEqual(order('budgets'), order('wallets') + 1);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('summary tests passed'); process.exit(0);
