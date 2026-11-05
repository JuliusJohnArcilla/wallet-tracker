// #8 Backup reminder + storage warning
const { JSDOM } = require('jsdom');
const assert = require('assert');
const { html } = require('../helpers.cjs');

const errors = [];
let downloaded = '';
const DAY = 864e5, NOW = new Date('2026-11-05T12:00:00').getTime();
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  const R = w.Date;
  w.Date = class extends R { constructor(...a) { super(...(a.length ? a : [NOW])); } static now() { return NOW; } };
  w.localStorage.setItem('walletTracker.v1.lastBackup', '0');   // never backed up
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { downloaded = this.download; };
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id);
const t = el => el.textContent.replace(/\s+/g, ' ');

// a brand-new profile has nothing to lose: no reminder
assert.ok($('cc-alert').hidden);
w.document.querySelector('#type-seg [data-type="expense"]').click();
$('f-amount').value = '100'; $('f-cat').value = 'Food';
$('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.ok(!$('cc-alert').hidden);
assert.match(t($('cc-alert')), /Back up your data.*it hasn’t been backed up yet/);

// "Export now" downloads the backup and clears the reminder
$('cc-alert').querySelector('[data-backup="export"]').click();
assert.match(downloaded, /^wallet-tracker-me-2026-11-05\.json$/);
assert.ok($('cc-alert').hidden);
assert.strictEqual(w.localStorage.getItem('walletTracker.v1.lastBackup'), String(NOW));

// 31 days later it comes back, and "Remind me in a week" snoozes it
w.localStorage.setItem('walletTracker.v1.lastBackup', String(NOW - 31 * DAY));
$('t-month').dispatchEvent(new w.Event('input'));   // any re-render
$('wallet-list').querySelector('[data-rec]').click();
$('dlg-cancel').click();
w.document.querySelector('#type-seg [data-type="expense"]').click();
$('f-amount').value = '50'; $('f-cat').value = 'Food';
$('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match(t($('cc-alert')), /your last backup was 31 days ago/);
$('cc-alert').querySelector('[data-backup="later"]').click();
assert.ok($('cc-alert').hidden, 'snoozed');
assert.strictEqual(w.localStorage.getItem('walletTracker.v1.backupSnooze'), String(NOW + 7 * DAY));

// storage warning when localStorage is over 80% of ~5 MB
w.localStorage.setItem('walletTracker.v1.bigphoto', 'x'.repeat(2.2 * 1024 * 1024));   // ~4.4 MB as UTF-16
$('f-amount').value = '25'; $('f-cat').value = 'Food';
$('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
assert.match(t($('cc-alert')), /Browser storage is almost full \(4\.\d of about 5 MB\)/);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('backup reminder tests passed'); process.exit(0);
