const { JSDOM } = require('jsdom');
const { html, dialog } = require('../helpers.cjs');
const errors = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id), assert = require('assert');
const fire = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));
const txt = el => el.textContent.replace(/\s+/g, '');
// 50,000 in GCash
$('wallet-list').querySelector('[data-rec]').click(); dialog(w, '50000');
// plan: blank, one item 20,000
w.document.querySelector('#nav [data-tab="plan"]').click();
$('pn-name').value = 'Trip'; $('pn-template').value = 'blank';
$('plan-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
const amt = w.document.querySelector('.plan-item [data-if="amount"]'); amt.value = '20000'; fire(amt, 'change');
assert.match(txt($('plan-summary')),/Totalbalance₱50,000\.00−Plannedcosts₱20,000\.00Balanceafterthisplan₱30,000\.00/);
assert.match(txt($('plan-list')),/Balanceafter:₱30,000\.00/);
// log 5,000 of it from GCash: balance drops to 45k, still-to-spend 15k, after stays 30k
w.document.querySelector('[data-pact="log-any"]').click();
$('f-amount').value = '5000'; $('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match(txt($('plan-summary')),/Totalbalance₱45,000\.00−Stilltospendonthisplan₱15,000\.00Balanceafterthisplan₱30,000\.00/);
// over budget: raise plan to 80k -> short
const amt2 = w.document.querySelector('.plan-item [data-if="amount"]'); amt2.value = '80000'; fire(amt2, 'change');
assert.match(txt($('plan-summary')),/Balanceafterthisplan−₱30,000\.00/);
assert.match(txt($('plan-summary')),/shortby₱30,000\.00/);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('plan balance test passed'); process.exit(0);
