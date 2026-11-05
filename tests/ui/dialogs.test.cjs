// #5 In-app dialogs replace the browser's prompt boxes.
const { JSDOM } = require('jsdom');
const assert = require('assert');
const { html, dialog } = require('../helpers.cjs');

const errors = [];
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  w.prompt = () => { errors.push('browser prompt() was used'); return null; };
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id);
const t = el => el.textContent.replace(/\s+/g, ' ');

// Update balance: validation keeps the dialog open; accepts "₱12,500.50"
$('wallet-list').querySelector('[data-rec]').click();
assert.ok(!$('dlg').hidden, 'dialog opens');
assert.match($('dlg-title').textContent, /Update GCash/);
assert.match(dialog(w, 'abc'), /Enter an amount/);
assert.ok(!$('dlg').hidden, 'stays open on bad input');
dialog(w, '₱12,500.50');
assert.ok($('dlg').hidden, 'closes after saving');
assert.match(t($('wallet-list').querySelector('.wallet')), /₱12,500\.50/);

// Cancel and Escape close without changing anything
$('wallet-list').querySelector('[data-rec]').click();
$('dlg-cancel').click();
assert.ok($('dlg').hidden);
$('wallet-list').querySelector('[data-rec]').click();
w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));
assert.ok($('dlg').hidden);
assert.match(t($('wallet-list').querySelector('.wallet')), /₱12,500\.50/);

// Wallet rename + starting balance (Settings)
$('w-body').querySelector('[data-act="rename"]').click();
dialog(w, 'GCash Personal');
$('w-body').querySelector('[data-act="opening"]').click();
dialog(w, '1000');
assert.match(t($('w-body')), /GCash Personal/);
assert.match(t($('wallet-list').querySelector('.wallet')), /₱13,500\.50/, 'opening + adjustment');

// Goal: add and withdraw
$('g-name').value = 'Laptop'; $('g-target').value = '50000';
$('goal-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
$('goal-list').querySelector('[data-act="add"]').click();
assert.match(dialog(w, '0'), /above zero/);
dialog(w, '5000');
$('goal-list').querySelector('[data-act="withdraw"]').click();
dialog(w, '1200');
assert.match(t($('goal-list')), /₱3,800\.00 \/ ₱50,000\.00/);

// Monthly amount change
w.document.querySelector('#type-seg [data-type="expense"]').click();
$('f-amount').value = '999'; $('f-cat').value = 'Netflix'; $('f-repeat').checked = true;
$('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
$('recur-list').querySelector('[data-act="amount"]').click();
dialog(w, '549');
assert.match(t($('recur-list')), /Netflix −₱549\.00/);

// PIN: mismatch is rejected, matching PIN is saved
$('pf-pin').click();
assert.match(dialog(w, '1234', '9999'), /don’t match/);
assert.match(dialog(w, '12', '12'), /4 to 8 digits/);
dialog(w, '4321', '4321');
setTimeout(() => {
  assert.match($('pf-pin-state').textContent, /PIN on/);
  // Profile rename
  $('pf-rename').click();
  dialog(w, 'Julius');
  assert.strictEqual($('pf-name').textContent, 'Julius');
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('dialog tests passed'); process.exit(0);
}, 100);
