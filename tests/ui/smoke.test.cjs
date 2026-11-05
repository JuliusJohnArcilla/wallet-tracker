const { JSDOM } = require('jsdom');
const fs = require('fs');
const { html } = require('../helpers.cjs');
const errors = [];
function open(storage = {}, session = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://example.github.io/wallet-tracker/', pretendToBeVisual: true,
    beforeParse(w) {
      w.Chart = class { constructor() {} destroy() {} };
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
      Object.entries(session).forEach(([k, v]) => w.sessionStorage.setItem(k, v));
      w.addEventListener('error', e => errors.push(e.error?.stack || e.message));
      w.location.reload = () => { w.__reloaded = true; };
      w.alert = m => errors.push('alert: ' + m);
      w.confirm = () => true;
      w.HTMLElement.prototype.scrollIntoView = () => {};
    },
  });
  return dom.window;
}
const dump = w => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
const dumpS = w => Object.fromEntries(Object.keys(w.sessionStorage).map(k => [k, w.sessionStorage.getItem(k)]));
const assert = require('assert');

// 1. first run: single profile boots straight into app
let w = open();
const $ = id => w.document.getElementById(id);
assert.strictEqual($('app').hidden, false); assert.strictEqual($('gate').hidden, true);
assert.strictEqual($('wallet-list').querySelectorAll('.wallet').length, 5);

// 2. add monthly expense dated today
$('f-amount').value = '1200'; $('f-cat').value = 'Internet'; $('f-repeat').checked = true;
$('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match($('recur-list').textContent, /Internet/);
assert.match($('st-expense').textContent, /1,200\.00/);
assert.match($('t-body').textContent, /monthly/);

// 3. normal income
w.document.querySelector('#type-seg [data-type="income"]').click();
$('f-amount').value = '5000'; $('f-cat').value = 'Salary';
$('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match($('st-net').textContent, /3,800\.00/);

// 4. personalize
$('bg-presets').querySelector('[data-preset="2"]').click();
assert.ok(w.document.body.classList.contains('has-bg'));
$('accent-swatches').querySelector('[data-accent="#9b6a5b"]').click();
assert.strictEqual(w.document.documentElement.style.getPropertyValue('--accent'), '#9b6a5b');

// 5. add a second profile -> reload requested; reopen with that storage
w.prompt = () => 'Partner';
$('pf-switch').click();
let st = dump(w), ses = dumpS(w);
w = open(st, ses);
assert.strictEqual(w.document.getElementById('gate').hidden, false, 'gate shown on switch');
w.prompt = () => 'Partner';
w.document.getElementById('gate-add').click();
st = dump(w); ses = dumpS(w);
w = open(st, ses);
const $$ = id => w.document.getElementById(id);
assert.strictEqual($$('app').hidden, false);
assert.match($$('sync-badge').textContent, /Partner/);
assert.match($$('st-total').textContent, /₱0\.00/, 'new profile starts empty');
assert.ok(!w.document.body.classList.contains('has-bg'), 'prefs are per profile');

// 6. fresh launch (new session) with 2 profiles -> gate; main still has data
w = open(st, {});
assert.strictEqual(w.document.getElementById('gate').hidden, false);
assert.strictEqual(w.document.querySelectorAll('.profile-tile').length, 2);
const main = JSON.parse(st['walletTracker.v1']);
assert.strictEqual(main.recurring.length, 1); assert.strictEqual(main.txns.length, 2);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('smoke test passed'); process.exit(0);
