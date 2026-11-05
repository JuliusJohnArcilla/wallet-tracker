// #6 Sign-up / welcome screen
const { JSDOM } = require('jsdom');
const assert = require('assert');
const { rawHtml } = require('../helpers.cjs');

const html = rawHtml();   // no seeded profile: a brand-new install
const errors = [];
const gists = {};
function fakeFetch(url, opts = {}) {
  const u = new URL(url), method = opts.method || 'GET';
  const ok = body => Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) });
  const view = id => ({ id, updated_at: '2026-11-01T00:00:00Z', files: Object.fromEntries(Object.entries(gists[id]).map(([n, c]) => [n, { content: c }])) });
  if (u.pathname === '/gists' && method === 'GET') return ok(Object.keys(gists).map(view));
  const id = u.pathname.split('/')[2];
  if (method === 'GET') return ok(view(id));
  const b = JSON.parse(opts.body); for (const [n, f] of Object.entries(b.files)) gists[id][n] = f.content;
  return ok(view(id));
}
function open(storage = {}, session = {}) {
  return new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
    w.fetch = fakeFetch;
    w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
    Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
    Object.entries(session).forEach(([k, v]) => w.sessionStorage.setItem(k, v));
    w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
  } }).window;
}
const dump = s => Object.fromEntries(Object.keys(s).map(k => [k, s.getItem(k)]));
const tick = (ms = 60) => new Promise(r => setTimeout(r, ms));
const t = el => el.textContent.replace(/\s+/g, ' ');

(async () => {
  // ---- first run: sign up with a PIN and two wallets ----
  let w = open(), $ = id => w.document.getElementById(id);
  assert.strictEqual($('signup').hidden, false, 'welcome screen on first run');
  assert.strictEqual($('app').hidden, true);
  assert.strictEqual($('su-title').textContent, 'Welcome to Wallet Tracker');
  assert.ok($('su-cancel').hidden, 'nothing to cancel back to');

  $('su-next').click();
  assert.match($('su-err1').textContent, /Enter your name/);
  $('su-name').value = 'Julius';
  $('su-pin-on').checked = true; $('su-pin-on').dispatchEvent(new w.Event('change'));
  $('su-pin-a').value = '1234'; $('su-pin-b').value = '9999'; $('su-next').click();
  assert.match($('su-err1').textContent, /don’t match/);
  $('su-pin-b').value = '1234'; $('su-next').click();
  assert.strictEqual(w.document.querySelector('.su-step[data-step="2"]').hidden, false, 'on to wallets');

  // untick everything except GCash and Maya, give balances, add a custom wallet
  for (const i of [2, 3, 4]) {   // the list redraws after each change, so look each box up fresh
    const b = $('su-wallets').querySelector(`[data-i="${i}"]`);
    b.checked = false; b.dispatchEvent(new w.Event('change', { bubbles: true }));
  }
  const bal = i => $('su-wallets').querySelector(`[data-bal="${i}"]`);
  bal(0).value = '₱12,500.50'; bal(0).dispatchEvent(new w.Event('input', { bubbles: true }));
  bal(1).value = 'abc'; bal(1).dispatchEvent(new w.Event('input', { bubbles: true }));
  $('su-new-wallet').value = 'BPI Savings'; $('su-add-wallet').click();
  $('su-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await tick();
  assert.match($('su-err2').textContent, /Check the balance for Maya/);
  bal(1).value = '800'; bal(1).dispatchEvent(new w.Event('input', { bubbles: true }));
  $('su-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await tick();

  const st = dump(w.localStorage), ses = dump(w.sessionStorage);
  const profiles = JSON.parse(st['walletTracker.profiles']);
  assert.deepStrictEqual(profiles.map(p => [p.id, p.name, !!p.pin]), [['main', 'Julius', true]]);
  const data = JSON.parse(st['walletTracker.v1']);
  assert.deepStrictEqual(data.wallets.map(x => [x.name, x.opening]), [['GCash', 12500.5], ['Maya', 800], ['BPI Savings', 0]]);

  // the app opens on that profile with those balances
  w = open(st, ses); $ = id => w.document.getElementById(id);
  assert.strictEqual($('app').hidden, false);
  assert.match(t($('st-total')), /₱13,300\.50/);
  assert.match($('sync-badge').textContent, /Julius/);
  assert.match($('pf-pin-state').textContent, /PIN on/);

  // ---- second device: restore from sync ----
  gists.g1 = { 'wallet-tracker-julius.json': JSON.stringify({ ...data, txns: [{ id: 'x', type: 'expense', amount: 300, walletId: data.wallets[0].id,
    category: 'Food', date: '2026-11-01', note: 'from the phone', u: 5 }] }) };
  let d2 = open(), $2 = id => d2.document.getElementById(id);
  $2('su-name').value = 'Julius';
  $2('su-restore-link').click();
  assert.strictEqual(d2.document.querySelector('.su-step[data-step="restore"]').hidden, false);
  assert.strictEqual($2('su-r-name').value, 'Julius', 'name carried over');
  $2('su-restore').click();
  assert.match($2('su-err3').textContent, /Paste your GitHub token/);
  $2('su-token').value = 'tok';
  $2('su-restore').click();
  await tick();
  const st2 = dump(d2.localStorage), ses2 = dump(d2.sessionStorage);
  assert.strictEqual(ses2['walletTracker.pendingRestore'], 'tok');
  d2 = open(st2, ses2); $2 = id => d2.document.getElementById(id);
  await tick(150);
  assert.strictEqual(d2.sessionStorage.getItem('walletTracker.pendingRestore'), null, 'token used once');
  assert.match($2('sync-detail').textContent, /wallet-tracker-julius\.json \(Gist g1\)/);
  assert.match(t($2('st-total')), /₱13,000\.50/, 'restored balances and entries from the other device');

  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('sign-up tests passed'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
