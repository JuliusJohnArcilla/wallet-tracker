const { JSDOM } = require('jsdom');
const { html } = require('../helpers.cjs');
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
const gcashTile = () => t($('wallet-list').querySelector('.wallet'));
w.prompt = () => '10000'; $('wallet-list').querySelector('[data-rec]').click();
const gcash = $('wallet-list').querySelector('[data-rec]').dataset.rec;
// lend Juan 3,000, pay back 3,300 by Nov 15
$('loan-new-btn').click();
$('ln-person').value = 'Juan'; $('ln-amount').value = '3000'; $('ln-total').value = '3300'; $('ln-due').value = '2026-11-15'; $('ln-wallet').value = gcash;
$('loan-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match(gcashTile(), /₱7,000\.00/);
assert.match(t($('loan-list')), /Juan owes you ₱3,300\.00/);
assert.match(t($('loan-list')), /includes ₱300\.00 interest/);
assert.match(t($('loan-list')), /Pay back by Nov 15 \(in 5 days\)/);
assert.match(t($('loan-summary')), /Owed to you ₱3,300\.00 · You owe ₱0\.00/);
assert.match(t($('cc-alert')), /Juan should pay you ₱3,300\.00 — due in 5 days/);
assert.match($('st-expense').textContent, /₱0\.00/, 'lending is not an expense');
// partial payment 2,000 via the alert button
$('cc-alert').querySelector('[data-loanpay]').click();
let form = $('loan-list').querySelector('[data-payform]');
assert.strictEqual(form.elements.amount.value, '3300.00');
form.elements.amount.value = '2000'; form.elements.wallet.value = gcash;
form.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
assert.match(gcashTile(), /₱9,000\.00/);
assert.match(t($('loan-list')), /Juan owes you ₱1,300\.00/);
// final payment 1,300: 1,000 principal + 300 interest
$('loan-list').querySelector('[data-lact="pay"]').click();
form = $('loan-list').querySelector('[data-payform]'); form.elements.wallet.value = gcash;
form.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
assert.match(gcashTile(), /₱10,300\.00/);
assert.match($('st-income').textContent, /₱300\.00/, 'interest counts as revenue');
assert.match(t($('loan-list')), /Show paid-back loans \(1\)/);
assert.ok($('cc-alert').hidden);
$('loan-list').querySelector('[data-lact="toggle-paid"]').click();
assert.match(t($('loan-list')), /✓ Paid back/);
// borrowed from Maria, overdue
$('loan-new-btn').click();
w.document.querySelector('#loan-dir [data-dir="borrowed"]').click();
assert.strictEqual($('ln-person-label').textContent, 'Who lent you?');
$('ln-person').value = 'Maria'; $('ln-amount').value = '5000'; $('ln-date').value = '2026-11-01'; $('ln-due').value = '2026-11-05'; $('ln-wallet').value = gcash;
$('loan-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match(gcashTile(), /₱15,300\.00/);
assert.match(t($('loan-list')), /You owe Maria ₱5,000\.00/);
assert.match(t($('loan-list')), /Overdue by 5 days/);
assert.match(t($('cc-alert')), /Pay Maria ₱5,000\.00 — was due Nov 5 \(overdue\)/);
// history labels
$('t-month').value = ''; $('t-type').value = 'loan'; $('t-type').dispatchEvent(new w.Event('input'));
const hist = t($('t-body'));
assert.match(hist, /Lent/); assert.match(hist, /Borrowed/); assert.match(hist, /Loan repayment/); assert.match(hist, /Loan interest/);
// edit due date
const maria = [...$('loan-list').querySelectorAll('[data-lact="edit"]')].find(b => b.closest('.recur-row').textContent.includes('Maria'));
maria.click(); assert.ok($('ln-amount').disabled);
$('ln-due').value = '2026-12-01'; $('loan-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match(t($('loan-list')), /Pay back by Dec 1 \(in 21 days\)/);
// delete Maria's loan -> balance back
const del = [...$('loan-list').querySelectorAll('[data-lact="del"]')].find(b => b.closest('.recur-row').textContent.includes('Maria'));
del.click();
assert.match(gcashTile(), /₱10,300\.00/);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('loan tests passed'); process.exit(0);
