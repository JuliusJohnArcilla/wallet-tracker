// Phone layout check in real headless Chromium: no tab or Personalize pane may make the page
// scroll sideways, and nothing may stick out of its card. Runs at 360px and 390px.
const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { DIST } = require('../helpers.cjs');

const SITE = path.dirname(DIST);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

function serve() {
  const server = http.createServer((req, res) => {
    const p = path.join(SITE, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = fs.existsSync(p) && fs.statSync(p).isDirectory() ? path.join(p, 'index.html') : p;
    if (!file.startsWith(SITE) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, () => r(server)));
}

// Fill the app with realistic data so long names and numbers are on screen.
async function seed(page) {
  await page.evaluate(() => {
    const $ = id => document.getElementById(id);
    const sub = id => $(id).dispatchEvent(new Event('submit', { cancelable: true }));
    const fire = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
    $('cc-name').value = 'BPI Amore Platinum Rewards'; $('cc-limit').value = '80000'; $('cc-owed').value = '12450';
    $('cc-close').value = '25'; $('cc-due').value = '15'; sub('cc-form');
    const add = (type, amt, cat, note) => {
      document.querySelector(`#type-seg [data-type="${type}"]`).click();
      $('f-amount').value = amt; $('f-cat').value = cat; $('f-note').value = note; sub('txn-form');
    };
    add('income', '32000', 'Salary', 'October salary');
    add('expense', '2340.75', 'Groceries', 'SM Supermarket weekly groceries run with a long note');
    $('loan-new-btn').click(); $('ln-person').value = 'Kuya Mark from the office'; $('ln-amount').value = '6000';
    $('ln-due').value = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10); sub('loan-form');
    $('pn-name').value = 'Japan 2027'; $('pn-start').value = '2027-04-01'; $('pn-end').value = '2027-04-06'; sub('plan-form');
    fire(document.body, 'noop');
  });
}

async function overflowReport(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth, out = [];
    document.querySelectorAll('.tab.active *').forEach(el => {
      const b = el.getBoundingClientRect();
      if (!b.width || el.closest('.table-wrap')) return;   // tables scroll sideways on purpose
      const card = el.closest('.card');
      const limit = card && card !== el ? card.getBoundingClientRect().right + 1 : vw + 1;
      if (b.right > limit) out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${String(el.className).trim().replace(/\s+/g, '.')} (${Math.round(b.right)} > ${Math.round(limit)})`);
    });
    return { sideways: document.documentElement.scrollWidth > vw + 1, out };
  });
}

test('no sideways overflow on phones', async () => {
  const server = await serve();
  const browser = await chromium.launch();
  try {
    for (const width of [360, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.addInitScript(() => {
        if (!localStorage.getItem('walletTracker.profiles')) localStorage.setItem('walletTracker.profiles', '[{"id":"main","name":"Me","pin":""}]');
      });
      await page.goto(`http://localhost:${server.address().port}/index.html`);
      await page.waitForSelector('#app:not([hidden])');
      await seed(page);
      const problems = [];
      for (const tab of ['overview', 'transactions', 'plan', 'savings', 'settings']) {
        await page.evaluate(t => document.querySelector(`#nav [data-tab="${t}"]`).click(), tab);
        await page.waitForTimeout(100);
        const r = await overflowReport(page);
        if (r.sideways || r.out.length) problems.push(`${width}px ${tab}: sideways=${r.sideways} ${r.out.slice(0, 5).join(', ')}`);
      }
      for (const pane of ['colors', 'background', 'cards', 'text', 'overview']) {
        await page.evaluate(p => document.querySelector(`#pz-tabs [data-pane="${p}"]`).click(), pane);
        await page.waitForTimeout(50);
        const r = await overflowReport(page);
        if (r.sideways || r.out.length) problems.push(`${width}px personalize/${pane}: sideways=${r.sideways} ${r.out.slice(0, 5).join(', ')}`);
      }
      assert.deepStrictEqual(errors, [], 'page errors');
      assert.deepStrictEqual(problems, [], 'layout overflow:\n' + problems.join('\n'));
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
});
