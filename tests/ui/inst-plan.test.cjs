const { JSDOM } = require('jsdom');
const { html } = require('../helpers.cjs');
const errors = [];
function boot(dateStr, storage = {}) {
  return new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
    const R = w.Date, FIX = new R(dateStr + 'T12:00:00');
    w.Date = class extends R { constructor(...a) { super(...(a.length ? a : [FIX.getTime()])); } static now() { return FIX.getTime(); } };
    Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
    w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
    w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
  } }).window;
}
const assert = require('assert');
let w = boot('2026-11-10');
let $ = id => w.document.getElementById(id);
const submit = id => $(id).dispatchEvent(new w.Event('submit', { cancelable: true }));
const fire = (el, type) => el.dispatchEvent(new w.Event(type, { bubbles: true }));
// card closes 25th
$('cc-name').value = 'Card'; $('cc-limit').value = '100000'; $('cc-close').value = '25'; $('cc-due').value = '15'; submit('cc-form');
const card = $('cc-list').querySelector('[data-pay]').dataset.pay;
// installment purchase: 36,000 over 12 months at 0%
w.document.querySelector('#type-seg [data-type="expense"]').click();
$('f-amount').value = '36000'; $('f-wallet').value = card; fire($('f-wallet'), 'input');
assert.ok(!$('f-inst-wrap').hidden, 'installment option shows for card');
$('f-inst').checked = true; fire($('f-inst'), 'change');
assert.match($('f-inst-preview').textContent, /₱3,000\.00\/month for 12 months/);
$('f-cat').value = 'Gadgets'; $('f-note').value = 'Phone'; $('f-date').value = '2026-11-10';
submit('txn-form');
// nothing billed yet (first statement Nov 25), but limit is held
assert.match($('cc-list').textContent, /₱36,000\.00 in installments not billed yet/);
assert.match($('cc-list').textContent, /₱64,000\.00 available/);
assert.match($('inst-list').textContent, /0 of 12 billed/);
assert.match($('st-expense').textContent, /₱0\.00/);
// jump to Feb 1 2027: Nov, Dec, Jan billed
const st = Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
w = boot('2027-02-01', st); $ = id => w.document.getElementById(id);
assert.match($('inst-list').textContent, /3 of 12 billed/);
assert.match($('cc-list').querySelector('.owed').textContent, /₱9,000\.00/);
assert.match($('cc-list').textContent, /₱27,000\.00 in installments/);
$('t-month').value = ''; fire($('t-month'), 'input');
assert.match($('t-body').textContent, /installment 3\/12/);
// add-on rate math
w.document.querySelector('#type-seg [data-type="expense"]').click();
$('f-amount').value = '10000'; $('f-wallet').value = $('cc-list').querySelector('[data-pay]').dataset.pay; fire($('f-wallet'), 'input');
$('f-inst').checked = true; fire($('f-inst'), 'change');
$('f-inst-months').value = '6'; $('f-inst-rate').value = '0.5'; fire($('f-inst-rate'), 'input');
assert.match($('f-inst-preview').textContent, /₱1,716\.67\/month for 6 months · total ₱10,300\.00 \(₱300\.00 interest\)/);
$('f-inst').checked = false; fire($('f-inst'), 'change');
// ---- plan ----
w.document.querySelector('#nav [data-tab="plan"]').click();
$('pn-name').value = 'Japan'; $('pn-start').value = '2027-04-01'; $('pn-end').value = '2027-04-05'; $('pn-people').value = '2';
submit('plan-form');
assert.match($('plan-span').textContent, /5 days · 4 nights · 2 people/);
const items = [...w.document.querySelectorAll('.plan-item')];
assert.strictEqual(items.length, 8);
const setItem = (i, field, v) => { const el = items[i].querySelector(`[data-if="${field}"]`); if (el.type === 'checkbox') el.checked = v; else el.value = v; fire(el, 'change'); };
setItem(0, 'amount', '15000');          // flights 15k x 2 people = 30k
setItem(1, 'amount', '4000');           // hotel 4k x 4 nights = 16k
// food in JPY: set currency first (rebuilds editor)
const cur = w.document.querySelector('[data-pf="currency"]'); cur.value = 'jpy'; fire(cur, 'change');
const rate = w.document.querySelector('[data-pf="rate"]'); rate.value = '0.4'; fire(rate, 'change');
const items2 = [...w.document.querySelectorAll('.plan-item')];
const food = items2[2]; food.querySelector('[data-if="amount"]').value = '3000'; fire(food.querySelector('[data-if="amount"]'), 'change');
food.querySelector('[data-if="cur"]').value = 'FX'; fire(food.querySelector('[data-if="cur"]'), 'change');
// food: 3000 JPY * 0.4 * 5 days * 2 people = 12,000
assert.strictEqual(w.document.querySelector(`[data-sub="${food.dataset.item}"]`).textContent, '₱12,000.00');
// subtotal 58,000 + 10% buffer = 63,800
assert.match($('plan-summary').textContent, /₱63,800\.00/);
assert.match($('plan-summary').textContent, /₱31,900\.00 per person/);
// goal
$('plan-summary').querySelector('[data-pact="goal"]').click();
assert.match($('plan-summary').textContent, /Goal “Japan”/);
// log spend for flights -> goes to form, returns to plan
w.document.querySelector(`[data-pact="log"][data-item="${items2[0].dataset.item}"]`).click();
assert.strictEqual($('f-amount').value, '30000.00');
$('f-amount').value = '28000'; $('f-wallet').value = w.document.querySelector('#wallet-list [data-rec]').dataset.rec;
submit('txn-form');
assert.ok($('tab-plan').classList.contains('active'), 'back on plan tab');
assert.match($('plan-summary').textContent, /Logged so far₱28,000\.00 of ₱63,800\.00/);
assert.match(w.document.querySelector(`[data-logged="${items2[0].dataset.item}"]`).textContent, /logged ₱28,000\.00/);
$('t-type').value = 'plan'; fire($('t-type'), 'input');
assert.match($('t-body').textContent, /✈ Japan/);
// nav span click works
w.document.querySelector('#nav [data-tab="transactions"] .long').click();
assert.ok($('tab-transactions').classList.contains('active'));
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('installment + plan tests passed'); process.exit(0);
