// #2 Calendar (.ics) export
const { JSDOM } = require('jsdom');
const assert = require('assert');
const { html } = require('../helpers.cjs');

const errors = [];
let blob = null, fileName = '';
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
  const R = w.Date, FIX = new R('2026-11-05T12:00:00');
  w.Date = class extends R { constructor(...a) { super(...(a.length ? a : [FIX.getTime()])); } static now() { return FIX.getTime(); } };
  w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
  w.URL.createObjectURL = b => { blob = b; return 'blob:test'; }; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () { fileName = this.download; };
  w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
} }).window;
const $ = id => w.document.getElementById(id);
const sub = id => $(id).dispatchEvent(new w.Event('submit', { cancelable: true }));
const fire = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));

assert.ok($('ics-export').disabled, 'nothing to export yet');
// card closes 25th, due 15th, owes 12,450 from the Oct statement
$('cc-name').value = 'BPI Amore'; $('cc-limit').value = '80000'; $('cc-owed').value = '12450'; $('cc-close').value = '25'; $('cc-due').value = '15'; sub('cc-form');
// monthly bill on the 20th
w.document.querySelector('#type-seg [data-type="expense"]').click();
$('f-amount').value = '1899'; $('f-cat').value = 'Internet'; $('f-date').value = '2026-11-20'; $('f-repeat').checked = true; sub('txn-form');
// loan repaid monthly x3 starting Dec 1
$('loan-new-btn').click(); $('ln-person').value = 'Ana'; $('ln-amount').value = '3000';
$('ln-plan').value = 'periodic'; fire($('ln-plan'), 'change'); $('ln-freq').value = 'monthly'; $('ln-count').value = '3'; $('ln-first').value = '2026-12-01';
sub('loan-form');

assert.match($('ics-info').textContent, /27 reminders to export/);
$('ics-export').click();
assert.match(fileName, /^wallet-tracker-reminders-me\.ics$/);
const reader = new w.FileReader();
reader.onload = () => check(reader.result);
reader.readAsText(blob);
function check(ics) {
  // events in date order; each summary is checked on the event that starts on that date
  const events = ics.split('BEGIN:VEVENT').slice(1);
  const on = date => events.filter(e => e.includes(`DTSTART;VALUE=DATE:${date}`)).map(e => e.match(/SUMMARY:(.*)\r\n/)[1]);
  assert.strictEqual(events.length, 27);
  assert.deepStrictEqual(on('20261115'), [String.raw`BPI Amore payment due ₱12\,450.00`], 'first card due date with the amount');
  assert.deepStrictEqual(on('20261215'), ['BPI Amore payment due'], 'later card due dates without an amount');
  assert.deepStrictEqual(on('20261120'), [String.raw`Internet ₱1\,899.00`]);
  assert.deepStrictEqual(on('20270201'), [String.raw`Ana should pay you ₱1\,000.00`]);
  assert.match($('ics-info').textContent, /last downloaded/);
  assert.match($('toast-msg').textContent, /27 reminders/);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('calendar export tests passed'); process.exit(0);
}
