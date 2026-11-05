const { JSDOM } = require('jsdom');
const { html } = require('../helpers.cjs');
const errors = [];
const gists = {};   // fake GitHub: id -> { files: {name: content}, updated_at }
let nextId = 1;
function fakeFetch(url, opts = {}) {
  const u = new URL(url), method = opts.method || 'GET';
  const ok = body => Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) });
  const view = (id) => ({ id, updated_at: gists[id].updated_at, files: Object.fromEntries(Object.entries(gists[id].files).map(([n, c]) => [n, { content: c, truncated: false }])) });
  if (u.pathname === '/gists' && method === 'GET') return ok(Object.keys(gists).map(view));
  if (u.pathname === '/gists' && method === 'POST') {
    const b = JSON.parse(opts.body), id = 'g' + nextId++;
    gists[id] = { files: Object.fromEntries(Object.entries(b.files).map(([n, f]) => [n, f.content])), updated_at: new Date().toISOString() };
    return ok(view(id));
  }
  const id = u.pathname.split('/')[2];
  if (method === 'GET') return ok(view(id));
  if (method === 'PATCH') { const b = JSON.parse(opts.body); for (const [n, f] of Object.entries(b.files)) gists[id].files[n] = f.content; gists[id].updated_at = new Date().toISOString(); return ok(view(id)); }
}
function device(profileName) {
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
    w.fetch = fakeFetch; w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
    w.localStorage.setItem('walletTracker.profiles', JSON.stringify([{ id: 'main', name: profileName, pin: '' }]));
    w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
  } }).window;
  return w;
}
const tick = () => new Promise(r => setTimeout(r, 50));
const assert = require('assert');
const addExpense = (w, amt, cat) => { const $ = id => w.document.getElementById(id);
  w.document.querySelector('#type-seg [data-type="expense"]').click(); $('f-amount').value = amt; $('f-cat').value = cat;
  $('txn-form').dispatchEvent(new w.Event('submit', { cancelable: true })); };
const hist = w => { const $ = id => w.document.getElementById(id); $('t-month').value = ''; $('t-month').dispatchEvent(new w.Event('input')); return $('t-body').textContent; };
(async () => {
  const pc = device('Me'), ipad = device('iPad');
  // PC connects first -> creates gist; adds an entry
  addExpense(pc, '100', 'Coffee');
  pc.document.getElementById('sync-token').value = 'tok'; pc.document.getElementById('sync-connect').click();
  await tick(); await tick();
  assert.strictEqual(Object.keys(gists).length, 1);
  assert.match(pc.document.getElementById('sync-detail').textContent, /wallet-tracker-me\.json \(Gist g1\)/);
  // simulate a newer app version having added an unknown collection on the remote
  const f = JSON.parse(gists.g1.files['wallet-tracker-me.json']); f.futureThing = [{ id: 'x1', u: 5, v: 'keep me' }];
  gists.g1.files['wallet-tracker-me.json'] = JSON.stringify(f);
  // iPad has a different profile name: single existing file -> offered and linked (confirm=true)
  ipad.document.getElementById('sync-token').value = 'tok'; ipad.document.getElementById('sync-connect').click();
  await tick(); await tick();
  assert.strictEqual(Object.keys(gists).length, 1, 'iPad linked to the existing gist instead of creating one');
  assert.match(ipad.document.getElementById('sync-detail').textContent, /wallet-tracker-me\.json \(Gist g1\)/);
  assert.match(hist(ipad), /Coffee/, 'iPad received PC data');
  // iPad adds an entry -> pushed after debounce
  addExpense(ipad, '250', 'Lunch');
  await new Promise(r => setTimeout(r, 1800));
  assert.match(gists.g1.files['wallet-tracker-me.json'], /Lunch/);
  assert.match(gists.g1.files['wallet-tracker-me.json'], /keep me/, 'unknown collection preserved');
  // PC picks it up when the app comes back to the foreground (pageshow/focus/visibility)
  pc.dispatchEvent(new pc.Event('focus')); await tick(); await tick();
  assert.match(hist(pc), /Lunch/, 'PC received iPad data');
  // Change synced data UI lists the file
  pc.document.getElementById('sync-change').click(); await tick();
  assert.ok(!pc.document.getElementById('sync-pick').hidden);
  assert.match(pc.document.getElementById('sync-files').textContent, /wallet-tracker-me\.json.*\(this device\)/s);
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('two-device sync test passed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
