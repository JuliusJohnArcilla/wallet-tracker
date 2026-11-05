# Architecture

## Stack

- **App:** a single-page PWA in plain JavaScript (no framework). Chart.js 4.4.1 for charts (loaded as a global from `public/vendor/`).
- **Build:** Vite. `index.html` + `src/` → `dist/`. `base: './'` so it works under `/wallet-tracker/` on Pages.
- **Hosting:** GitHub Pages, deployed by GitHub Actions (`.github/workflows/deploy.yml`) only after tests pass.
- **Tests:** Node's built-in test runner (`node --test`).
  - Unit tests (`tests/unit/*.test.mjs`) import the pure modules in `src/lib/` directly.
  - UI tests (`tests/ui/*.test.cjs`) run the built app in jsdom (a simulated browser).
  - Layout test (`tests/layout/*.test.cjs`) runs the built app in headless Chromium (Playwright) at phone widths and fails on sideways overflow.

## Why this shape

- **Option A first (tests + CI)** so every later change is checked before it reaches the live site.
- **Option B (Vite + modules)** moves the pure logic — dates and money formatting, sync merge, loan and installment schedules, budgets, calendar export, encryption — into `src/lib/` where it can be unit-tested. The screen wiring stays in `src/main.js` for now; splitting it further is on the "Later" list.
- **No server**: everything runs in the browser; sync uses the user's own GitHub Gist.

## Folder layout

```
index.html              page markup (Vite entry)
src/
  main.js               app wiring: rendering, events, profiles, sync, personalization
  styles.css            all styles
  lib/
    format.js           pad, peso, esc, date helpers, round2
    merge.js            normalize, merge, sig (sync conflict resolution)
    schedule.js         loan and installment schedules
    budget.js           budget progress
    summary.js          monthly summary
    ics.js              calendar (.ics) export
    crypto.js           AES-GCM encrypt/decrypt with a passphrase
public/                 copied as-is: sw.js, manifest, icons, vendor/chart.umd.min.js
tests/                  unit, ui, layout tests + helpers
.github/workflows/      deploy.yml
docs/                   spec, architecture, integrations, tasks
contracts/              sync-data.schema.json
```

## Data model (per profile, stored in localStorage and the synced Gist)

See `contracts/sync-data.schema.json`. Collections are arrays of records with `id` and `u` (last-modified ms):
`wallets, txns, goals, goalEntries, recurring, installments, plans, loans, budgets`, plus `deleted` (id → deleted-at ms) and `prefs` (the profile's look).

**Merge rule:** for each id the record with the higher `u` wins. A tombstone hides a record only if the tombstone is newer than the record's `u`; so restoring with Undo (which sets a fresh `u`) beats an older delete.

## Key decisions

- **Cache versioning:** the service worker is registered as `sw.js?v=<build id>`; a new build id triggers an update and a new cache. The build id is the commit SHA in CI, `dev` locally.
- **Encrypted sync format:** `{ "enc": "aes-gcm-v1", "salt": b64, "iv": b64, "data": b64 }`, key from PBKDF2-SHA-256 (250,000 iterations). Never write to a Gist that is encrypted when this device can't decrypt it.
- **Undo:** snapshot before delete, restore the missing records with a fresh `u` and drop their tombstones.
