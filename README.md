# Wallet Tracker

A phone-first money tracker for GCash, Maya, GoTyme, MariBank, BanKo and any other wallet, plus credit cards (with installments), loans (with repayment schedules), budgets, trip plans and savings goals. Data stays in your browser; optional sync goes through your own private GitHub Gist.

Live: https://juliusjohnarcilla.github.io/wallet-tracker/

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173 with live reload
```

## Build and test

```bash
npm run check      # build to dist/ and run every test
npm run build      # build only
npm test           # tests only (needs a build in dist/)
npm run test:unit  # fast logic tests, no browser
```

The first time on a new machine, install the browser used by the phone-layout test:

```bash
npx playwright install chromium
```

## How it's deployed

Every push to `main` runs `.github/workflows/deploy.yml`: install → build → test → publish `dist/` to GitHub Pages. If a test fails, nothing is published.

One-time setup in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Project layout

See [docs/architecture.md](docs/architecture.md). In short: `index.html` (markup), `src/main.js` (app), `src/styles.css`, `src/lib/` (pure logic with unit tests), `public/` (service worker, manifest, icons, Chart.js), `tests/`.
