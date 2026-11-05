// #1 Budgets per category
const { JSDOM } = require('jsdom');
const assert = require('assert');
const { html, dialog } = require('../helpers.cjs');

const errors = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id);
const t = el => el.textContent.replace(/\s+/g, ' ');
const spend = (amount, cat) => {
  w.document.querySelector('#type-seg [data-type="expense"]').click();
  $('f-amount').value = amount; $('f-cat').value = cat;
  $('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
};
const budget = (cat, limit) => { $('bd-cat').value = cat; $('bd-limit').value = limit; $('budget-form').dispatchEvent(new w.Event('submit', { cancelable: true })); };

assert.match(t($('budget-list')), /Set a monthly limit/);
budget('Food', '8,000');
spend('5000', 'Food');
assert.match(t($('budget-list')), /Food ₱5,000\.00 of ₱8,000\.00/);
assert.match(t($('budget-list')), /₱3,000\.00 left/);
spend('1500', 'Food');
assert.match(t($('budget-list')), /Near the limit · ₱1,500\.00 left/);
assert.ok($('budget-list').querySelector('.bar-fill.near'));
spend('2000', 'Food');
assert.match(t($('budget-list')), /Over by ₱500\.00/);
assert.ok(!$('cc-alert').hidden); assert.match(t($('cc-alert')), /Food is over its monthly budget by ₱500\.00/);

// same category again updates the limit instead of adding a second one
budget('food', '10000');
assert.strictEqual($('budget-list').querySelectorAll('.budget-row').length, 1);
assert.match(t($('budget-list')), /₱1,500\.00 left/);
assert.ok($('cc-alert').hidden, 'no longer over');

// edit via dialog, remove with undo
$('budget-list').querySelector('[data-bact="edit"]').click(); dialog(w, '9000');
assert.match(t($('budget-summary')), /₱8,500\.00 of ₱9,000\.00 this month/);
$('budget-list').querySelector('[data-bact="del"]').click();
assert.strictEqual($('budget-list').querySelectorAll('.budget-row').length, 0);
$('toast-btn').click();
assert.strictEqual($('budget-list').querySelectorAll('.budget-row').length, 1);

// shows up in Personalize → Overview sections
assert.match(t($('sec-list')), /Budgets/);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('budget tests passed'); process.exit(0);
