const { JSDOM } = require('jsdom');
const { html } = require('../helpers.cjs');
const errors = [];
const gists = {}; let nextId = 1;
function fakeFetch(url, opts = {}) {
  const u = new URL(url), method = opts.method || 'GET';
  const ok = body => Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) });
  const view = id => ({ id, updated_at: gists[id].updated_at, files: Object.fromEntries(Object.entries(gists[id].files).map(([n, c]) => [n, { content: c }])) });
  if (u.pathname === '/gists' && method === 'GET') return ok(Object.keys(gists).map(view));
  if (u.pathname === '/gists' && method === 'POST') {
    const b = JSON.parse(opts.body), id = 'g' + nextId++;
    gists[id] = { files: Object.fromEntries(Object.entries(b.files).map(([n, f]) => [n, f.content])), updated_at: new Date().toISOString() };
    return ok(view(id));
  }
  const id = u.pathname.split('/')[2];
  if (method === 'GET') return ok(view(id));
  const b = JSON.parse(opts.body); for (const [n, f] of Object.entries(b.files)) gists[id].files[n] = f.content;
  gists[id].updated_at = new Date().toISOString(); return ok(view(id));
}
function boot(storage = {}) {
  return new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.github.io/w/', beforeParse(w) {
    w.fetch = fakeFetch; w.Chart = class { destroy() {} }; w.matchMedia = () => ({ matches: false, addEventListener() {} });
    w.HTMLElement.prototype.scrollIntoView = () => {}; w.confirm = () => true;
    w.createImageBitmap = undefined;
    Object.entries(storage).forEach(([k, v]) => w.localStorage.setItem(k, v));
    w.addEventListener('error', e => errors.push(e.error?.stack || e.message)); w.alert = m => errors.push('alert ' + m);
  } }).window;
}
const dump = w => Object.fromEntries(Object.keys(w.localStorage).map(k => [k, w.localStorage.getItem(k)]));
const tick = () => new Promise(r => setTimeout(r, 50));
const assert = require('assert');
(async () => {
  // migration: an old per-device prefs key is carried into the profile's data
  let w = boot({ 'walletTracker.v1.prefs': JSON.stringify({ accent: '#9b6a5b', card: '#80916d', border: false }) });
  let $ = id => w.document.getElementById(id);
  let data = JSON.parse(w.localStorage.getItem('walletTracker.v1'));
  assert.strictEqual(data.prefs.accent, '#9b6a5b'); assert.strictEqual(data.prefs.u, 0);
  assert.strictEqual(w.document.documentElement.style.getPropertyValue('--accent'), '#9b6a5b');
  assert.match($('pref-style').textContent, /--surface: #80916d/);
  assert.match($('pref-style').textContent, /--border-w: 0px/, 'old outlines-off setting carries over');
  assert.ok($('personalize').querySelector('[data-pref="outline"][data-val="none"]').classList.contains('active'));

  // panel tabs
  assert.ok(!$('personalize').querySelector('[data-pane="colors"].pz-pane').hidden);
  $('pz-tabs').querySelector('[data-pane="cards"]').click();
  assert.ok($('personalize').querySelector('.pz-pane[data-pane="colors"]').hidden);
  assert.ok(!$('personalize').querySelector('.pz-pane[data-pane="cards"]').hidden);

  const click = sel => $('personalize').querySelector(sel).click();
  click('[data-pref="radius"][data-val="round"]');
  click('[data-pref="shadow"][data-val="soft"]');
  click('[data-pref="chart"][data-val="bold"]');
  click('[data-pref="font"][data-val="serif"]');
  click('[data-pref="size"][data-val="1.1"]');
  click('[data-pref="density"][data-val="compact"]');
  click('[data-pref="outline"][data-val="thick"]');
  const css = $('pref-style').textContent;
  assert.match(css, /--r-lg: 24px/); assert.match(css, /--shadow: 0 1px 3px/); assert.match(css, /--border-w: 2px/);
  assert.match(css, /--pad: 12px/); assert.match(css, /--font: Lora/);
  assert.match(css, /--series-1: #2a78d6; --series-2: #eb6834/, 'bold chart pair on page');
  assert.match(css, /--surface: #80916d;.*--series-1: #2a78d6/s, 'bold pair inside custom cards too');
  assert.strictEqual(String($('app').style.zoom), '1.1');
  assert.ok(w.document.querySelector('link[data-font="serif"]'), 'serif font loaded');
  assert.ok($('personalize').querySelector('[data-pref="radius"][data-val="round"]').classList.contains('active'));

  // background preset + blur
  $('bg-presets').querySelector('[data-preset="3"]').click();
  assert.ok(w.document.body.classList.contains('has-bg'));
  assert.ok(!$('bg-adjust').hidden);
  const blur = $('personalize').querySelector('[data-range="blur"]'); blur.value = '8';
  blur.dispatchEvent(new w.Event('input', { bubbles: true })); blur.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.strictEqual($('bg').style.filter, 'blur(8px)');
  assert.strictEqual($('pz-bg').style.backgroundImage, $('bg').style.backgroundImage, 'preview mirrors background');

  // overview sections: hide loans, move charts to the top
  const loansToggle = $('sec-list').querySelector('[data-sec-toggle="loans"]'); loansToggle.checked = false;
  loansToggle.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.ok(w.document.querySelector('[data-sec="loans"]').classList.contains('sec-off'));
  for (let up; !(up = $('sec-list').querySelector('[data-sec-move="charts"][data-dir="-1"]')).disabled;) up.click();
  assert.strictEqual(w.document.querySelector('[data-sec="charts"]').style.order, '1');
  assert.ok($('sec-list').querySelector('[data-sec-move="charts"][data-dir="-1"]').disabled);

  // privacy + eye
  const priv = $('personalize').querySelector('[data-check="privacy"]'); priv.checked = true; priv.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.ok(w.document.body.classList.contains('privacy'));
  $('eye').click(); assert.ok(!w.document.body.classList.contains('privacy'), 'eye reveals for the session');

  // start tab
  const st = $('personalize').querySelector('[data-select="startTab"]'); st.value = 'plan'; st.dispatchEvent(new w.Event('change', { bubbles: true }));
  data = JSON.parse(w.localStorage.getItem('walletTracker.v1'));
  assert.strictEqual(data.prefs.startTab, 'plan'); assert.ok(data.prefs.u > 0, 'stored in profile data with a timestamp');
  w = boot(dump(w)); $ = id => w.document.getElementById(id);
  assert.ok($('tab-plan').classList.contains('active'), 'opens on the chosen tab');
  assert.ok(w.document.body.classList.contains('privacy'), 'amounts hidden on open');
  assert.match($('pref-style').textContent, /--font: Lora/, 'look persists');

  // reset all
  $('pz-reset').click();
  assert.match($('pref-style').textContent, /--r-lg: 14px/);
  assert.ok(!w.document.body.classList.contains('has-bg'));

  // ---- sync: the look follows the profile to another device ----
  const pc = boot(), ipad = boot();
  pc.document.getElementById('sync-token').value = 'tok'; pc.document.getElementById('sync-connect').click(); await tick(); await tick();
  ipad.document.getElementById('sync-token').value = 'tok'; ipad.document.getElementById('sync-connect').click(); await tick(); await tick();
  pc.document.getElementById('personalize').querySelector('[data-pref="theme"][data-val="dark"]').click();
  pc.document.getElementById('accent-swatches').querySelector('[data-accent="#4f6d7a"]').click();
  await new Promise(r => setTimeout(r, 1800));
  ipad.dispatchEvent(new ipad.Event('focus')); await tick(); await tick();
  assert.strictEqual(ipad.document.documentElement.dataset.theme, 'dark', 'theme synced to iPad');
  assert.strictEqual(ipad.document.documentElement.style.getPropertyValue('--accent'), '#4f6d7a', 'accent synced to iPad');
  assert.ok(ipad.document.getElementById('personalize').querySelector('[data-pref="theme"][data-val="dark"]').classList.contains('active'), 'iPad panel shows synced choice');

  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  console.log('personalize tests passed');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
