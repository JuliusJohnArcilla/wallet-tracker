// Shared helpers for the UI tests (jsdom) and layout tests (Playwright).
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// UI tests run against the built app when it exists (CI builds first), else the source page.
const DIST = path.join(ROOT, 'dist', 'index.html');

// The app's HTML with its script inlined, ready for jsdom (which can't load module scripts or
// external files). Chart.js is left out; tests stub window.Chart.
function rawHtml() {
  const file = fs.existsSync(DIST) ? DIST : path.join(ROOT, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<script[^>]*src="[^"]*chart\.umd\.min\.js"[^>]*><\/script>/, '');
  // inline the bundled module script (dist) so jsdom runs it as a classic script
  html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => {
    const js = fs.readFileSync(path.join(path.dirname(file), src), 'utf8');
    return `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
  });
  html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/assets\/[^"]+"[^>]*>/g, '');
  return html;
}

// Most tests start inside an existing profile, so seed one unless the test brings its own
// storage. The sign-up test uses rawHtml() to see the first-run screen.
const SEED = `<script>try{if(!localStorage.getItem('walletTracker.profiles'))localStorage.setItem('walletTracker.profiles','[{"id":"main","name":"Me","pin":""}]')}catch(e){}</script>`;
const html = rawHtml().replace('<head>', '<head>' + SEED);

module.exports = { html, rawHtml, ROOT, DIST };
