const { JSDOM } = require('jsdom');
const { html } = require('../helpers.cjs');
const errors = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  const R = w.Date, FIX = new R('2026-11-10T12:00:00');
  w.Date = class extends R { constructor(...a) { super(...(a.length ? a : [FIX.getTime()])); } static now() { return FIX.getTime(); } };
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id), assert = require('assert');
const submit = id => $(id).dispatchEvent(new w.Event('submit', { cancelable: true }));
// add card
$('cc-name').value = 'BPI Amore'; $('cc-limit').value = '50000'; $('cc-owed').value = '0'; $('cc-close').value = '25'; $('cc-due').value = '15';
submit('cc-form');
assert.match($('cc-list').textContent, /BPI Amore/);
assert.strictEqual($('wallet-list').querySelectorAll('.wallet').length, 5, 'card not among wallets');
const cardId = $('cc-list').querySelector('[data-pay]').dataset.pay;
const gcash = $('wallet-list').querySelector('[data-rec]').dataset.rec;
// charge before statement close and after
const add = (type, amount, wallet, date, to) => {
  w.document.querySelector(`#type-seg [data-type="${type}"]`).click();
  $('f-amount').value = amount; $('f-wallet').value = wallet; $('f-date').value = date; $('f-cat').value = 'Shopping';
  if (to) $('f-to').value = to;
  submit('txn-form');
};
add('expense', '10000', cardId, '2026-10-20');
add('expense', '2000', cardId, '2026-11-05');
assert.match($('cc-list').textContent, /₱12,000\.00/);
assert.match($('cc-list').textContent, /₱10,000\.00 due Nov 15/);
assert.match($('cc-list').textContent, /in 5 days/);
assert.ok(!$('cc-alert').hidden, 'due-soon alert'); assert.match($('cc-alert').textContent, /due in 5 days/);
assert.match($('cc-list').textContent, /₱38,000\.00 available/);
// pay via Pay button flow
$('cc-list').querySelector('[data-pay]').click();
assert.strictEqual($('f-to').value, cardId); assert.strictEqual($('f-amount').value, '10000.00');
assert.notStrictEqual($('f-wallet').value, cardId);
$('f-amount').value = '4000'; $('f-date').value = '2026-11-08'; submit('txn-form');
assert.match($('cc-list').textContent, /₱6,000\.00 due Nov 15/);
assert.match($('t-body').textContent, /Card payment/);
add('transfer', '6000', gcash, '2026-11-09', cardId);
assert.match($('cc-list').textContent, /Statement paid/);
assert.ok($('cc-alert').hidden);
assert.match($('cc-list').textContent, /₱2,000\.00/);
// expenses count once (charges), payments are not expenses
assert.match($('st-expense').textContent, /₱2,000\.00/); // November: only the Nov 5 charge
assert.match($('st-total-sub').textContent, /after card debt/);
// reconcile owed
w.prompt = () => '2500';
$('cc-list').querySelector('[data-rec]').click();
assert.match($('cc-list').querySelector('.owed').textContent, /₱2,500\.00/);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('credit card test passed'); process.exit(0);
