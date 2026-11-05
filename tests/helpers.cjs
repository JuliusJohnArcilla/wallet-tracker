// Shared helpers for the UI tests (jsdom) and layout tests (Playwright).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// UI tests run against the built app when it exists (CI builds first), else the source page.
const DIST = path.join(ROOT, 'dist', 'index.html');

// The app's HTML with its script inlined, ready for jsdom (which can't load module scripts or
// external files). Chart.js is left out; tests stub window.Chart.
function rawHtml() {
  if (!fs.existsSync(DIST)) throw new Error('No build found: run "npm run build" before the tests (or "npm run check").');
  let html = fs.readFileSync(DIST, 'utf8');
  html = html.replace(/<script[^>]*src="[^"]*chart\.umd\.min\.js"[^>]*><\/script>/, '');
  // Inline the bundled module script so jsdom runs it. Module scripts wait for the page, so put
  // it at the end of <body> to keep that order.
  const bundles = [];
  html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
    bundles.push(fs.readFileSync(path.join(path.dirname(DIST), src), 'utf8'));
    return '';
  });
  // (a replacer function, so "$&"-style sequences in the minified code aren't treated as patterns)
  const inline = bundles.map(js => `<script>${js.replace(/<\/script/gi, () => '<\\/script')}</script>`).join('');
  html = html.replace('</body>', () => inline + '</body>');
  html = html.replace(/<link rel="(stylesheet|modulepreload)"[^>]*href="\.\/assets\/[^"]+"[^>]*>/g, '');
  return html;
}

// Most tests start inside an existing profile, so seed one unless the test brings its own
// storage. The sign-up test uses rawHtml() to see the first-run screen.
const SEED = `<script>try{if(!localStorage.getItem('walletTracker.profiles'))localStorage.setItem('walletTracker.profiles','[{"id":"main","name":"Me","pin":""}]')}catch(e){}</script>`;
const html = rawHtml().replace('<head>', '<head>' + SEED);

// Answer the in-app dialog that's open in window w: fill its fields in order and submit.
function dialog(w, ...values) {
  const d = w.document.getElementById('dlg');
  if (d.hidden) throw new Error('No dialog is open');
  const inputs = [...d.querySelectorAll('#dlg-fields input')];
  values.forEach((v, i) => { inputs[i].value = v; });
  w.document.getElementById('dlg-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  return w.document.getElementById('dlg-error').textContent;
}

module.exports = { html, rawHtml, dialog, ROOT, DIST };
