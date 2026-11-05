// #10 Encrypted sync between two devices
const { JSDOM } = require('jsdom');
const assert = require('assert');
const nodeCrypto = require('crypto');
const { html, dialog } = require('../helpers.cjs');

const errors = [];
const gists = {}; let nextId = 1, writes = 0;
function fakeFetch(url, opts = {}) {
  const u = new URL(url), method = opts.method || 'GET';
  const ok = body => Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) });
  const view = id => ({ id, updated_at: '2026-11-01T00:00:00Z', files: Object.fromEntries(Object.entries(gists[id]).map(([n, c]) => [n, { content: c }])) });
  if (u.pathname === '/gists' && method === 'GET') return ok(Object.keys(gists).map(view));
  if (u.pathname === '/gists' && method === 'POST') {
    const b = JSON.parse(opts.body), id = 'g' + nextId++;
    gists[id] = Object.fromEntries(Object.entries(b.files).map(([n, f]) => [n, f.content]));
    return ok(view(id));
  }
  const id = u.pathname.split('/')[2];
  if (method === 'GET') return ok(view(id));
  writes++;
  const b = JSON.parse(opts.body); for (const [n, f] of Object.entries(b.files)) gists[id][n] = f.content;
  return ok(view(id));
}
function device() {
  return new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
    w.fetch = fakeFetch;
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    Object.defineProperty(w, 'crypto', { value: nodeCrypto.webcrypto, configurable: true });
    w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
    w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
  } }).window;
}
const tick = (ms = 400) => new Promise(r => setTimeout(r, ms));
const file = () => gists.g1['wallet-tracker-me.json'];
const hist = w => { const $ = id => w.document.getElementById(id); $('t-month').value = ''; $('t-month').dispatchEvent(new w.Event('input')); return $('t-body').textContent; };
const addExpense = (w, amount, cat) => { const $ = id => w.document.getElementById(id);
  w.document.querySelector('#type-seg [data-type="expense"]').click(); $('f-amount').value = amount; $('f-cat').value = cat;
  $('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true })); };
const syncNow = async w => { w.document.getElementById('sync-now').click(); await tick(); };

(async () => {
  const pc = device(), $p = id => pc.document.getElementById(id);
  addExpense(pc, '350', 'Coffee');
  $p('sync-token').value = 'tok'; $p('sync-connect').click(); await tick();
  assert.match(file(), /Coffee/, 'plain before encryption');
  assert.match($p('sync-enc-state').textContent, /Not encrypted/);

  // turn on encryption
  $p('sync-enc-btn').click();
  assert.match(dialog(pc, 'short', 'short'), /at least 8/);
  assert.match(dialog(pc, 'secret pass 1', 'secret pass 2'), /don’t match/);
  dialog(pc, 'secret pass 1', 'secret pass 1');
  await tick();
  const env = JSON.parse(file());
  assert.strictEqual(env.enc, 'aes-gcm-v1');
  assert.doesNotMatch(file(), /Coffee|GCash/, 'nothing readable on GitHub');
  assert.match($p('sync-enc-state').textContent, /Encrypted/);
  assert.match($p('sync-badge').textContent, /🔒/);

  // second device links and is asked for the passphrase; it must not write meanwhile
  const ipad = device(), $i = id => ipad.document.getElementById(id);
  $i('sync-token').value = 'tok'; $i('sync-connect').click(); await tick();
  assert.ok(!$i('dlg').hidden, 'asks for the passphrase');
  const before = file(), writesBefore = writes;
  dialog(ipad, 'wrong passphrase');
  await tick();
  assert.match($i('sync-status').textContent, /Wrong passphrase/);
  assert.strictEqual($i('sync-enc-btn').dataset.act, 'unlock');
  assert.strictEqual(file(), before, 'locked device never writes');
  assert.strictEqual(writes, writesBefore);
  $i('sync-enc-btn').click(); dialog(ipad, 'secret pass 1'); await tick(800);
  assert.match(hist(ipad), /Coffee/, 'decrypted the synced data');
  assert.strictEqual(ipad.document.querySelectorAll('#wallet-list .wallet').length, 5, 'replaced, no duplicate default wallets');

  // edits keep flowing both ways, still encrypted
  addExpense(ipad, '120', 'Jeepney'); await tick(2000);
  assert.doesNotMatch(file(), /Jeepney/);
  await syncNow(pc);
  assert.match(hist(pc), /Jeepney/);

  // passphrase changed on the PC: the iPad locks again instead of overwriting
  $p('sync-enc-change').click(); dialog(pc, 'new secret 22', 'new secret 22'); await tick();
  const afterChange = file();
  await syncNow(ipad);
  assert.match($i('sync-status').textContent, /Wrong passphrase/);
  assert.strictEqual(file(), afterChange);

  // encryption turned off on the PC: the iPad simply follows the plain file again
  $p('sync-enc-btn').click(); await tick();
  assert.match(file(), /Coffee/, 'plain again');
  await syncNow(ipad);
  assert.match($i('sync-status').textContent, /Synced/);
  assert.match($i('sync-enc-state').textContent, /Not encrypted/);

  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('encrypted sync tests passed'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
