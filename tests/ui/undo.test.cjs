// #4 Undo after delete
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
const data = () => JSON.parse(w.localStorage.getItem('walletTracker.v1'));

$('wallet-list').querySelector('[data-rec]').click(); dialog(w, '5000');
w.document.querySelector('#type-seg [data-type="expense"]').click();
$('f-amount').value = '350'; $('f-cat').value = 'Coffee';
$('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match(t($('wallet-list').querySelector('.wallet')), /₱4,650\.00/);

// delete the coffee entry: no confirm box, toast offers Undo
w.confirm = () => { throw new Error('should not ask for a plain delete'); };
const row = [...$('t-body').querySelectorAll('tr')].find(r => r.textContent.includes('Coffee'));
row.querySelector('[data-act="del"]').click();
assert.ok(!$('toast').hidden);
assert.match($('toast-msg').textContent, /Entry deleted/);
assert.doesNotMatch(t($('t-body')), /Coffee/);
assert.match(t($('wallet-list').querySelector('.wallet')), /₱5,000\.00/);
const deletedId = Object.keys(data().deleted)[0];
assert.ok(deletedId, 'tombstone saved');

$('toast-btn').click();
assert.match(t($('t-body')), /Coffee/, 'entry is back');
assert.match(t($('wallet-list').querySelector('.wallet')), /₱4,650\.00/);
assert.ok(!(deletedId in data().deleted), 'tombstone removed');
assert.match($('toast-msg').textContent, /restored/);

// goals restore together with their history
$('g-name').value = 'Bike'; $('g-target').value = '20000';
$('goal-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
$('goal-list').querySelector('[data-act="add"]').click(); dialog(w, '1500');
$('goal-list').querySelector('[data-act="del"]').click();
assert.doesNotMatch(t($('goal-list')), /Bike/);
$('toast-btn').click();
assert.match(t($('goal-list')), /Bike.*₱1,500\.00/);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('undo tests passed'); process.exit(0);
