const { JSDOM } = require('jsdom');
const { html, dialog } = require('../helpers.cjs');
const errors = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  const R = w.Date, FIX = new R('2026-11-10T12:00:00');
  w.Date = class extends R { constructor(...a) { super(...(a.length ? a : [FIX.getTime()])); } static now() { return FIX.getTime(); } };
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id), assert = require('assert');
const t = el => el.textContent.replace(/\s+/g, ' ');
const fire = (el, ty) => el.dispatchEvent(new w.Event(ty, { bubbles: true }));
const rowOf = name => [...$('loan-list').querySelectorAll('.recur-row')].find(r => r.textContent.includes(name));
function newLoan({ dir = 'lent', person, amount, total = '', date, freq, count, first }) {
  $('loan-new-btn').click();
  w.document.querySelector(`#loan-dir [data-dir="${dir}"]`).click();
  $('ln-person').value = person; $('ln-amount').value = amount; $('ln-total').value = total;
  if (date) $('ln-date').value = date;
  $('ln-plan').value = 'periodic'; fire($('ln-plan'), 'change');
  $('ln-freq').value = freq; $('ln-count').value = count; $('ln-first').value = first; fire($('ln-first'), 'input');
  const preview = $('ln-preview').textContent;
  $('loan-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  return preview;
}
$('wallet-list').querySelector('[data-rec]').click(); dialog(w, '20000');
// monthly x6
let pv = newLoan({ person: 'Ana', amount: '6000', freq: 'monthly', count: '6', first: '2026-11-15' });
assert.match(pv, /6 monthly payments of ₱1,000\.00 · first Nov 15, last Apr 15/);
assert.match(t(rowOf('Ana')), /Payment 1 of 6: ₱1,000\.00 due Nov 15 \(in 5 days\)/);
assert.match(t($('cc-alert')), /Ana should pay you ₱1,000\.00 — due in 5 days/);
rowOf('Ana').querySelector('[data-lact="pay"]').click();
let f = $('loan-list').querySelector('[data-payform]');
assert.strictEqual(f.elements.amount.value, '1000.00');
fire(f, 'submit');
assert.match(t(rowOf('Ana')), /Payment 2 of 6: ₱1,000\.00 due Dec 15 \(in 35 days\)/);
assert.doesNotMatch(t($('cc-alert')), /Ana/);
// twice a month, borrowed, with interest; first payment already missed
pv = newLoan({ dir: 'borrowed', person: 'Ben', amount: '3000', total: '3100', date: '2026-10-01', freq: 'semimonthly', count: '4', first: '2026-10-20' });
assert.match(pv, /4 twice-a-month payments of ₱775\.00 · first Oct 31, last Dec 15/);
assert.match(t(rowOf('Ben')), /₱775\.00 overdue · 1 payment missed since Oct 31 · next ₱775\.00 on Nov 15/);
assert.match(t($('cc-alert')), /Pay Ben ₱775\.00 — was due Oct 31 \(overdue\)/);
rowOf('Ben').querySelector('[data-lact="pay"]').click();
f = $('loan-list').querySelector('[data-payform]'); assert.strictEqual(f.elements.amount.value, '775.00');
f.elements.amount.value = '500'; fire(f, 'submit');
assert.match(t(rowOf('Ben')), /₱275\.00 overdue/);
rowOf('Ben').querySelector('[data-lact="schedule"]').click();
const sched = t(rowOf('Ben'));
assert.match(sched, /#1 · Oct 31 ?₱775\.00 · part paid, overdue/);
assert.match(sched, /#4 · Dec 15 ?₱775\.00/);
// weekly dates + rounding
pv = newLoan({ person: 'Cy', amount: '1000', freq: 'weekly', count: '3', first: '2026-11-12' });
assert.match(pv, /3 weekly payments of ₱333\.33 \(last one ₱333\.34\) · first Nov 12, last Nov 26/);
// edit Cy into a one-time loan
rowOf('Cy').querySelector('[data-lact="edit"]').click();
assert.strictEqual($('ln-plan').value, 'periodic'); assert.strictEqual($('ln-count').value, '3');
$('ln-plan').value = 'once'; fire($('ln-plan'), 'change'); $('ln-due').value = '2026-12-01';
$('loan-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match(t(rowOf('Cy')), /Pay back by Dec 1 \(in 21 days\)/);
assert.doesNotMatch(t(rowOf('Cy')), /schedule/);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('loan repayment period tests passed'); process.exit(0);
