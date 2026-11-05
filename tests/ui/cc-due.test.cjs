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
const dump = w => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
const assert = require('assert');
const addCard = (w, name, close, due, owed) => {
  const $ = id => w.document.getElementById(id);
  $('cc-name').value = name; $('cc-limit').value = '50000'; $('cc-owed').value = owed; $('cc-close').value = close; $('cc-due').value = due;
  $('cc-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
};
const tile = (w, name) => [...w.document.querySelectorAll('#cc-list .cc')].find(t => t.textContent.includes(name)).textContent.replace(/\s+/g, ' ');

// A: the reported case — closes 10th, due 30th, added Nov 1 (Oct statement was due Oct 30)
let w = boot('2026-11-01');
addCard(w, 'CardA', 10, 30, '5000');
// B: closes 25th, due 15th, added Nov 1 — Oct 25 statement still due Nov 15
addCard(w, 'CardB', 25, 15, '7000');
assert.doesNotMatch(tile(w, 'CardA'), /overdue/);
assert.match(tile(w, 'CardA'), /Nothing due · next statement Nov 10/);
assert.match(tile(w, 'CardB'), /₱7,000\.00 due Nov 15/);
assert.doesNotMatch(w.document.getElementById('cc-alert').textContent, /CardA/);

// next month: CardA's balance is now on the Nov 10 statement, due Nov 30
w = boot('2026-11-12', dump(w));
assert.match(tile(w, 'CardA'), /₱5,000\.00 due Nov 30/);
// after Nov 30 without payment it's genuinely overdue
w = boot('2026-12-02', dump(w));
assert.match(tile(w, 'CardA'), /overdue by 2 days/);

// C: card saved before this fix (no addedOn) still works from its id timestamp
w = boot('2026-11-01');
addCard(w, 'Old', 10, 30, '3000');
const st = dump(w), data = JSON.parse(st['walletTracker.v1']);
data.wallets.forEach(x => delete x.addedOn); st['walletTracker.v1'] = JSON.stringify(data);
w = boot('2026-11-01', st);
assert.match(tile(w, 'Old'), /Nothing due/);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('due-date tests passed'); process.exit(0);
