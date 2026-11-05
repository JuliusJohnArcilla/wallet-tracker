# Wallet Tracker — spec for the "next round" (approved 2026-11-05)

Approved by the owner: features 1–11, stack option A then B.

## Approved features

1. **Budgets per category** — monthly limit per expense category, progress bar on the Overview, warning near the limit (≥80%) and when over.
2. **Calendar export (.ics)** — card payment due dates, loan payments and monthly bills for the next 12 months, with a reminder the day before. Shows when it was last exported on this device.
3. **Search in Transactions** — matches note, category, wallet name and amount; combines with the existing filters.
4. **Undo after delete** — "Deleted · Undo" bar for ~6 seconds after any delete; undo survives a sync that already happened.
5. **In-app dialogs** instead of browser `prompt()` for: Update balance, wallet rename / starting balance, add to / withdraw from a goal, change a monthly amount, profile rename, set PIN.
6. **Sign-up / welcome screen** — first run and "Add profile": name, optional PIN, choose wallets with starting balances, or "I already use Wallet Tracker on another device" (restore from sync with a token).
7. **Monthly summary** — month-to-date spending vs the same days last month, biggest category changes.
8. **Backup reminder + storage warning** — when not syncing and no export in 30 days; when browser storage is nearly full.
9. **Tests in the repo + GitHub Actions** — tests run on every push; Pages is published only when they pass; the cache version is stamped automatically per build.
10. **Encrypted sync (optional)** — passphrase-based AES-GCM encryption of the synced Gist file. Off by default.
11. **Clearer card borders** — stronger default outline; outline None / Thin / Thick in Personalize.

## Non-goals (this round)

- Real email/password accounts or any server-side component.
- Push notifications (needs a push server; calendar export covers reminders).
- Net worth history, live FX rates, recurring transfers (on the "Later" list).
- The card-flip bug — that belongs to a different app.

## Assumptions

- Users: the owner and a few family members, each on their own profile and their own GitHub sync.
- Phone-first PWA, also used on desktop. Hosting: GitHub Pages, ₱0/month.
- Data stays in the browser (localStorage) and, optionally, the user's own secret Gist.

## Owner's notes

- "A then B": first put tests + automated deploy in place (A), then move to a Vite build with modules (B).
