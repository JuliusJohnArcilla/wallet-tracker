# Tasks

## A — tests in the repo + automated deploy
- [x] Add `package.json`, move the existing UI tests into `tests/`, shared test helpers
- [x] GitHub Actions: test → build → deploy to Pages
- [x] Build id stamped into the service worker / version label

## B — Vite + modules
- [x] Vite build (`base: './'`), `public/` for sw, manifest, icons, vendor
- [x] Move CSS to `src/styles.css`, JS to `src/main.js`
- [x] Extract pure logic to `src/lib/` (format, merge, schedule) with unit tests
- [x] UI + layout tests run against the build

## Features
- [x] 11 Clearer card borders (None / Thin / Thick)
- [x] 5 In-app dialogs replacing prompt()
- [x] 4 Undo after delete (merge rule: newer record beats older tombstone)
- [x] 3 Search in Transactions
- [x] 1 Budgets per category
- [x] 7 Monthly summary
- [x] 2 Calendar (.ics) export
- [x] 8 Backup reminder + storage warning
- [x] 6 Sign-up / welcome screen
- [ ] 10 Encrypted sync (optional)

## Wrap-up
- [ ] All tests pass locally and in Actions; phone layout check at 360/390px
- [ ] Owner switches Pages source to GitHub Actions; live site verified

## Later
- Net worth over time (daily snapshots)
- Live currency rates for trip plans
- Split `src/main.js` into feature modules
- Real push notifications (needs a server)
- Recurring transfers
