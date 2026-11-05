// #3 Search in Transactions
const { JSDOM } = require('jsdom');
const assert = require('assert');
const { html } = require('../helpers.cjs');

const errors = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id);
const add = (amount, cat, note, date, walletIndex = 0) => {
  w.document.querySelector('#type-seg [data-type="expense"]').click();
  $('f-amount').value = amount; $('f-cat').value = cat; $('f-note').value = note; $('f-date').value = date;
  $('f-wallet').selectedIndex = walletIndex;
  $('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
};
add('1500', 'Food', 'Jollibee birthday treat', '2026-09-12');
add('89.75', 'Transport', 'Grab to office', '2026-10-03', 1);
add('650', 'Food', 'Mang Inasal', '2026-11-01');
const search = q => { $('t-search').value = q; $('t-search').dispatchEvent(new w.Event('input')); return [...$('t-body').querySelectorAll('tr')].map(r => r.textContent); };

assert.strictEqual(search('jollibee').length, 1, 'finds an old month while the month filter is set');
assert.match($('t-summary').textContent, /All months · 1 entries/);
assert.strictEqual(search('food').length, 2, 'category');
assert.strictEqual(search('maya').length, 1, 'wallet name');
assert.strictEqual(search('1,500').length, 1, 'amount with comma');
assert.strictEqual(search('₱650').length, 1, 'amount with peso sign');
assert.strictEqual(search('food inasal').length, 1, 'every word must match');
assert.strictEqual(search('nothing-like-this').length, 0);
assert.ok(!$('t-empty').hidden);
search('');
assert.doesNotMatch($('t-summary').textContent, /All months/, 'month filter applies again when cleared');

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('search tests passed'); process.exit(0);
