import { uid, pad, ymd, today, thisMonth, nextYm, prevYm, dayIn, addDays, daysBetween, daysUntil, lastMonths,
  round2, peso, fmtDate, monthLabel, esc, isLight } from './lib/format.js';
import { COLS, normalize, merge, sig } from './lib/merge.js';
import { loanSchedule, instMonthly, instPayable, instSchedule as instScheduleFor } from './lib/schedule.js';
import { budgetStatus } from './lib/budget.js';
import { monthSummary } from './lib/summary.js';
import { buildIcs } from './lib/ics.js';
import { encryptJson, decryptJson, isEncrypted } from './lib/crypto.js';

(() => {
  // Set by the Vite build to the commit id; a new id makes the service worker update.
  const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';
  const APP_VERSION = 'v14 · ' + BUILD_ID;
  const DEFAULT_WALLETS = ['GCash', 'Maya', 'GoTyme', 'MariBank', 'BanKo'];
  const CATS = {
    expense: ['Food', 'Groceries', 'Transport', 'Bills & Utilities', 'Rent', 'Load & Internet', 'Subscriptions', 'Shopping', 'Health', 'Entertainment', 'Education', 'Family', 'Other'],
    income: ['Salary', 'Freelance', 'Business', 'Allowance', 'Gift', 'Refund', 'Interest', 'Other'],
  };
  const PALETTE = ['#4b4d26', '#80916d', '#9b6a5b', '#613a2b', '#cbb397'];
  const ISLAND_COLORS = ['#fbf7f1', '#ffffff', '#e9dfd0', '#dfe4d4', '#f3e3d3', '#cbb397', '#80916d', '#9b6a5b', '#4b4d26', '#613a2b', '#2e2a21', '#221f18'];
  const ACCENTS = [...PALETTE, '#6b7f4f', '#b5835a', '#8c5b6b', '#4f6d7a', '#c4704f', '#2f3018'];
  const BG_PRESETS = [
    { name: 'Plain', css: '' },
    { name: 'Linen', css: 'linear-gradient(160deg, #f4ede3 0%, #e6d6c1 100%)' },
    { name: 'Sunrise', css: 'linear-gradient(160deg, #fbf7f1 0%, #e9cfae 55%, #c89c8a 100%)' },
    { name: 'Sage mist', css: 'linear-gradient(160deg, #dfe4d4 0%, #b9c4a8 55%, #80916d 100%)' },
    { name: 'Meadow', css: 'radial-gradient(circle at 20% 15%, #f4ede3 0%, #dfe4d4 45%, #a3b38f 100%)' },
    { name: 'Clay dusk', css: 'linear-gradient(160deg, #e8d3c3 0%, #c89c8a 50%, #9b6a5b 100%)' },
    { name: 'Rose clay', css: 'radial-gradient(circle at 80% 10%, #f3e3d3 0%, #d9b3a5 50%, #8c5b6b 100%)' },
    { name: 'Lake', css: 'linear-gradient(160deg, #e3e8e4 0%, #a9bcbf 55%, #4f6d7a 100%)' },
    { name: 'Forest', css: 'linear-gradient(160deg, #80916d 0%, #4b4d26 60%, #2f3018 100%)' },
    { name: 'Cocoa', css: 'linear-gradient(160deg, #9b6a5b 0%, #613a2b 60%, #3a2219 100%)' },
    { name: 'Night', css: 'linear-gradient(160deg, #2e2a21 0%, #1d1a14 60%, #121009 100%)' },
  ];

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); return true; } catch { return false; } },
    del: k => { try { localStorage.removeItem(k); } catch {} },
    json: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  };
  const ss = {
    get: k => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} },
    del: k => { try { sessionStorage.removeItem(k); } catch {} },
  };

  // ---------- dialog ----------
  // ask({ title, message, fields: [{ name, label, value, type, inputmode, placeholder }], ok, validate }, onOk)
  // shows an in-app form and calls onOk(values) when it's submitted. validate(values) may return an
  // error message to keep the dialog open.
  const parseMoney = s => parseFloat(String(s).replace(/[₱,\s]/g, ''));
  let closeDialog = null;
  function ask({ title, message = '', fields = [], ok = 'Save', danger = false, validate }, onOk) {
    closeDialog?.();
    $('dlg-title').textContent = title;
    $('dlg-msg').textContent = message;
    $('dlg-error').textContent = '';
    $('dlg-ok').textContent = ok;
    $('dlg-ok').classList.toggle('danger', danger);
    $('dlg-fields').innerHTML = fields.map(f => `<label>${esc(f.label)}<input name="${f.name}" type="${f.type || 'text'}"
      ${f.inputmode ? `inputmode="${f.inputmode}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''}
      value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" autocomplete="off"></label>`).join('');
    const form = $('dlg-form'), last = document.activeElement;
    $('dlg').hidden = false;
    const first = form.querySelector('input');
    first?.focus(); first?.select?.();
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() {
      $('dlg').hidden = true; form.onsubmit = null; closeDialog = null;
      document.removeEventListener('keydown', onKey);
      last?.focus?.({ preventScroll: true });
    }
    closeDialog = close;
    document.addEventListener('keydown', onKey);
    form.onsubmit = e => {
      e.preventDefault();
      const values = Object.fromEntries(fields.map(f => [f.name, form.elements[f.name].value.trim()]));
      const err = validate?.(values);
      if (err) { $('dlg-error').textContent = err; return; }
      close();
      onOk(values);
    };
  }
  $('dlg-cancel').addEventListener('click', () => closeDialog?.());
  $('dlg').addEventListener('click', e => { if (e.target === $('dlg')) closeDialog?.(); });
  const moneyField = (name, label, value) => ({ name, label, value, inputmode: 'decimal' });
  const needsMoney = (...names) => v => names.some(n => isNaN(parseMoney(v[n]))) ? 'Enter an amount, e.g. 1500 or 1,500.50' : '';

  // ---------- profiles ----------
  // The first profile ("main") keeps the original storage keys, so data from before profiles existed carries over.
  const PROFILES_KEY = 'walletTracker.profiles', CURRENT_KEY = 'walletTracker.current';
  const UNLOCKED_KEY = 'walletTracker.unlocked', GATE_KEY = 'walletTracker.showGate';
  let profiles = ls.json(PROFILES_KEY) || [{ id: 'main', name: 'Me', pin: '' }];
  const saveProfiles = () => ls.set(PROFILES_KEY, JSON.stringify(profiles));
  const dataKeyOf = pid => pid === 'main' ? 'walletTracker.v1' : 'walletTracker.v1.' + pid;
  const avatarColor = p => PALETTE[Math.max(0, profiles.indexOf(p)) % PALETTE.length];
  function paintAvatar(el, p) {
    const bg = avatarColor(p);
    el.textContent = (p.name.trim()[0] || '?').toUpperCase();
    el.style.background = bg;
    el.style.color = isLight(bg) ? '#2b2116' : '#fbf7f1';
  }
  async function hashPin(pid, pin) {
    const text = 'wallet-tracker:' + pid + ':' + pin;
    if (crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 5381; for (const c of text) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
    return 'x' + h.toString(16);
  }
  function enterProfile(pid) {
    ls.set(CURRENT_KEY, pid);
    ss.set(UNLOCKED_KEY, pid);
    ss.del(GATE_KEY);
    location.reload();
  }
  function openGate() { ss.del(UNLOCKED_KEY); ss.set(GATE_KEY, '1'); location.reload(); }
  // ---------- sign-up ----------
  // First run ('first') or "Add profile" ('add'): name, optional PIN, wallets with starting balances,
  // or restore from another device with a GitHub token (synced after the profile opens).
  const RESTORE_KEY = 'walletTracker.pendingRestore';
  function showSignup(mode) {
    $('gate').hidden = true;
    $('signup').hidden = false;
    $('su-title').textContent = mode === 'first' ? 'Welcome to Wallet Tracker' : 'New profile';
    $('su-intro').hidden = mode !== 'first';
    $('su-cancel').hidden = mode === 'first';
    const step = s => {
      document.querySelectorAll('.su-step').forEach(el => { el.hidden = el.dataset.step !== String(s); });
      document.querySelector(`.su-step[data-step="${s}"] input:not([type="checkbox"])`)?.focus();
    };
    const wallets = DEFAULT_WALLETS.map(name => ({ name, on: true, bal: '' }));
    const renderWallets = () => {
      $('su-wallets').innerHTML = wallets.map((w, i) => `<div class="su-wallet">
        <input type="checkbox" id="su-w-${i}" data-i="${i}" ${w.on ? 'checked' : ''}>
        <label for="su-w-${i}">${esc(w.name)}</label>
        <input inputmode="decimal" data-bal="${i}" value="${esc(w.bal)}" placeholder="₱0.00" ${w.on ? '' : 'disabled'} aria-label="${esc(w.name)} balance">
      </div>`).join('');
    };
    renderWallets();
    $('su-wallets').onchange = e => { const i = e.target.dataset.i; if (i !== undefined) { wallets[i].on = e.target.checked; renderWallets(); } };
    $('su-wallets').oninput = e => { const i = e.target.dataset.bal; if (i !== undefined) wallets[i].bal = e.target.value; };
    $('su-add-wallet').onclick = () => {
      const name = $('su-new-wallet').value.trim(); if (!name) return;
      wallets.push({ name, on: true, bal: '' }); $('su-new-wallet').value = ''; renderWallets();
    };
    $('su-pin-on').onchange = () => { $('su-pin').hidden = !$('su-pin-on').checked; };
    document.querySelectorAll('[data-su-back]').forEach(b => { b.onclick = () => step(1); });
    $('su-cancel').onclick = () => { $('signup').hidden = true; showGate(); };

    const checkFirst = () => {
      const name = $('su-name').value.trim(), pinOn = $('su-pin-on').checked, a = $('su-pin-a').value;
      if (!name) return 'Enter your name.';
      if (pinOn && !/^\d{4,8}$/.test(a)) return 'The PIN should be 4 to 8 digits.';
      if (pinOn && a !== $('su-pin-b').value) return 'The two PINs don’t match.';
      return '';
    };
    $('su-next').onclick = () => { const err = checkFirst(); $('su-err1').textContent = err; if (!err) step(2); };
    $('su-restore-link').onclick = () => { $('su-r-name').value = $('su-name').value.trim(); $('su-err3').textContent = ''; step('restore'); };

    const create = async (name, pin) => {
      const p = { id: mode === 'first' ? 'main' : uid(), name, pin: '' };
      if (pin) p.pin = await hashPin(p.id, pin);
      profiles = mode === 'first' ? [p] : [...profiles, p];
      saveProfiles();
      return p.id;
    };
    $('su-form').onsubmit = async e => {
      e.preventDefault();
      const chosen = wallets.filter(w => w.on);
      const bad = chosen.find(w => w.bal.trim() && isNaN(parseMoney(w.bal)));
      if (!chosen.length) { $('su-err2').textContent = 'Pick at least one wallet.'; return; }
      if (bad) { $('su-err2').textContent = `Check the balance for ${bad.name}.`; return; }
      const pid = await create($('su-name').value.trim(), $('su-pin-on').checked ? $('su-pin-a').value : '');
      const opened = Date.now();
      ls.set(dataKeyOf(pid), JSON.stringify(normalize({ wallets: chosen.map(w => ({ id: uid(), name: w.name,
        opening: round2(parseMoney(w.bal) || 0), u: opened })) })));
      enterProfile(pid);
    };
    $('su-restore').onclick = async () => {
      const name = $('su-r-name').value.trim(), token = $('su-token').value.trim();
      if (!name) { $('su-err3').textContent = 'Enter your name.'; return; }
      if (!token) { $('su-err3').textContent = 'Paste your GitHub token.'; return; }
      const pid = await create(name, $('su-pin-on').checked && !checkFirst() ? $('su-pin-a').value : '');
      ss.set(RESTORE_KEY, token);   // picked up once the profile opens
      enterProfile(pid);
    };
    step(1);
  }

  function showGate() {
    $('gate').hidden = false;
    $('gate-profiles').innerHTML = profiles.map(p =>
      `<button class="profile-tile" data-pid="${p.id}"><span class="avatar" data-av="${p.id}"></span><span>${esc(p.name)}${p.pin ? ' 🔒' : ''}</span></button>`).join('');
    profiles.forEach(p => paintAvatar(document.querySelector(`[data-av="${p.id}"]`), p));
    let pinFor = null;
    $('gate-profiles').onclick = e => {
      const pid = e.target.closest('[data-pid]')?.dataset.pid; if (!pid) return;
      const p = profiles.find(x => x.id === pid);
      if (!p.pin) return enterProfile(pid);
      pinFor = p;
      $('gate-list').hidden = true; $('gate-pin').hidden = false;
      paintAvatar($('pin-avatar'), p); $('pin-name').textContent = p.name;
      $('pin-error').textContent = ''; $('pin-input').value = ''; $('pin-input').focus();
    };
    $('pin-back').onclick = () => { $('gate-list').hidden = false; $('gate-pin').hidden = true; };
    $('gate-pin').onsubmit = async e => {
      e.preventDefault();
      if (await hashPin(pinFor.id, $('pin-input').value) === pinFor.pin) enterProfile(pinFor.id);
      else { $('pin-error').textContent = 'Wrong PIN'; $('pin-input').value = ''; }
    };
    $('gate-add').onclick = () => showSignup('add');
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(BUILD_ID)).catch(() => {});
  }
  navigator.storage?.persist?.().catch(() => {});

  // brand-new install (no profiles and no data from before profiles existed)
  if (!ls.get(PROFILES_KEY) && !ls.get('walletTracker.v1')) { showSignup('first'); return; }

  const currentId = profiles.some(p => p.id === ls.get(CURRENT_KEY)) ? ls.get(CURRENT_KEY) : profiles[0].id;
  const profile = profiles.find(p => p.id === currentId);
  const needGate = ss.get(GATE_KEY) === '1' || ((profiles.length > 1 || profile.pin) && ss.get(UNLOCKED_KEY) !== currentId);
  if (needGate) { showGate(); return; }
  if (!ls.get(PROFILES_KEY)) saveProfiles();
  $('app').hidden = false;

  // =====================================================================
  // Everything below runs for the unlocked profile.
  // =====================================================================
  const KEY = dataKeyOf(profile.id);

  // ---------- state ----------
  // Every record carries `u` (last-modified ms) and deletions leave a tombstone in `deleted`,
  // so two devices can be merged record by record.
  function freshState() {
    return { wallets: DEFAULT_WALLETS.map(name => ({ id: uid(), name, opening: 0 })), txns: [], goals: [], goalEntries: [], recurring: [], installments: [], plans: [], loans: [], budgets: [], deleted: {}, prefs: {} };
  }
  function load() {
    const s = ls.json(KEY);
    return s ? normalize(s) : freshState();
  }
  let state = load();
  const now = () => Date.now();
  const forget = (...ids) => ids.forEach(id => { state.deleted[id] = now(); });
  function persist() { ls.set(KEY, JSON.stringify(state)); }
  function save() { applyRecurring(); persist(); render(); scheduleSync(); }

  // Runs a delete, saves, and offers "Undo" for a few seconds. Undo puts the removed records back
  // with a fresh `u` and drops their tombstones, so they also win over a sync that already ran.
  let toastTimer;
  function toast(msg, action, onAction) {
    clearTimeout(toastTimer);
    $('toast-msg').textContent = msg;
    $('toast-btn').textContent = action || '';
    $('toast-btn').hidden = !action;
    $('toast-btn').onclick = () => { $('toast').hidden = true; onAction?.(); };
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000);
  }
  function withUndo(label, remove) {
    const before = Object.fromEntries(COLS.map(c => [c, state[c].slice()]));
    remove();
    save();
    const gone = COLS.flatMap(c => {
      const left = new Set(state[c].map(r => r.id));
      return before[c].filter(r => !left.has(r.id)).map(r => [c, r]);
    });
    if (!gone.length) return;
    toast(`${label} deleted`, 'Undo', () => {
      for (const [c, r] of gone) {
        delete state.deleted[r.id];
        if (!state[c].some(x => x.id === r.id)) state[c].push({ ...r, u: now() });
      }
      save();
      toast(`${label} restored`);
    });
  }

  const walletName = id => id ? state.wallets.find(w => w.id === id)?.name ?? '(deleted)' : 'Not tracked';
  // Credit cards are wallets with kind 'credit' whose balance is negative (−amount owed),
  // so charges, payments (transfers in) and refunds reuse the normal entry types.
  const isCredit = w => w?.kind === 'credit';
  const isCreditId = id => isCredit(state.wallets.find(w => w.id === id));
  const cashWallets = () => state.wallets.filter(w => !isCredit(w));
  const creditCards = () => state.wallets.filter(isCredit);

  function balanceOf(walletId) {
    const w = state.wallets.find(w => w.id === walletId);
    let b = w ? Number(w.opening) || 0 : 0;
    for (const t of state.txns) {
      if (t.type === 'income' && t.walletId === walletId) b += t.amount;
      else if (t.type === 'expense' && t.walletId === walletId) b -= t.amount;
      else if (t.type === 'adjust' && t.walletId === walletId) b += t.amount;
      else if (t.type === 'loan' && t.walletId === walletId) b += t.dir === 'in' ? t.amount : -t.amount;
      else if (t.type === 'transfer') {
        if (t.walletId === walletId) b -= t.amount;
        if (t.toWalletId === walletId) b += t.amount;
      }
    }
    return b;
  }

  function monthTotals(ym) {
    let income = 0, expense = 0;
    for (const t of state.txns) {
      if (!t.date.startsWith(ym)) continue;
      if (t.type === 'income') income += t.amount;
      else if (t.type === 'expense') expense += t.amount;
    }
    return { income, expense, net: income - expense };
  }

  // ---------- credit card statements ----------

  // the statement that closed on/before `date`, and when that statement is due
  function closeBefore(w, date) {
    let ym = date.slice(0, 7);
    if (dayIn(ym, w.closeDay) > date) ym = prevYm(ym);
    return { ym, close: dayIn(ym, w.closeDay), due: dayIn(w.dueDay > w.closeDay ? ym : nextYm(ym), w.dueDay) };
  }
  // Date the card was added (older cards: read from the timestamp at the start of their id).
  function cardAddedOn(w) {
    if (w.addedOn) return w.addedOn;
    const d = new Date(parseInt(w.id.slice(0, -5), 36));
    return isNaN(d) ? today() : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  // The "owed now" entered when adding a card belongs to the previous statement only if that
  // statement wasn't due yet; otherwise it was already paid, so the balance is this cycle's spending.
  function openingDate(w) {
    const added = cardAddedOn(w), prev = closeBefore(w, added);
    return prev.due >= added ? prev.close : added;
  }

  function cardStatus(w) {
    const { ym: closeYm, close: lastClose, due } = closeBefore(w, today());
    // what was owed when the last statement closed, minus payments/credits made since
    let stmt = openingDate(w) <= lastClose ? -(Number(w.opening) || 0) : 0, paid = 0;
    for (const x of state.txns) {
      const credit = (x.type === 'transfer' && x.toWalletId === w.id) || (x.type === 'income' && x.walletId === w.id)
        || (x.type === 'adjust' && x.walletId === w.id && x.amount > 0);
      const charge = (x.type === 'expense' && x.walletId === w.id) || (x.type === 'transfer' && x.walletId === w.id)
        || (x.type === 'adjust' && x.walletId === w.id && x.amount < 0);
      if (!credit && !charge) continue;
      const amt = Math.abs(x.amount);
      if (x.date <= lastClose) stmt += charge ? amt : -amt;
      else if (credit) paid += amt;
    }
    const owed = -balanceOf(w.id);
    // installments hold the whole remaining principal against the limit even before it's billed
    const unbilled = state.installments.filter(p => p.walletId === w.id).reduce((s, p) => s + instProgress(p).unbilledPrincipal, 0);
    return {
      owed, unbilled, lastClose, nextClose: dayIn(nextYm(closeYm), w.closeDay), due,
      stmt: Math.max(0, stmt), dueLeft: Math.max(0, Math.round((stmt - paid) * 100) / 100),
      available: (Number(w.limit) || 0) - owed - unbilled,
      util: w.limit > 0 ? (owed + unbilled) / w.limit * 100 : 0,
    };
  }

  function payCard(id) {
    const s = cardStatus(state.wallets.find(w => w.id === id));
    document.querySelector('#nav button[data-tab="overview"]').click();
    resetForm();
    setType('transfer');
    $('f-to').value = id;
    if ($('f-wallet').value === id) $('f-wallet').value = cashWallets()[0]?.id || '';
    const amt = s.dueLeft || s.owed;
    $('f-amount').value = amt > 0 ? amt.toFixed(2) : '';
    $('form-title').textContent = 'Pay credit card';
    $('txn-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('f-amount').focus();
  }

  function renderCards() {
    const cards = creditCards();
    const statuses = cards.map(w => [w, cardStatus(w)]);
    const totalOwed = statuses.reduce((s, [, c]) => s + c.owed, 0);
    $('cc-summary').textContent = cards.length ? `${peso(totalOwed)} owed` : '';
    $('cc-list').innerHTML = statuses.map(([w, c]) => {
      const days = daysUntil(c.due);
      let line;
      if (c.dueLeft > 0 && days < 0) line = `<span class="neg">⚠ ${peso(c.dueLeft)} overdue by ${-days} day${days === -1 ? '' : 's'}</span>`;
      else if (c.dueLeft > 0) line = `${peso(c.dueLeft)} due ${fmtDate(c.due)} <span class="${days <= 7 ? 'neg' : 'muted'}">(${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`})</span>`;
      else if (c.stmt > 0) line = `<span class="pos">✓ Statement paid</span> · next closes ${fmtDate(c.nextClose)}`;
      else line = `Nothing due · next statement ${fmtDate(c.nextClose)}`;
      return `<div class="wallet cc">
        <div class="name">${esc(w.name)}</div>
        <div class="owed">${peso(c.owed)}</div>
        <div class="line">owed of ${peso(Number(w.limit) || 0)} · ${peso(c.available)} available</div>
        ${c.unbilled > 0 ? `<div class="line">+ ${peso(c.unbilled)} in installments not billed yet</div>` : ''}
        <div class="bar-track"><div class="bar-fill ${c.util >= 80 ? 'high' : ''}" style="width:${Math.max(0, Math.min(100, c.util))}%"></div></div>
        <div class="line">${c.util.toFixed(0)}% used${c.util >= 80 ? ' · high' : ''}</div>
        <div class="line" style="margin-top:6px">${line}</div>
        <div style="margin-top:6px"><button class="link" data-pay="${w.id}" style="padding-left:0">Pay</button><button class="link" data-rec="${w.id}">Update balance</button></div>
      </div>`;
    }).join('') || '<div class="empty" style="padding:12px 0">No credit cards yet. Add one in Settings → Credit cards.</div>';

    const alerts = statuses.filter(([, c]) => c.dueLeft > 0 && daysUntil(c.due) <= 7).map(([w, c]) => {
      const d = daysUntil(c.due);
      return `<div><strong>${esc(w.name)}</strong>: ${peso(c.dueLeft)} ${d < 0 ? `was due ${fmtDate(c.due)} (overdue)` : d === 0 ? 'due today' : `due in ${d} day${d === 1 ? '' : 's'} (${fmtDate(c.due)})`}
        <button class="link" data-pay="${w.id}">Pay now</button></div>`;
    });
    cardAlerts = alerts;

    $('cc-body').innerHTML = statuses.map(([w, c]) => `<tr><td>${esc(w.name)}</td><td class="num">${peso(Number(w.limit) || 0)}</td>
      <td class="num">${peso(c.owed)}</td><td>closes day ${w.closeDay} · due day ${w.dueDay}</td>
      <td><button class="link" data-act="edit" data-id="${w.id}">Edit</button><button class="link danger" data-act="del" data-id="${w.id}">Remove</button></td></tr>`).join('');
    return totalOwed;
  }
  ['cc-list', 'cc-alert'].forEach(id => $(id).addEventListener('click', e => {
    if (e.target.dataset.pay) payCard(e.target.dataset.pay);
    if (e.target.dataset.rec) reconcile(e.target.dataset.rec);
    if (e.target.dataset.backup === 'export') $('b-export').click();
    if (e.target.dataset.backup === 'later') { ls.set(BACKUP_SNOOZE_KEY, String(now() + 7 * 864e5)); render(); }
    if (e.target.dataset.loanpay) {
      payingLoan = e.target.dataset.loanpay; renderLoans();
      $('loan-list').querySelector(`[data-payform="${payingLoan}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }));

  // one reminder box for card bills, loan deadlines and budgets
  let cardAlerts = [], loanAlerts = [], budgetAlerts = [];
  function renderAlerts() {
    const all = [...cardAlerts, ...loanAlerts, ...budgetAlerts, ...maintenanceAlerts()];
    $('cc-alert').innerHTML = all.join('');
    $('cc-alert').hidden = !all.length;
  }

  // ---------- calendar export ----------
  const ICS_KEY = KEY + '.icsExported';   // per device: when this device last downloaded the file
  function calendarEvents() {
    const events = [], horizon = addDays(today(), 366);
    for (const w of creditCards()) {
      const s = cardStatus(w);
      let ym = s.due.slice(0, 7);
      for (let k = 0; k < 12; k++, ym = nextYm(ym)) {
        const date = dayIn(ym, w.dueDay);
        if (date < today()) continue;
        const amount = k === 0 && s.dueLeft > 0 ? ` ${peso(s.dueLeft)}` : '';
        events.push({ uid: `card-${w.id}-${date}@wallet-tracker`, date, title: `${w.name} payment due${amount}`,
          description: 'Credit card payment due (Wallet Tracker).' });
      }
    }
    for (const l of state.loans) {
      for (const p of loanStatus(l).sched) {
        if (p.state === 'paid' || p.date > horizon) continue;
        const title = l.dir === 'lent' ? `${l.person} should pay you ${peso(p.amount)}` : `Pay ${l.person} ${peso(p.amount)}`;
        events.push({ uid: `loan-${l.id}-${p.n}@wallet-tracker`, date: p.date < today() ? today() : p.date,
          title: p.date < today() ? `${title} (overdue)` : title, description: `Loan payment ${p.n} (Wallet Tracker).` });
      }
    }
    for (const r of state.recurring.filter(r => r.type === 'expense')) {
      let ym = nextDue(r).slice(0, 7);
      for (let k = 0; k < 12; k++, ym = nextYm(ym)) {
        const date = occDate(r, ym);
        events.push({ uid: `bill-${r.id}-${ym}@wallet-tracker`, date, title: `${r.category} ${peso(r.amount)}`,
          description: `Monthly bill from ${walletName(r.walletId)}${r.note ? ` · ${r.note}` : ''} (Wallet Tracker).` });
      }
    }
    return events.sort((a, b) => a.date.localeCompare(b.date));
  }
  function renderIcsInfo() {
    const when = ls.get(ICS_KEY), n = calendarEvents().length;
    $('ics-info').textContent = (n ? `${n} reminder${n === 1 ? '' : 's'} to export` : 'Nothing to export yet')
      + (when ? ` · last downloaded ${fmtStamp(new Date(Number(when)).toISOString())}` : '');
    $('ics-export').disabled = !n;
  }
  $('ics-export').addEventListener('click', () => {
    const events = calendarEvents();
    if (!events.length) return;
    download(`wallet-tracker-reminders-${fileSlug()}.ics`, buildIcs(events), 'text/calendar');
    ls.set(ICS_KEY, String(now()));
    renderIcsInfo();
    toast(`Calendar file with ${events.length} reminders downloaded`);
  });

  // ---------- monthly summary ----------
  const monthName = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-PH', { month: 'long' }); };
  function renderSummary() {
    const s = monthSummary(state.txns, today());
    const days = `the first ${s.day} day${s.day === 1 ? '' : 's'}`;
    let headline;
    if (!s.spent && !s.prevSpent) headline = 'No spending recorded yet this month.';
    else if (s.change === null) headline = `<strong>${peso(s.spent)}</strong> spent in ${days}. Nothing from ${monthName(s.last)} to compare with yet.`;
    else {
      const pct = Math.round(Math.abs(s.change) * 100);
      const cmp = pct === 0 ? 'the same as' : `<span class="${s.change > 0 ? 'neg' : 'pos'}">${pct}% ${s.change > 0 ? 'more' : 'less'}</span> than`;
      headline = `<strong>${peso(s.spent)}</strong> spent in ${days} — ${cmp} the same days in ${monthName(s.last)} (${peso(s.prevSpent)}).`;
    }
    $('sum-headline').innerHTML = headline;
    const short = monthName(s.last).slice(0, 3);
    $('sum-cats').innerHTML = s.biggest.length && s.prevSpent ? '<h3 style="margin-top:10px">Biggest changes</h3>' + s.biggest.map(c => `<div class="kv">
        <span>${esc(c.category)} <span class="muted small">${peso(c.now)}</span></span>
        <span class="${c.diff > 0 ? 'neg' : 'pos'}">${c.diff > 0 ? '▲' : '▼'} ${peso(Math.abs(c.diff))} <span class="muted small">vs ${short}</span></span>
      </div>`).join('') : '';
  }

  // ---------- backup reminder + storage warning ----------
  const BACKUP_KEY = KEY + '.lastBackup', BACKUP_SNOOZE_KEY = KEY + '.backupSnooze';
  const STORAGE_LIMIT = 5 * 1024 * 1024;   // most browsers allow about 5 MB per site
  function storageUsed() {
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        bytes += (k.length + (localStorage.getItem(k) || '').length) * 2;   // stored as UTF-16
      }
    } catch {}
    return bytes;
  }
  function maintenanceAlerts() {
    const out = [];
    const last = Number(ls.get(BACKUP_KEY)) || 0, snoozed = Number(ls.get(BACKUP_SNOOZE_KEY)) > now();
    const synced = syncCfg?.lastSync && now() - syncCfg.lastSync < 30 * 864e5;
    if (!synced && !snoozed && !isPristine(state) && now() - last > 30 * 864e5) {
      const ago = last ? `your last backup was ${Math.floor((now() - last) / 864e5)} days ago` : 'you haven’t backed it up yet';
      out.push(`<div>💾 <strong>Back up your data</strong>: it’s only stored in this browser and ${ago}.
        <button class="link" data-backup="export">Export now</button><button class="link" data-backup="later">Remind me in a week</button></div>`);
    }
    const used = storageUsed();
    if (used > STORAGE_LIMIT * 0.8) out.push(`<div>⚠ <strong>Browser storage is almost full</strong> (${(used / 1048576).toFixed(1)} of about 5 MB).
      A background photo takes the most room: switch to a preset background, or export a backup and erase old data.</div>`);
    return out;
  }

  // ---------- budgets ----------
  $('budget-form').addEventListener('submit', e => {
    e.preventDefault();
    const category = $('bd-cat').value.trim(), limit = round2(parseMoney($('bd-limit').value));
    if (!category || !(limit > 0)) { toast('Enter a category and a limit above zero'); return; }
    const existing = state.budgets.find(b => b.category.toLowerCase() === category.toLowerCase());
    if (existing) Object.assign(existing, { limit, u: now() });
    else state.budgets.push({ id: uid(), category, limit, u: now() });
    e.target.reset();
    save();
  });
  $('budget-list').addEventListener('click', e => {
    const { bact, id } = e.target.dataset; if (!bact) return;
    const b = state.budgets.find(x => x.id === id);
    if (bact === 'edit') ask({ title: `${b.category} budget`, fields: [moneyField('limit', 'Monthly limit (₱)', b.limit)],
      validate: v => parseMoney(v.limit) > 0 ? '' : 'Enter a limit above zero.' },
    ({ limit }) => { b.limit = round2(parseMoney(limit)); b.u = now(); save(); });
    if (bact === 'del') withUndo(`${b.category} budget`, () => { state.budgets = state.budgets.filter(x => x.id !== id); forget(id); });
  });
  function renderBudgets() {
    const rows = budgetStatus(state.budgets, state.txns, thisMonth());
    const totalLimit = rows.reduce((s, b) => s + b.limit, 0), totalSpent = rows.reduce((s, b) => s + b.spent, 0);
    $('budget-summary').textContent = rows.length ? `${peso(totalSpent)} of ${peso(totalLimit)} this month` : '';
    $('budget-list').innerHTML = rows.map(b => `<div class="budget-row">
        <div class="flex between"><strong>${esc(b.category)}</strong>
          <span class="small">${peso(b.spent)} <span class="muted">of ${peso(b.limit)}</span></span></div>
        <div class="bar-track"><div class="bar-fill ${b.level}" style="width:${Math.min(100, b.pct * 100)}%"></div></div>
        <div class="flex between small">
          <span class="${b.level === 'over' ? 'neg' : b.level === 'near' ? 'warn' : 'muted'}">${
            b.level === 'over' ? `⚠ Over by ${peso(-b.left)}` : b.level === 'near' ? `Near the limit · ${peso(b.left)} left` : `${peso(b.left)} left`}</span>
          <span><button class="link" data-bact="edit" data-id="${b.id}">Edit</button><button class="link danger" data-bact="del" data-id="${b.id}">Remove</button></span>
        </div>
      </div>`).join('') || '<div class="empty" style="padding:8px 0">Set a monthly limit for a category, e.g. Food ₱8,000, and see how much is left.</div>';
    $('bd-cats').innerHTML = [...new Set([...CATS.expense, ...usedCategories('expense')])]
      .filter(c => !state.budgets.some(b => b.category.toLowerCase() === c.toLowerCase()))
      .map(c => `<option value="${esc(c)}">`).join('');
    budgetAlerts = rows.filter(b => b.level === 'over').map(b =>
      `<div><strong>${esc(b.category)}</strong> is over its monthly budget by ${peso(-b.left)} (${peso(b.spent)} of ${peso(b.limit)})</div>`);
  }

  // ---------- loans ----------
  // Lent/borrowed money and repayments are 'loan' entries: they move wallet balances but aren't
  // revenue or expenses. Anything paid back beyond the original amount is interest, recorded as
  // revenue (you lent) or an expense (you borrowed).
  let loanDir = 'lent', editingLoan = null, payingLoan = null, showPaidLoans = false;
  const openSchedules = new Set();
  const whenText = days => days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`;
  const FREQ_LABEL = { weekly: 'weekly', biweekly: 'every-2-weeks', semimonthly: 'twice-a-month', monthly: 'monthly' };


  // Repayments fill the schedule from the earliest payment onward.
  function loanStatus(l) {
    const repaid = state.txns.filter(t => t.loanId === l.id && t.loanRole === 'repay').reduce((s, t) => s + t.amount, 0);
    const total = l.total || l.principal;
    const left = Math.max(0, round2(total - repaid));
    const t = today(), sched = [];
    let cum = 0, next = null, behind = 0, overdueAmt = 0, firstOverdue = null;
    for (const p of loanSchedule(l)) {
      cum = round2(cum + p.amount);
      const covered = repaid + 0.005 >= cum;
      const partial = !covered && repaid > cum - p.amount + 0.005;
      sched.push({ ...p, state: covered ? 'paid' : p.date < t ? 'overdue' : 'due', partial });
      if (covered) continue;
      if (p.date < t) { behind++; overdueAmt = round2(cum - repaid); firstOverdue = firstOverdue || p.date; }
      else if (!next) next = { ...p, owed: round2(cum - repaid - overdueAmt) };
    }
    return {
      repaid, total, left, paid: left === 0, sched, next, behind, overdueAmt, firstOverdue,
      days: firstOverdue ? daysUntil(firstOverdue) : next ? daysUntil(next.date) : 0,
      suggest: overdueAmt > 0 ? overdueAmt : next ? next.owed : left,
      sortDate: firstOverdue || next?.date || l.due,
    };
  }

  function loanFormLoan() {
    const principal = parseFloat($('ln-amount').value) || 0;
    return { principal, total: parseFloat($('ln-total').value) || principal, freq: $('ln-plan').value === 'periodic' ? $('ln-freq').value : '',
      count: parseInt($('ln-count').value, 10) || 0, firstDue: $('ln-first').value, due: $('ln-due').value };
  }
  function updateLoanPlanUi() {
    const periodic = $('ln-plan').value === 'periodic';
    $('ln-due-wrap').hidden = periodic; $('ln-due').required = !periodic;
    ['ln-freq-wrap', 'ln-count-wrap', 'ln-first-wrap'].forEach(id => { $(id).hidden = !periodic; });
    $('ln-first').required = periodic;
    const l = loanFormLoan();
    if (periodic && l.total > 0 && l.count >= 2 && l.firstDue) {
      const s = loanSchedule(l), last = s[s.length - 1];
      $('ln-preview').textContent = `${l.count} ${FREQ_LABEL[l.freq]} payments of ${peso(s[0].amount)}`
        + (last.amount !== s[0].amount ? ` (last one ${peso(last.amount)})` : '') + ` · first ${fmtDate(s[0].date)}, last ${fmtDate(last.date)}`;
    } else $('ln-preview').textContent = '';
  }
  ['ln-plan', 'ln-freq', 'ln-count', 'ln-first', 'ln-amount', 'ln-total'].forEach(id => $(id).addEventListener('input', updateLoanPlanUi));
  $('ln-plan').addEventListener('change', updateLoanPlanUi);
  $('ln-freq').addEventListener('change', updateLoanPlanUi);
  const cashOptions = (selected = '') => '<option value="">Not from a tracked wallet</option>'
    + cashWallets().map(w => `<option value="${w.id}" ${w.id === selected ? 'selected' : ''}>${esc(w.name)}</option>`).join('');

  function setLoanDir(dir) {
    loanDir = dir;
    document.querySelectorAll('#loan-dir button').forEach(b => b.classList.toggle('active', b.dataset.dir === dir));
    $('ln-person-label').textContent = dir === 'lent' ? 'Who borrowed?' : 'Who lent you?';
    $('ln-wallet-label').textContent = dir === 'lent' ? 'Paid from' : 'Received into';
  }
  $('loan-dir').addEventListener('click', e => { if (e.target.dataset.dir && !editingLoan) setLoanDir(e.target.dataset.dir); });

  function openLoanForm(l) {
    editingLoan = l?.id || null;
    $('loan-form').reset();
    $('loan-form').hidden = false;
    $('ln-wallet').innerHTML = cashOptions(l ? l.walletId : cashWallets()[0]?.id);
    setLoanDir(l ? l.dir : 'lent');
    ['ln-amount', 'ln-date', 'ln-wallet'].forEach(id => { $(id).disabled = !!l; });
    if (l) {
      $('ln-person').value = l.person; $('ln-amount').value = l.principal; $('ln-total').value = l.total;
      $('ln-date').value = l.date; $('ln-due').value = l.due; $('ln-note').value = l.note || '';
      $('ln-plan').value = l.freq ? 'periodic' : 'once';
      if (l.freq) { $('ln-freq').value = l.freq; $('ln-count').value = l.count; $('ln-first').value = l.firstDue; }
    } else $('ln-date').value = today();
    updateLoanPlanUi();
    $('ln-submit').textContent = l ? 'Save changes' : 'Save loan';
    $('loan-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('ln-person').focus();
  }
  function closeLoanForm() { editingLoan = null; $('loan-form').reset(); $('loan-form').hidden = true; }
  $('loan-new-btn').addEventListener('click', () => $('loan-form').hidden || editingLoan ? openLoanForm() : closeLoanForm());
  $('ln-cancel').addEventListener('click', closeLoanForm);

  $('loan-form').addEventListener('submit', e => {
    e.preventDefault();
    const l = editingLoan && state.loans.find(x => x.id === editingLoan);
    const principal = l ? l.principal : round2(parseFloat($('ln-amount').value));
    const total = round2(parseFloat($('ln-total').value) || principal);
    const date = l ? l.date : $('ln-date').value;
    if (!(principal > 0)) return;
    if (total < principal) { alert('“Total to pay back” can’t be less than the amount.'); return; }
    const periodic = $('ln-plan').value === 'periodic';
    const plan = periodic
      ? { freq: $('ln-freq').value, count: Math.min(120, Math.max(2, parseInt($('ln-count').value, 10) || 2)), firstDue: $('ln-first').value }
      : { freq: '', count: 0, firstDue: '' };
    if ((periodic ? plan.firstDue : $('ln-due').value) < date) { alert('The pay-back date is before the loan date.'); return; }
    // for installment loans the final deadline is the last scheduled payment
    const due = periodic ? loanSchedule({ total, ...plan }).at(-1).date : $('ln-due').value;
    const fields = { person: $('ln-person').value.trim(), total, due, ...plan, note: $('ln-note').value.trim(), u: now() };
    if (l) Object.assign(l, fields);
    else {
      const loan = { id: uid(), dir: loanDir, principal, date, walletId: $('ln-wallet').value, ...fields };
      state.loans.push(loan);
      state.txns.push({ id: uid(), type: 'loan', dir: loanDir === 'lent' ? 'out' : 'in', amount: principal, walletId: loan.walletId,
        category: 'Loan', date, note: loanDir === 'lent' ? `Lent to ${loan.person}` : `Borrowed from ${loan.person}`,
        loanId: loan.id, loanRole: 'start', u: now() });
    }
    closeLoanForm();
    save();
  });

  function recordLoanPayment(l, amount, walletId, date) {
    const s = loanStatus(l), inbound = l.dir === 'lent';
    // repayments cover the original amount first; the rest is interest
    const principalPart = round2(Math.max(0, Math.min(amount, l.principal - Math.min(l.principal, s.repaid))));
    const interestPart = round2(amount - principalPart);
    const note = inbound ? `${l.person} paid back` : `Paid back ${l.person}`;
    if (principalPart > 0) state.txns.push({ id: uid(), type: 'loan', dir: inbound ? 'in' : 'out', amount: principalPart, walletId,
      category: 'Loan', date, note, loanId: l.id, loanRole: 'repay', u: now() });
    if (interestPart > 0) state.txns.push({ id: uid(), type: inbound ? 'income' : 'expense', amount: interestPart, walletId,
      category: 'Loan interest', date, note: note + ' (interest)', loanId: l.id, loanRole: 'repay', u: now() });
    payingLoan = null;
    save();
  }

  $('loan-list').addEventListener('click', e => {
    const { lact, id } = e.target.dataset; if (!lact) return;
    const l = state.loans.find(x => x.id === id);
    if (lact === 'pay') { payingLoan = id; renderLoans(); $('loan-list').querySelector(`[data-payform="${id}"] input`)?.focus(); }
    if (lact === 'pay-cancel') { payingLoan = null; renderLoans(); }
    if (lact === 'edit') openLoanForm(l);
    if (lact === 'toggle-paid') { showPaidLoans = !showPaidLoans; renderLoans(); }
    if (lact === 'schedule') { openSchedules.has(id) ? openSchedules.delete(id) : openSchedules.add(id); renderLoans(); }
    if (lact === 'del' && confirm(`Delete this loan with ${l.person}? Its entries (including repayments) are removed from your history and wallet balances.`)) {
      withUndo(`Loan with ${l.person}`, () => {
        const ids = state.txns.filter(t => t.loanId === id).map(t => t.id);
        state.txns = state.txns.filter(t => t.loanId !== id);
        state.loans = state.loans.filter(x => x.id !== id);
        forget(id, ...ids);
      });
    }
  });
  $('loan-list').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target, l = state.loans.find(x => x.id === f.dataset.payform);
    const amount = round2(parseFloat(f.elements.amount.value));
    if (!(amount > 0)) return;
    const { left } = loanStatus(l);
    if (amount > left + 0.005 && !confirm(`That’s more than the ${peso(left)} left. The extra will count as interest. Record it anyway?`)) return;
    recordLoanPayment(l, amount, f.elements.wallet.value, f.elements.date.value || today());
  });

  function renderLoans() {
    const rows = state.loans.map(l => [l, loanStatus(l)]);
    const owedToMe = rows.filter(([l]) => l.dir === 'lent').reduce((s, [, x]) => s + x.left, 0);
    const iOwe = rows.filter(([l]) => l.dir === 'borrowed').reduce((s, [, x]) => s + x.left, 0);
    $('loan-summary').textContent = rows.length ? `Owed to you ${peso(owedToMe)} · You owe ${peso(iOwe)}` : '';
    const open = rows.filter(([, s]) => !s.paid).sort((a, b) => a[1].sortDate.localeCompare(b[1].sortDate));
    const paid = rows.filter(([, s]) => s.paid);
    const row = ([l, s]) => {
      const lent = l.dir === 'lent';
      let due;
      if (s.paid) due = '<span class="pos">✓ Paid back</span>';
      else if (s.behind && l.freq) due = `<span class="neg">⚠ ${peso(s.overdueAmt)} overdue · ${s.behind} payment${s.behind > 1 ? 's' : ''} missed since ${fmtDate(s.firstOverdue)}</span>`
        + (s.next ? ` · next ${peso(s.next.owed)} on ${fmtDate(s.next.date)}` : '');
      else if (s.behind) due = `<span class="neg">⚠ Overdue by ${-s.days} day${s.days === -1 ? '' : 's'} (was due ${fmtDate(l.due)})</span>`;
      else if (l.freq) due = `Payment ${s.next.n} of ${l.count}: ${peso(s.next.owed)} due ${fmtDate(s.next.date)} <span class="${s.days <= 7 ? 'neg' : 'muted'}">(${whenText(s.days)})</span>`;
      else due = `Pay back by ${fmtDate(l.due)} <span class="${s.days <= 7 ? 'neg' : 'muted'}">(${whenText(s.days)})</span>`;
      const plan = l.freq ? ` · ${l.count} ${FREQ_LABEL[l.freq]} payments of ${peso(s.sched[0].amount)}` : '';
      const schedule = l.freq && openSchedules.has(l.id) ? `<div class="small" style="margin-top:6px">${s.sched.map(p => `<div class="kv" style="max-width:320px;padding:2px 0">
          <span class="muted">#${p.n} · ${fmtDate(p.date)}</span><span class="${p.state === 'overdue' ? 'neg' : p.state === 'paid' ? 'pos' : ''}">${peso(p.amount)}
          ${p.state === 'paid' ? '✓' : p.state === 'overdue' ? (p.partial ? '· part paid, overdue' : '· overdue') : p.partial ? '· part paid' : ''}</span></div>`).join('')}</div>` : '';
      const payForm = payingLoan === l.id && !s.paid ? `<form data-payform="${l.id}" style="margin-top:8px"><div class="row">
          <label>Amount (₱)<input name="amount" type="number" step="0.01" min="0.01" value="${s.suggest.toFixed(2)}" required></label>
          <label>${lent ? 'Received into' : 'Paid from'}<select name="wallet">${cashOptions(l.walletId)}</select></label>
          <label>Date<input name="date" type="date" value="${today()}" required></label>
          <div class="flex" style="align-self:end"><button class="btn primary">Save payment</button><button type="button" class="btn" data-lact="pay-cancel" data-id="${l.id}">Cancel</button></div>
        </div></form>` : '';
      return `<div class="recur-row">
        <div style="flex:1;min-width:220px">
          <strong>${lent ? `${esc(l.person)} owes you` : `You owe ${esc(l.person)}`}</strong>
          <span class="${lent ? 'pos' : 'neg'}">${peso(s.left)}</span>
          <div class="tag">${peso(s.repaid)} of ${peso(s.total)} paid back · ${lent ? 'lent' : 'borrowed'} ${fmtDate(l.date)} · ${esc(walletName(l.walletId))}${plan}${s.total > l.principal ? ` · includes ${peso(s.total - l.principal)} interest` : ''}${l.note ? ' · ' + esc(l.note) : ''}</div>
          <div class="bar-track" style="max-width:260px"><div class="bar-fill" style="width:${s.total ? Math.min(100, s.repaid / s.total * 100) : 0}%"></div></div>
          <div class="small">${due}</div>
          ${l.freq ? `<button class="link" data-lact="schedule" data-id="${l.id}" style="padding-left:0">${openSchedules.has(l.id) ? 'Hide' : 'Show'} schedule</button>` : ''}
          ${schedule}
          ${payForm}
        </div>
        <span>${s.paid ? '' : `<button class="link" data-lact="pay" data-id="${l.id}">Record payment</button>`}<button class="link" data-lact="edit" data-id="${l.id}">Edit</button><button class="link danger" data-lact="del" data-id="${l.id}">Delete</button></span>
      </div>`;
    };
    $('loan-list').innerHTML = (open.map(row).join('')
        || (paid.length ? '' : '<div class="empty" style="padding:12px 0">Keep track of money you lend or borrow, with a pay-back date.</div>'))
      + (paid.length ? `<button class="link" data-lact="toggle-paid" style="padding-left:0;margin-top:8px">${showPaidLoans ? 'Hide' : 'Show'} paid-back loans (${paid.length})</button>`
        + (showPaidLoans ? paid.map(row).join('') : '') : '');
    loanAlerts = open.filter(([, s]) => s.days <= 7).map(([l, s]) => {
      const date = s.firstOverdue || s.next.date, amt = s.behind ? s.overdueAmt : s.next.owed;
      const when = s.behind ? `was due ${fmtDate(date)} (overdue)` : `due ${whenText(s.days)} (${fmtDate(date)})`;
      return `<div>${l.dir === 'lent' ? `<strong>${esc(l.person)}</strong> should pay you ${peso(amt)}` : `Pay <strong>${esc(l.person)}</strong> ${peso(amt)}`} — ${when}
        <button class="link" data-loanpay="${l.id}">Record payment</button></div>`;
    });
    renderAlerts();
  }

  let editingCard = null;
  function resetCardForm() {
    editingCard = null;
    $('cc-form').reset(); $('cc-owed').value = 0;
    $('cc-form-title').textContent = 'Add credit card';
    $('cc-submit').textContent = 'Add card';
    $('cc-cancel').hidden = true; $('cc-owed-wrap').hidden = false;
  }
  $('cc-cancel').addEventListener('click', resetCardForm);
  $('cc-form').addEventListener('submit', e => {
    e.preventDefault();
    const fields = {
      name: $('cc-name').value.trim(), limit: parseFloat($('cc-limit').value) || 0,
      closeDay: Math.min(31, Math.max(1, parseInt($('cc-close').value, 10))), dueDay: Math.min(31, Math.max(1, parseInt($('cc-due').value, 10))),
      u: now(),
    };
    if (editingCard) Object.assign(state.wallets.find(w => w.id === editingCard), fields);
    else state.wallets.push({ id: uid(), kind: 'credit', opening: -(parseFloat($('cc-owed').value) || 0), addedOn: today(), ...fields });
    resetCardForm();
    save();
  });
  $('cc-body').addEventListener('click', e => {
    const { act, id } = e.target.dataset; if (!id) return;
    const w = state.wallets.find(x => x.id === id);
    if (act === 'edit') {
      editingCard = id;
      $('cc-name').value = w.name; $('cc-limit').value = w.limit; $('cc-close').value = w.closeDay; $('cc-due').value = w.dueDay;
      $('cc-owed-wrap').hidden = true;
      $('cc-form-title').textContent = `Edit ${w.name}`;
      $('cc-submit').textContent = 'Save card'; $('cc-cancel').hidden = false;
      $('cc-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (act === 'del') {
      const used = state.txns.some(t => t.walletId === id || t.toWalletId === id) || state.recurring.some(r => r.walletId === id)
        || state.installments.some(p => p.walletId === id);
      if (used) { alert(`${w.name} has entries, monthly items or installments. Delete those first, or keep the card.`); return; }
      withUndo(w.name, () => { state.wallets = state.wallets.filter(x => x.id !== id); forget(id); });
    }
  });

  // ---------- monthly (recurring) entries ----------
  // A rule creates one entry per month with a predictable id (rule@YYYY-MM), so synced devices
  // never double-add, and an occurrence you delete stays deleted.
  function occDate(r, ym) {
    const [y, m] = ym.split('-').map(Number);
    return `${ym}-${pad(Math.min(r.day, new Date(y, m, 0).getDate()))}`;
  }
  function applyRecurring() {
    const t = today(), tm = thisMonth();
    const have = new Set(state.txns.map(x => x.id));
    let changed = false;
    for (const r of state.recurring) {
      for (let ym = r.start; ym <= tm; ym = nextYm(ym)) {
        const id = r.id + '@' + ym, date = occDate(r, ym);
        if (have.has(id) || id in state.deleted || date > t) continue;
        state.txns.push({ id, type: r.type, amount: r.amount, walletId: r.walletId, category: r.category, date, note: r.note, recurringId: r.id, u: 1 });
        changed = true;
      }
    }
    for (const p of state.installments) {
      for (const o of instSchedule(p)) {
        if (have.has(o.id) || o.id in state.deleted || o.date > t) continue;
        state.txns.push({ id: o.id, type: 'expense', amount: o.amount, walletId: p.walletId, category: p.category, date: o.date,
          note: `${p.note || p.category} (installment ${o.n}/${p.months})`, installmentId: p.id, planId: p.planId, u: 1 });
        changed = true;
      }
    }
    return changed;
  }

  // ---------- installments ----------
  // Each month's amortization is billed on the card's statement date, starting with the first
  // statement on/after the purchase. Ids are plan#k so synced devices never double-bill.
  function instSchedule(p) {
    const card = state.wallets.find(w => w.id === p.walletId);
    return instScheduleFor(p, card?.closeDay || Number(p.purchaseDate.slice(8, 10)));
  }
  function instProgress(p) {
    const sched = instSchedule(p), billed = sched.filter(o => o.date <= today()).length;
    const left = p.closedAt ? 0 : p.months - billed;
    return { billed, left, unbilledPrincipal: round2(p.total / p.months * left), next: sched.find(o => o.date > today())?.date };
  }

  $('inst-list').addEventListener('click', e => {
    const { act, id } = e.target.dataset; if (!id) return;
    const p = state.installments.find(x => x.id === id);
    const label = p.note || p.category;
    if (act === 'payoff') {
      const { unbilledPrincipal } = instProgress(p);
      if (!confirm(`Pay off “${label}” early? The remaining ${peso(unbilledPrincipal)} is billed to the card today and no more monthly charges are added.`)) return;
      p.closedAt = today(); p.u = now();
      if (unbilledPrincipal > 0) state.txns.push({ id: p.id + '#payoff', type: 'expense', amount: unbilledPrincipal, walletId: p.walletId,
        category: p.category, date: today(), note: `${label} (installment paid off)`, installmentId: p.id, planId: p.planId, u: now() });
      save();
    }
    if (act === 'del' && confirm(`Delete the installment “${label}” and all of its charges? Use this only if it was entered by mistake.`)) {
      withUndo(`Installment “${label}”`, () => {
        const ids = state.txns.filter(t => t.installmentId === id).map(t => t.id);
        state.txns = state.txns.filter(t => t.installmentId !== id);
        state.installments = state.installments.filter(x => x.id !== id);
        forget(id, ...ids, ...instSchedule(p).map(o => o.id));
      });
    }
  });

  function renderInstallments() {
    const active = state.installments.map(p => [p, instProgress(p)]).sort((a, b) => (a[1].left === 0) - (b[1].left === 0));
    $('inst-wrap').hidden = !active.length;
    $('inst-list').innerHTML = active.map(([p, s]) => `<div class="recur-row">
        <div><strong>${esc(p.note || p.category)}</strong> <span class="neg">${peso(instMonthly(p))}/mo</span>
          <div class="tag">${esc(walletName(p.walletId))} · ${peso(p.total)} over ${p.months} months${p.rate ? ` at ${p.rate}%/mo` : ' at 0%'} ·
          ${s.left === 0 ? (p.closedAt ? 'paid off' : 'fully billed') : `${s.billed} of ${p.months} billed · ${peso(s.unbilledPrincipal)} left${s.next ? ` · next ${fmtDate(s.next)}` : ''}`}</div>
          <div class="bar-track" style="max-width:260px"><div class="bar-fill" style="width:${(p.months - s.left) / p.months * 100}%"></div></div></div>
        <span>${s.left > 0 ? `<button class="link" data-act="payoff" data-id="${p.id}">Pay off now</button>` : ''}<button class="link danger" data-act="del" data-id="${p.id}">Delete</button></span>
      </div>`).join('');
  }
  function nextDue(r) {
    let ym = thisMonth() < r.start ? r.start : thisMonth();
    if (occDate(r, ym) < today() || state.txns.some(x => x.id === r.id + '@' + ym)) ym = nextYm(ym);
    return occDate(r, ym);
  }

  $('recur-list').addEventListener('click', e => {
    const { act, id } = e.target.dataset; if (!id) return;
    const r = state.recurring.find(x => x.id === id);
    if (act === 'amount') {
      ask({ title: `Change ${r.category}`, message: 'Past entries stay as they are; new months use the new amount.',
        fields: [moneyField('amount', 'Monthly amount (₱)', r.amount)],
        validate: v => parseMoney(v.amount) > 0 ? '' : 'Enter an amount above zero.' },
      ({ amount }) => { r.amount = round2(parseMoney(amount)); r.u = now(); save(); });
    }
    if (act === 'stop') withUndo(`Monthly “${r.category}”`, () => { state.recurring = state.recurring.filter(x => x.id !== id); forget(id); });
  });

  function renderRecurring() {
    const rules = [...state.recurring].sort((a, b) => a.day - b.day);
    const out = rules.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const inc = rules.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    $('recur-summary').textContent = rules.length ? `${peso(out)} out · ${peso(inc)} in per month` : '';
    $('recur-list').innerHTML = rules.map(r => `<div class="recur-row">
        <div><strong>${esc(r.category)}</strong> <span class="${r.type === 'income' ? 'pos' : 'neg'}">${r.type === 'income' ? '+' : '−'}${peso(r.amount)}</span>
          <div class="tag">${esc(walletName(r.walletId))} · every month on day ${r.day} · next ${fmtDate(nextDue(r))}${r.note ? ' · ' + esc(r.note) : ''}</div></div>
        <span><button class="link" data-act="amount" data-id="${r.id}">Change amount</button><button class="link danger" data-act="stop" data-id="${r.id}">Stop</button></span>
      </div>`).join('') ||
      '<div class="empty" style="padding:12px 0">Tick “Monthly” when adding rent, bills, subscriptions or salary and they’ll add themselves each month.</div>';
  }

  // ---------- tabs ----------
  $('nav').addEventListener('click', e => {
    const tab = e.target.closest('[data-tab]')?.dataset.tab; if (!tab) return;
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
    renderCharts();
  });

  // ---------- entry form ----------
  let entryType = 'expense';
  let editingId = null;

  function setType(type) {
    entryType = type;
    document.querySelectorAll('#type-seg button').forEach(b => b.classList.toggle('active', b.dataset.type === type));
    $('f-to-wrap').hidden = type !== 'transfer';
    $('f-cat-wrap').hidden = type === 'transfer';
    $('f-repeat-wrap').hidden = type === 'transfer' || !!editingId;
    updateInstallmentUi();
    $('f-repeat-label').textContent = type === 'income'
      ? 'Monthly revenue (adds itself every month on this day)'
      : 'Monthly expense (adds itself every month on this day)';
    $('f-wallet-label').textContent = type === 'transfer' ? 'From wallet' : type === 'expense' ? 'Paid with' : 'Into wallet';
    $('cat-list').innerHTML = (CATS[type] || []).concat(usedCategories(type))
      .filter((c, i, a) => a.indexOf(c) === i).map(c => `<option value="${esc(c)}">`).join('');
  }
  function usedCategories(type) {
    return state.txns.filter(t => t.type === type && t.category).map(t => t.category);
  }
  $('type-seg').addEventListener('click', e => { if (e.target.dataset.type) setType(e.target.dataset.type); });

  function updateInstallmentUi() {
    const show = entryType === 'expense' && !editingId && isCreditId($('f-wallet').value);
    $('f-inst-wrap').hidden = !show;
    const on = show && $('f-inst').checked;
    $('f-inst-opts').hidden = !on;
    if (on) $('f-repeat').checked = false;
    const amount = parseFloat($('f-amount').value);
    if (on && amount > 0) {
      const p = { total: amount, months: Number($('f-inst-months').value), rate: parseFloat($('f-inst-rate').value) || 0 };
      $('f-inst-preview').textContent = `${peso(instMonthly(p))}/month for ${p.months} months · total ${peso(instPayable(p))}`
        + (p.rate ? ` (${peso(instPayable(p) - p.total)} interest)` : '') + ' · billed on each statement';
    } else $('f-inst-preview').textContent = '';
  }
  ['f-wallet', 'f-inst', 'f-inst-months', 'f-inst-rate', 'f-amount'].forEach(id => $(id).addEventListener('input', updateInstallmentUi));
  $('f-inst').addEventListener('change', updateInstallmentUi);
  $('f-repeat').addEventListener('change', () => { if ($('f-repeat').checked) { $('f-inst').checked = false; updateInstallmentUi(); } });

  let pendingPlan = null;   // { planId, planItemId } while logging a plan expense
  function resetForm() {
    editingId = null;
    pendingPlan = null;
    $('txn-form').reset();
    $('f-date').value = today();
    $('form-title').textContent = 'Add entry';
    $('f-submit').textContent = 'Add';
    $('f-cancel').hidden = true;
    setType(entryType);
  }
  $('f-cancel').addEventListener('click', resetForm);

  $('txn-form').addEventListener('submit', e => {
    e.preventDefault();
    const amount = Math.round(parseFloat($('f-amount').value) * 100) / 100;
    if (!(amount > 0)) return;
    const t = {
      id: editingId || uid(),
      type: entryType,
      amount,
      walletId: $('f-wallet').value,
      toWalletId: entryType === 'transfer' ? $('f-to').value : undefined,
      category: entryType === 'transfer' ? (isCreditId($('f-to').value) ? 'Card payment' : 'Transfer') : ($('f-cat').value.trim() || 'Other'),
      date: $('f-date').value || today(),
      note: $('f-note').value.trim(),
      u: now(),
    };
    if (t.type === 'transfer' && t.walletId === t.toWalletId) { alert('Pick two different wallets for a transfer.'); return; }
    if (pendingPlan && !editingId) Object.assign(t, pendingPlan);
    if (editingId) {
      const old = state.txns.find(x => x.id === editingId);
      ['recurringId', 'installmentId', 'planId', 'planItemId'].forEach(k => { if (old?.[k]) t[k] = old[k]; });
      state.txns = state.txns.map(x => x.id === editingId ? t : x);
    } else if (!$('f-inst-wrap').hidden && $('f-inst').checked) {
      // the plan bills itself onto the card each statement, so don't push t
      state.installments.push({ id: uid(), walletId: t.walletId, category: t.category, note: t.note, total: amount,
        months: Number($('f-inst-months').value), rate: parseFloat($('f-inst-rate').value) || 0, purchaseDate: t.date,
        planId: t.planId, planItemId: t.planItemId, u: now() });
    } else if ($('f-repeat').checked && t.type !== 'transfer') {
      // the rule adds this month's entry itself (and future ones), so don't push t
      state.recurring.push({ id: uid(), type: t.type, amount, walletId: t.walletId, category: t.category, note: t.note,
        day: Number(t.date.slice(8, 10)), start: t.date.slice(0, 7), u: now() });
    } else {
      state.txns.push(t);
    }
    const fromPlan = pendingPlan && !editingId;
    resetForm();
    save();
    if (fromPlan) document.querySelector('#nav button[data-tab="plan"]').click();
  });

  function startEdit(id) {
    const t = state.txns.find(x => x.id === id); if (!t) return;
    if (t.type === 'adjust') { alert('Balance adjustments can only be deleted. Use “Update balance” again to correct.'); return; }
    if (t.loanId) { alert('This is part of a loan. Edit the loan in Overview → Loans, or delete this entry and record the payment again.'); return; }
    document.querySelector('#nav button[data-tab="overview"]').click();
    editingId = id;
    setType(t.type);
    $('f-amount').value = t.amount;
    $('f-wallet').value = t.walletId;
    if (t.type === 'transfer') $('f-to').value = t.toWalletId;
    $('f-cat').value = t.category || '';
    $('f-date').value = t.date;
    $('f-note').value = t.note || '';
    $('form-title').textContent = t.recurringId ? 'Edit this month’s entry' : 'Edit entry';
    $('f-submit').textContent = 'Save changes';
    $('f-cancel').hidden = false;
    $('txn-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function reconcile(walletId) {
    const current = balanceOf(walletId), credit = isCreditId(walletId);
    ask({
      title: `Update ${walletName(walletId)}`,
      message: credit ? 'Enter what you owe now, as shown in the bank’s app.' : 'Enter the balance shown in the wallet’s app.',
      fields: [moneyField('amount', credit ? 'Amount owed (₱)' : 'Balance (₱)', (credit ? -current : current).toFixed(2))],
      validate: needsMoney('amount'),
    }, ({ amount }) => {
      let actual = parseMoney(amount);
      if (credit) actual = -Math.abs(actual);
      const diff = round2(actual - current);
      if (diff === 0) return;
      state.txns.push({ id: uid(), type: 'adjust', amount: diff, walletId, category: 'Balance adjustment', date: today(),
        note: credit ? `Owed set to ${peso(-actual)}` : `Set to ${peso(actual)}`, u: now() });
      save();
    });
  }

  // ---------- transactions tab ----------
  ['t-search', 't-month', 't-wallet', 't-type'].forEach(id => $(id).addEventListener('input', renderTxns));
  $('t-clear').addEventListener('click', () => { $('t-month').value = ''; renderTxns(); });

  $('t-body').addEventListener('click', e => {
    const id = e.target.dataset.id; if (!id) return;
    if (e.target.dataset.act === 'edit') startEdit(id);
    if (e.target.dataset.act === 'del') withUndo('Entry', () => { state.txns = state.txns.filter(t => t.id !== id); forget(id); });
  });

  const TYPE_LABEL = { income: 'Revenue', expense: 'Expense', transfer: 'Transfer', adjust: 'Adjustment' };

  function renderTxns() {
    // a search looks across all months; every word must match somewhere in the entry
    const words = $('t-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const m = words.length ? '' : $('t-month').value, w = $('t-wallet').value, ty = $('t-type').value;
    const matches = t => {
      if (!words.length) return true;
      const plan = t.planId && state.plans.find(p => p.id === t.planId);
      const hay = [t.note, t.category, walletName(t.walletId), t.toWalletId && walletName(t.toWalletId), plan?.name,
        String(t.amount), peso(t.amount).replace(/[−₱]/g, ''), t.date].join(' ').toLowerCase();
      return words.every(word => hay.includes(word.replace(/[₱,]/g, '')) || hay.includes(word));
    };
    const rows = state.txns
      .filter(t => matches(t) && (!m || t.date.startsWith(m)) && (!w || t.walletId === w || t.toWalletId === w)
        && (!ty || (ty === 'monthly' ? t.recurringId : ty === 'installment' ? t.installmentId : ty === 'plan' ? t.planId
          : ty === 'loan' ? t.loanId : t.type === ty)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    $('t-body').innerHTML = rows.map(t => {
      const sign = t.type === 'income' || (t.type === 'loan' && t.dir === 'in') ? '+' : t.type === 'expense' || t.type === 'loan' ? '−' : '';
      const cls = t.type === 'income' ? 'pos' : t.type === 'expense' ? 'neg' : '';
      const amt = t.type === 'adjust' ? peso(t.amount) : sign + peso(t.amount);
      const wallet = t.type === 'transfer' ? `${esc(walletName(t.walletId))} → ${esc(walletName(t.toWalletId))}` : esc(walletName(t.walletId));
      const plan = t.planId && state.plans.find(p => p.id === t.planId);
      const cat = esc(t.category) + (t.recurringId ? ' <span class="tag" title="Monthly">↻ monthly</span>' : '')
        + (t.installmentId ? ' <span class="tag">▦ installment</span>' : '')
        + (plan ? ` <span class="tag">✈ ${esc(plan.name)}</span>` : '');
      const label = t.type === 'loan' ? (t.loanRole === 'repay' ? 'Loan repayment' : t.dir === 'out' ? 'Lent' : 'Borrowed')
        : t.type === 'transfer' && isCreditId(t.toWalletId) ? 'Card payment'
        : t.type === 'income' && isCreditId(t.walletId) ? 'Card refund' : TYPE_LABEL[t.type];
      return `<tr><td class="c-date">${t.date}</td><td class="c-type">${label}</td><td class="c-wallet">${wallet}</td><td class="c-cat">${cat}</td>
        <td class="num c-amt ${cls}">${amt}</td><td class="note c-note">${esc(t.note)}</td>
        <td class="c-act"><button class="link" data-act="edit" data-id="${t.id}">Edit</button><button class="link danger" data-act="del" data-id="${t.id}">Delete</button></td></tr>`;
    }).join('');
    $('t-empty').hidden = rows.length > 0;
    const inc = rows.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const exp = rows.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    $('t-summary').textContent = (words.length ? 'All months · ' : '') + `${rows.length} entries · Revenue ${peso(inc)} · Expenses ${peso(exp)} · Net ${peso(inc - exp)}`;
  }

  // ---------- plans (trip / purchase calculator) ----------
  const TRIP_ITEMS = [
    ['Flights', 'Transport', 'once', true],
    ['Accommodation', 'Accommodation', 'night', false],
    ['Food', 'Food', 'day', true],
    ['Local transport', 'Transport', 'day', false],
    ['Activities & tours', 'Entertainment', 'once', true],
    ['Pasalubong & shopping', 'Shopping', 'once', false],
    ['Travel insurance', 'Insurance', 'once', true],
    ['Travel tax, visa & fees', 'Fees', 'once', true],
  ];
  const PLAN_CATS = [...CATS.expense, 'Accommodation', 'Insurance', 'Fees'];
  let currentPlanId = null;

  const planById = id => state.plans.find(p => p.id === id);
  const newItem = (label = '', category = 'Other', unit = 'once', perPerson = false) =>
    ({ id: uid(), label, category, amount: 0, cur: 'PHP', unit, perPerson });
  function planSpan(p) {
    if (!p.start || !p.end || p.end < p.start) return { days: 1, nights: 1, dated: false };
    const days = daysBetween(p.start, p.end) + 1;
    return { days, nights: Math.max(1, days - 1), dated: true };
  }
  function itemCost(p, it) {
    const { days, nights } = planSpan(p);
    const fx = it.cur === 'FX' ? (Number(p.rate) || 0) : 1;
    return (Number(it.amount) || 0) * fx * (it.unit === 'day' ? days : it.unit === 'night' ? nights : 1)
      * (it.perPerson ? Math.max(1, p.people || 1) : 1);
  }
  // money actually spent against a plan (or one item): logged expenses + full cost of installment purchases
  function planSpent(p, itemId) {
    const match = x => x.planId === p.id && (!itemId || x.planItemId === itemId);
    return state.txns.filter(t => match(t) && t.type === 'expense' && !t.installmentId).reduce((s, t) => s + t.amount, 0)
      + state.installments.filter(match).reduce((s, i) => s + instPayable(i), 0);
  }
  function planTotals(p) {
    const sub = p.items.reduce((s, it) => s + itemCost(p, it), 0);
    const buffer = sub * (Number(p.buffer) || 0) / 100;
    return { sub, buffer, total: sub + buffer, actual: planSpent(p), perPerson: (sub + buffer) / Math.max(1, p.people || 1) };
  }
  // Logged spending has already left the wallets, so only what's still to spend comes off the balance.
  function planBalanceAfter(p, cash) {
    const T = planTotals(p), left = Math.max(0, T.total - T.actual);
    return { left, after: cash - left };
  }

  $('plan-new-btn').addEventListener('click', () => { $('plan-form').hidden = !$('plan-form').hidden; if (!$('plan-form').hidden) $('pn-name').focus(); });
  $('pn-cancel').addEventListener('click', () => { $('plan-form').hidden = true; });
  $('plan-form').addEventListener('submit', e => {
    e.preventDefault();
    const trip = $('pn-template').value === 'trip';
    const p = { id: uid(), name: $('pn-name').value.trim(), start: $('pn-start').value, end: $('pn-end').value,
      people: Math.max(1, parseInt($('pn-people').value, 10) || 1), buffer: trip ? 10 : 0, currency: '', rate: 0,
      items: trip ? TRIP_ITEMS.map(a => newItem(...a)) : [newItem()], u: now() };
    state.plans.push(p); currentPlanId = p.id;
    e.target.reset(); $('pn-people').value = 1; $('plan-form').hidden = true;
    save();
  });

  function renderPlanList() {
    const cash = cashWallets().reduce((s, w) => s + balanceOf(w.id), 0);
    $('plan-list').innerHTML = state.plans.map(p => { const { after } = planBalanceAfter(p, cash); return `<button class="plan-tile ${p.id === currentPlanId ? 'active' : ''}" data-plan="${p.id}">
        <strong>${esc(p.name)}</strong><div class="amt">${peso(planTotals(p).total)}</div>
        <div class="small">Balance after: <span class="${after < 0 ? 'neg' : 'pos'}">${peso(after)}</span></div>
        <div class="tag">${p.start ? fmtDate(p.start) + (p.end ? ' – ' + fmtDate(p.end) : '') : 'No dates'} · ${p.people || 1} ${(p.people || 1) > 1 ? 'people' : 'person'}</div>
      </button>`; }).join('') || '<div class="empty" style="padding:8px 0">No plans yet.</div>';
  }

  function renderPlans(force) {
    if (currentPlanId && !planById(currentPlanId)) currentPlanId = null;
    if (!currentPlanId && state.plans.length) currentPlanId = state.plans.at(-1).id;
    renderPlanList();
    const p = planById(currentPlanId), ed = $('plan-editor');
    if (!p) { ed.innerHTML = ''; ed.dataset.plan = ''; return; }
    const shape = p.id + '|' + p.items.map(i => i.id).join();
    // don't rebuild the inputs someone is typing in; just refresh the numbers
    if (!force && ed.dataset.plan === shape && ed.contains(document.activeElement)) { renderPlanNumbers(p); return; }
    ed.dataset.plan = shape;
    const opt = (v, cur, label) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${label}</option>`;
    ed.innerHTML = `
      <div class="card">
        <div class="flex between"><h2>${esc(p.name)}</h2>
          <span><button class="link" data-pact="dup">Duplicate</button><button class="link danger" data-pact="del">Delete plan</button></span></div>
        <div class="plan-meta">
          <label>Name<input data-pf="name" value="${esc(p.name)}"></label>
          <label>Start date<input type="date" data-pf="start" value="${p.start || ''}"></label>
          <label>End date<input type="date" data-pf="end" value="${p.end || ''}"></label>
          <label>People<input type="number" min="1" data-pf="people" value="${p.people || 1}"></label>
          <label>Buffer for extras (%)<input type="number" min="0" step="1" data-pf="buffer" value="${p.buffer || 0}"></label>
          <label>Foreign currency<input data-pf="currency" maxlength="3" placeholder="e.g. JPY" value="${esc(p.currency || '')}"></label>
          <label ${p.currency ? '' : 'hidden'}>₱ per 1 ${esc(p.currency)}<input type="number" step="0.0001" min="0" data-pf="rate" value="${p.rate || ''}" placeholder="e.g. 0.38"></label>
        </div>
        <div class="small muted" id="plan-span" style="margin-top:8px"></div>
      </div>
      <div class="grid cols-2">
        <div class="card">
          <h2>Costs</h2>
          <datalist id="plan-cats">${PLAN_CATS.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
          ${p.items.map(it => `<div class="plan-item" data-item="${it.id}">
            <label class="label-cell">Item<input data-if="label" value="${esc(it.label)}" placeholder="What for?"></label>
            <label>Amount<input type="number" min="0" step="0.01" data-if="amount" value="${it.amount || ''}" placeholder="0"></label>
            <label ${p.currency ? '' : 'hidden'}>Currency<select data-if="cur">${opt('PHP', it.cur, 'PHP')}${opt('FX', it.cur, esc(p.currency))}</select></label>
            <label>How often<select data-if="unit">${opt('once', it.unit, 'One-time')}${opt('day', it.unit, 'Per day')}${opt('night', it.unit, 'Per night')}</select></label>
            <label class="check"><input type="checkbox" data-if="perPerson" ${it.perPerson ? 'checked' : ''}> Each person</label>
            <div class="sub" data-sub="${it.id}"></div>
            <div class="cat"><span class="tag">Category</span><input data-if="category" list="plan-cats" value="${esc(it.category)}">
              <span class="tag" data-logged="${it.id}"></span>
              <span class="acts" style="margin-left:auto"><button class="link" data-pact="log" data-item="${it.id}">Log spend</button><button class="link danger" data-pact="del-item" data-item="${it.id}">Remove</button></span></div>
          </div>`).join('')}
          <button class="btn" data-pact="add-item" style="margin-top:12px">+ Add item</button>
        </div>
        <div class="card" id="plan-summary"></div>
      </div>`;
    renderPlanNumbers(p);
  }

  function renderPlanNumbers(p) {
    const { days, nights, dated } = planSpan(p);
    $('plan-span').textContent = dated
      ? `${days} day${days > 1 ? 's' : ''} · ${nights} night${nights > 1 ? 's' : ''} · ${p.people || 1} ${(p.people || 1) > 1 ? 'people' : 'person'} · per-day and per-night items multiply automatically`
      : 'Add start and end dates so per-day and per-night items multiply by the length of the trip.';
    for (const it of p.items) {
      const sub = document.querySelector(`[data-sub="${it.id}"]`);
      if (sub) sub.textContent = peso(itemCost(p, it));
      const lg = document.querySelector(`[data-logged="${it.id}"]`), spent = planSpent(p, it.id);
      if (lg) lg.textContent = spent > 0 ? `· logged ${peso(spent)}` : '';
    }
    const T = planTotals(p);
    const byCat = {};
    p.items.forEach(it => { const c = it.category || 'Other'; byCat[c] = (byCat[c] || 0) + itemCost(p, it); });
    const cats = Object.entries(byCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const cash = cashWallets().reduce((s, w) => s + balanceOf(w.id), 0);
    const owed = creditCards().reduce((s, w) => s - balanceOf(w.id), 0);
    const { left, after } = planBalanceAfter(p, cash);
    const avgNet = lastMonths(6).map(monthTotals).reduce((s, t) => s + t.net, 0) / 6;
    const goal = p.goalId && state.goals.find(g => g.id === p.goalId);
    const saved = goal ? goalSaved(goal.id) : 0;
    let monthsLeft = null;
    if (p.start && p.start > today()) {
      const [sy, sm] = p.start.split('-').map(Number), [ty, tm] = thisMonth().split('-').map(Number);
      monthsLeft = Math.max(1, (sy - ty) * 12 + sm - tm);
    }
    const missingRate = p.currency && !p.rate && p.items.some(i => i.cur === 'FX');
    $('plan-summary').innerHTML = `
      <h2>Summary</h2>
      <div class="sum-big">${peso(T.total)}</div>
      <div class="muted small">${[(p.people || 1) > 1 ? `${peso(T.perPerson)} per person` : '', dated ? `${peso(T.total / days)} per day` : ''].filter(Boolean).join(' · ')}</div>
      <div style="margin-top:12px">
        <div class="kv"><span>Planned costs</span><span>${peso(T.sub)}</span></div>
        ${p.buffer ? `<div class="kv"><span>Buffer for extras (${p.buffer}%)</span><span>${peso(T.buffer)}</span></div>` : ''}
        ${missingRate ? `<div class="neg small">Set “₱ per 1 ${esc(p.currency)}” so the ${esc(p.currency)} items are counted.</div>` : ''}
      </div>
      ${cats.length ? '<h3 style="margin-top:16px">Where it goes</h3>' + cats.map(([c, v]) => `<div class="cat-bar"><span>${esc(c)}</span><span>${peso(v)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${v / T.sub * 100}%"></div></div></div>`).join('') : ''}
      <h3 style="margin-top:16px">Can I afford it?</h3>
      <div class="kv"><span>Total balance</span><span>${peso(cash)}</span></div>
      <div class="kv"><span>− ${T.actual > 0 ? 'Still to spend on this plan' : 'Planned costs'}</span><span>${peso(left)}</span></div>
      <div class="kv" style="border-top:1px solid var(--grid);margin-top:4px;padding-top:8px"><strong>Balance after this plan</strong>
        <span class="${after < 0 ? 'neg' : 'pos'}" style="font-size:18px">${peso(after)}</span></div>
      ${creditCards().length ? `<div class="kv small"><span>…and after paying card debt (${peso(owed)})</span><span class="${after - owed < 0 ? 'neg' : ''}">${peso(after - owed)}</span></div>` : ''}
      ${left > 0 ? `<div class="small ${after >= 0 ? 'pos' : 'muted'}">${after >= 0 ? '✓ Your current balance covers it' : `${Math.max(0, cash / left * 100).toFixed(0)}% covered · short by ${peso(-after)}`}</div>` : ''}
      ${avgNet > 0 && T.total > 0 ? `<div class="kv"><span>Saving your usual ${peso(avgNet)}/mo</span><span>${(T.total / avgNet).toFixed(1)} months</span></div>` : ''}
      ${monthsLeft && T.total > 0 ? `<div class="kv"><span>To be ready by ${fmtDate(p.start)}</span><span>${peso(Math.max(0, T.total - saved) / monthsLeft)}/mo</span></div>` : ''}
      ${goal ? `<div class="kv"><span>Goal “${esc(goal.name)}”</span><span>${peso(saved)} / ${peso(goal.target)}</span></div>
          <div class="bar-track"><div class="bar-fill" style="width:${goal.target > 0 ? Math.min(100, saved / goal.target * 100) : 0}%"></div></div>
          ${Math.abs(goal.target - T.total) > 0.5 ? `<button class="link" data-pact="goal-sync" style="padding-left:0">Update goal target to ${peso(T.total)}</button>` : ''}`
        : T.total > 0 ? '<button class="btn" data-pact="goal" style="margin-top:8px">Create a savings goal for this</button>' : ''}
      <h3 style="margin-top:16px">Actual spending</h3>
      <div class="kv"><span>Logged so far</span><span>${peso(T.actual)} of ${peso(T.total)}</span></div>
      <div class="bar-track"><div class="bar-fill ${T.actual > T.total ? 'high' : ''}" style="width:${T.total > 0 ? Math.min(100, T.actual / T.total * 100) : 0}%"></div></div>
      <div class="small ${T.actual > T.total ? 'neg' : 'muted'}">${T.actual > T.total ? `Over plan by ${peso(T.actual - T.total)}`
        : T.actual > 0 ? `${peso(T.total - T.actual)} left in the plan` : 'Use “Log spend” on an item, or the button below for anything else.'}</div>
      <button class="btn" data-pact="log-any" style="margin-top:8px">Log a spend for this plan</button>`;
  }

  function logPlanExpense(p, itemId) {
    const it = p.items.find(i => i.id === itemId);
    document.querySelector('#nav button[data-tab="overview"]').click();
    resetForm();
    setType('expense');
    pendingPlan = { planId: p.id, planItemId: it?.id };
    if (it) {
      $('f-cat').value = it.category;
      $('f-note').value = `${p.name}: ${it.label}`;
      const left = itemCost(p, it) - planSpent(p, it.id);
      if (left > 0) $('f-amount').value = round2(left).toFixed(2);
    } else $('f-note').value = p.name;
    $('form-title').textContent = `Log spend for ${p.name}`;
    $('f-cancel').hidden = false;
    $('txn-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('f-amount').focus();
  }

  function onPlanField(e, persistNow) {
    const p = planById(currentPlanId); if (!p) return;
    const el = e.target, f = el.dataset.pf, itf = el.dataset.if;
    if (f) {
      p[f] = ['people', 'buffer', 'rate'].includes(f) ? (parseFloat(el.value) || (f === 'people' ? 1 : 0))
        : f === 'currency' ? el.value.trim().toUpperCase() : el.value;
    } else if (itf) {
      const it = p.items.find(i => i.id === el.closest('[data-item]').dataset.item);
      it[itf] = el.type === 'checkbox' ? el.checked : itf === 'amount' ? (parseFloat(el.value) || 0) : el.value;
    } else return;
    if (!persistNow) { renderPlanNumbers(p); renderPlanList(); return; }
    p.u = now(); persist(); scheduleSync();
    if (f === 'currency' || f === 'name') renderPlans(true); else { renderPlanNumbers(p); renderPlanList(); }
  }
  $('plan-editor').addEventListener('input', e => { if (e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') onPlanField(e, false); });
  $('plan-editor').addEventListener('change', e => onPlanField(e, true));
  $('plan-list').addEventListener('click', e => {
    const id = e.target.closest('[data-plan]')?.dataset.plan;
    if (id) { currentPlanId = id; renderPlans(true); }
  });
  $('plan-editor').addEventListener('click', e => {
    const act = e.target.dataset.pact; if (!act) return;
    const p = planById(currentPlanId), itemId = e.target.dataset.item;
    if (act === 'add-item') { p.items.push(newItem()); p.u = now(); save(); document.querySelector('#plan-editor .plan-item:last-of-type [data-if="label"]')?.focus(); }
    if (act === 'del-item') { p.items = p.items.filter(i => i.id !== itemId); p.u = now(); save(); }
    if (act === 'log' || act === 'log-any') logPlanExpense(p, itemId);
    if (act === 'dup') {
      const copy = { ...JSON.parse(JSON.stringify(p)), id: uid(), name: p.name + ' (copy)', goalId: undefined, u: now() };
      copy.items.forEach(i => { i.id = uid(); });
      state.plans.push(copy); currentPlanId = copy.id; save();
    }
    if (act === 'del') withUndo(`Plan “${p.name}”`, () => { state.plans = state.plans.filter(x => x.id !== p.id); forget(p.id); currentPlanId = null; });
    if (act === 'goal') {
      const g = { id: uid(), name: p.name, target: round2(planTotals(p).total), deadline: p.start || '', u: now() };
      state.goals.push(g); p.goalId = g.id; p.u = now(); save();
    }
    if (act === 'goal-sync') {
      const g = state.goals.find(x => x.id === p.goalId);
      g.target = round2(planTotals(p).total); g.u = now(); save();
    }
  });

  // ---------- goals ----------
  $('goal-form').addEventListener('submit', e => {
    e.preventDefault();
    state.goals.push({ id: uid(), name: $('g-name').value.trim(), target: parseFloat($('g-target').value), deadline: $('g-date').value || '', u: now() });
    e.target.reset();
    save();
  });

  const goalSaved = id => state.goalEntries.filter(x => x.goalId === id).reduce((s, x) => s + x.amount, 0);

  $('goal-list').addEventListener('click', e => {
    const { act, id } = e.target.dataset; if (!id) return;
    const g = state.goals.find(g => g.id === id);
    if (act === 'add' || act === 'withdraw') {
      ask({ title: act === 'add' ? `Add to “${g.name}”` : `Take out of “${g.name}”`, ok: act === 'add' ? 'Add' : 'Withdraw',
        fields: [moneyField('amount', 'Amount (₱)', '')],
        validate: v => parseMoney(v.amount) > 0 ? '' : 'Enter an amount above zero.' },
      ({ amount }) => {
        const n = round2(parseMoney(amount));
        state.goalEntries.push({ id: uid(), goalId: id, amount: act === 'add' ? n : -n, date: today(), u: now() });
        save();
      });
    }
    if (act === 'del') withUndo(`Goal “${g.name}”`, () => {
      forget(id, ...state.goalEntries.filter(x => x.goalId === id).map(x => x.id));
      state.goals = state.goals.filter(x => x.id !== id);
      state.goalEntries = state.goalEntries.filter(x => x.goalId !== id);
    });
  });

  function renderGoals() {
    if (!state.goals.length) { $('goal-list').innerHTML = '<div class="empty">No goals yet. Add one below.</div>'; return; }
    $('goal-list').innerHTML = state.goals.map(g => {
      const saved = goalSaved(g.id);
      const pct = g.target > 0 ? Math.max(0, Math.min(100, saved / g.target * 100)) : 0;
      let pace = '';
      if (g.deadline && saved < g.target) {
        const n = new Date(), end = new Date(g.deadline + 'T00:00');
        const months = Math.max(1, (end.getFullYear() - n.getFullYear()) * 12 + end.getMonth() - n.getMonth());
        pace = end > n ? ` · ${peso((g.target - saved) / months)}/mo to hit ${g.deadline}` : ` · target date passed`;
      }
      return `<div>
        <div class="flex between"><strong>${esc(g.name)}</strong><span class="small">${peso(saved)} / ${peso(g.target)}</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
        <div class="flex between small"><span class="muted">${pct.toFixed(0)}%${pace}</span>
          <span><button class="link" data-act="add" data-id="${g.id}">+ Add</button><button class="link" data-act="withdraw" data-id="${g.id}">− Withdraw</button><button class="link danger" data-act="del" data-id="${g.id}">Delete</button></span></div>
      </div>`;
    }).join('');
  }

  // ---------- wallets (settings) ----------
  $('wallet-form').addEventListener('submit', e => {
    e.preventDefault();
    state.wallets.push({ id: uid(), name: $('w-name').value.trim(), opening: parseFloat($('w-open').value) || 0, u: now() });
    e.target.reset(); $('w-open').value = 0;
    save();
  });

  $('w-body').addEventListener('click', e => {
    const { act, id } = e.target.dataset; if (!id) return;
    const w = state.wallets.find(w => w.id === id);
    if (act === 'rename') {
      ask({ title: 'Rename wallet', fields: [{ name: 'name', label: 'Name', value: w.name }],
        validate: v => v.name ? '' : 'Enter a name.' },
      ({ name }) => { w.name = name; w.u = now(); save(); });
    }
    if (act === 'opening') {
      ask({ title: `Starting balance for ${w.name}`, message: 'The balance before your first entry in the app.',
        fields: [moneyField('amount', 'Starting balance (₱)', w.opening)], validate: needsMoney('amount') },
      ({ amount }) => { w.opening = round2(parseMoney(amount)); w.u = now(); save(); });
    }
    if (act === 'del') {
      const used = state.txns.some(t => t.walletId === id || t.toWalletId === id) || state.recurring.some(r => r.walletId === id);
      if (used) { alert(`${w.name} has entries or monthly items. Delete those first, or keep the wallet.`); return; }
      withUndo(w.name, () => { state.wallets = state.wallets.filter(x => x.id !== id); forget(id); });
    }
  });

  // ---------- profile (settings) ----------
  function renderProfile() {
    paintAvatar($('chip'), profile);
    paintAvatar($('pf-avatar'), profile);
    $('chip').title = `${profile.name} · switch profile`;
    $('pf-name').textContent = profile.name;
    $('pf-pin-state').textContent = profile.pin ? 'PIN on' : 'No PIN';
    $('pf-pin').textContent = profile.pin ? 'Change PIN' : 'Set PIN';
    $('pf-pin-remove').hidden = !profile.pin;
    $('pf-delete').hidden = profiles.length < 2;
  }
  $('chip').addEventListener('click', openGate);
  $('pf-switch').addEventListener('click', openGate);
  $('pf-rename').addEventListener('click', () => {
    ask({ title: 'Rename profile', fields: [{ name: 'name', label: 'Name', value: profile.name }],
      validate: v => v.name ? '' : 'Enter a name.' },
    ({ name }) => { profile.name = name; saveProfiles(); renderProfile(); renderSync(); renderPrefs(); });
  });
  $('pf-pin').addEventListener('click', () => {
    const pinField = (name, label) => ({ name, label, type: 'password', inputmode: 'numeric', maxlength: 8 });
    ask({ title: profile.pin ? 'Change PIN' : 'Set a PIN', message: 'Asked when someone opens this profile in the app.',
      fields: [pinField('a', 'New PIN (4–8 digits)'), pinField('b', 'Type it again')],
      validate: v => !/^\d{4,8}$/.test(v.a) ? 'Use 4 to 8 digits.' : v.a !== v.b ? 'The two PINs don’t match.' : '' },
    async ({ a }) => {
      profile.pin = await hashPin(profile.id, a);
      saveProfiles(); ss.set(UNLOCKED_KEY, profile.id); renderProfile();
    });
  });
  $('pf-pin-remove').addEventListener('click', () => {
    if (confirm('Remove the PIN from this profile?')) { profile.pin = ''; saveProfiles(); renderProfile(); }
  });
  $('pf-delete').addEventListener('click', () => {
    ask({ title: `Delete “${profile.name}”?`, ok: 'Delete profile', danger: true,
      message: 'All of this profile’s data on this device is deleted. Synced data on GitHub is kept.',
      fields: [{ name: 'name', label: 'Type the profile name to confirm', placeholder: profile.name }],
      validate: v => v.name === profile.name ? '' : 'The name doesn’t match.' },
    () => {
      [KEY, KEY + '.sync', KEY + '.prefs', KEY + '.theme'].forEach(ls.del);
      profiles = profiles.filter(p => p.id !== profile.id);
      saveProfiles(); ls.del(CURRENT_KEY);
      openGate();
    });
  });

  // ---------- personalize ----------
  // Saved in the profile's data (state.prefs), so the look syncs with the rest of the profile.
  const DEFAULT_PREFS = { theme: '', accent: '', chart: 'earthy', bg: '', bgColor: '', dim: 20, blur: 0, card: '', cardOpacity: 100,
    radius: 'rounded', shadow: 'none', outline: 'thin', font: 'system', size: 1, density: 'comfortable', startTab: 'overview',
    privacy: false, sections: null };
  const SECTIONS = [['stats', 'Balance summary'], ['summary', 'This month so far'], ['wallets', 'Wallets'], ['budgets', 'Budgets'], ['cards', 'Credit cards'], ['loans', 'Loans'],
    ['entry', 'Add entry'], ['monthly', 'Monthly'], ['charts', 'Charts']];
  // revenue / expense colors: on the page in light and dark mode, and inside light or dark custom cards
  const CHART_PAIRS = {
    earthy: { light: ['#80916d', '#613a2b'], dark: ['#80916d', '#cbb397'], onLight: ['#4b4d26', '#9b6a5b'], onDark: ['#80916d', '#cbb397'] },
    bold: { light: ['#2a78d6', '#eb6834'], dark: ['#3987e5', '#d95926'], onLight: ['#2a78d6', '#eb6834'], onDark: ['#3987e5', '#d95926'] },
  };
  const RADII = { sharp: [4, 4, 4], rounded: [14, 12, 8], round: [24, 18, 12] };
  const OUTLINES = { none: 0, thin: 1, thick: 2 };
  const SHADOWS = { none: 'none', soft: '0 1px 3px rgba(43,33,22,0.08), 0 4px 14px rgba(43,33,22,0.06)',
    strong: '0 2px 6px rgba(43,33,22,0.12), 0 12px 32px rgba(43,33,22,0.16)' };
  const DENSITY = { compact: [12, 10, 8], comfortable: [16, 14, 12], spacious: [22, 18, 18] };
  const FONTS = {
    system: ['system-ui, -apple-system, "Segoe UI", sans-serif'],
    rounded: ['Nunito, ui-rounded, "SF Pro Rounded", system-ui, sans-serif', 'Nunito:wght@400;600;700'],
    serif: ['Lora, ui-serif, Georgia, serif', 'Lora:wght@400;600;700'],
    mono: ['"JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace', 'JetBrains+Mono:wght@400;600;700'],
  };
  // first run after looks became synced: bring over this device's old settings (u: 0 lets synced ones win)
  if (!state.prefs || !Object.keys(state.prefs).length) {
    state.prefs = { ...(ls.json(KEY + '.prefs') || { theme: ls.get(KEY + '.theme') || '' }), u: 0 };
    persist();
  }
  let prefs = state.prefs;
  // "outline" replaced the old on/off "border" setting
  const pref = k => k === 'outline' ? prefs.outline ?? (prefs.border === false ? 'none' : 'thin') : prefs[k] ?? DEFAULT_PREFS[k];
  let privacyOverride = null;   // the 👁 button, for this session only

  function savePrefs() {
    prefs.u = now();
    state.prefs = prefs;
    if (!ls.set(KEY, JSON.stringify(state))) alert('Couldn’t save that. The photo may be too large for this browser’s storage; try a smaller one.');
    scheduleSync();
    applyPrefs(); renderPrefs(); renderCharts();
  }

  function applyPrefs() {
    const root = document.documentElement, body = document.body;
    if (pref('theme')) root.dataset.theme = pref('theme'); else delete root.dataset.theme;
    const accent = pref('accent');
    if (accent) {
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--on-accent', isLight(accent) ? '#2b2116' : '#fbf7f1');
    } else { root.style.removeProperty('--accent'); root.style.removeProperty('--on-accent'); }
    if (pref('bgColor')) root.style.setProperty('--page', pref('bgColor')); else root.style.removeProperty('--page');

    const bg = pref('bg'), blur = bg ? pref('blur') : 0;
    for (const [layer, dim] of [[$('bg'), $('bg-dim')], [$('pz-bg'), $('pz-dim')]]) {
      layer.style.backgroundImage = bg || '';
      layer.style.filter = blur ? `blur(${blur}px)` : '';
      dim.style.opacity = bg ? pref('dim') / 100 : 0;
    }
    $('bg').style.inset = blur ? `-${blur * 2}px` : '';   // keep blurred edges off-screen
    body.classList.toggle('has-bg', !!bg);

    // shape, spacing, type, chart colors and card color go into one generated stylesheet
    const [rl, rm, rs] = RADII[pref('radius')] || RADII.rounded;
    const [pd, pm, gp] = DENSITY[pref('density')] || DENSITY.comfortable;
    const font = FONTS[pref('font')] || FONTS.system;
    const pair = CHART_PAIRS[pref('chart')] || CHART_PAIRS.earthy;
    const darkSeries = `--series-1: ${pair.dark[0]}; --series-2: ${pair.dark[1]};`;
    $('pref-style').textContent = `
      :root { --r-lg: ${rl}px; --r-md: ${rm}px; --r-sm: ${rs}px; --shadow: ${SHADOWS[pref('shadow')] || 'none'};
        --border-w: ${OUTLINES[pref('outline')] ?? 1}px; --pad: ${pd}px; --pad-m: ${pm}px; --gap: ${gp}px; --font: ${font[0]};
        --series-1: ${pair.light[0]}; --series-2: ${pair.light[1]}; }
      @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${darkSeries} } }
      :root[data-theme="dark"] { ${darkSeries} }
      ${pref('card') ? islandCss(pref('card'), pair) : ''}`;
    if (font[1] && !document.querySelector(`link[data-font="${pref('font')}"]`)) {
      const l = document.createElement('link');
      l.rel = 'stylesheet'; l.dataset.font = pref('font');
      l.href = `https://fonts.googleapis.com/css2?family=${font[1]}&display=swap`;
      document.head.appendChild(l);
    }
    $('app').style.zoom = pref('size') === 1 ? '' : pref('size');
    const op = pref('cardOpacity');
    if (op < 100) body.style.setProperty('--island-opacity', op + '%'); else body.style.removeProperty('--island-opacity');
    body.classList.toggle('translucent', op < 100);
    body.classList.toggle('privacy', privacyOverride ?? !!pref('privacy'));
    applySections();
  }

  // Re-scope the color tokens inside cards so text, inputs and charts stay readable on the chosen color.
  function islandCss(c, pair) {
    const [s1, s2] = isLight(c) ? pair.onLight : pair.onDark;
    const t = isLight(c)
      ? `color-scheme: light; --text: #2b2116; --text-2: #5f4e3f; --muted: #75654f; --border: rgba(97,58,43,0.28);
         --surface-2: color-mix(in srgb, ${c} 88%, #613a2b); --page: color-mix(in srgb, ${c} 93%, #613a2b);
         --grid: color-mix(in srgb, ${c} 84%, #613a2b); --axis: color-mix(in srgb, ${c} 65%, #613a2b);
         --good: #4b4d26; --bad: #8a5545;`
      : `color-scheme: dark; --text: #f1e9dd; --text-2: #e3d2bc; --muted: #b8a993; --border: rgba(255,255,255,0.24);
         --surface-2: color-mix(in srgb, ${c} 85%, #ffffff); --page: color-mix(in srgb, ${c} 78%, #000000);
         --grid: color-mix(in srgb, ${c} 82%, #ffffff); --axis: color-mix(in srgb, ${c} 65%, #ffffff);
         --good: #c3d1ae; --bad: #f0b8a6;`;
    return `.card, .wallet, nav, .profile-tile { --surface: ${c}; ${t} --series-1: ${s1}; --series-2: ${s2}; }`;
  }

  function sectionPrefs() {
    const s = pref('sections') || {}, known = SECTIONS.map(([k]) => k);
    const order = (s.order || []).filter(k => known.includes(k));
    // sections added in a newer version go right after the section that precedes them by default
    known.forEach((k, i) => {
      if (order.includes(k)) return;
      const before = known.slice(0, i).reverse().find(p => order.includes(p));
      order.splice(before ? order.indexOf(before) + 1 : 0, 0, k);
    });
    return { order, hidden: (s.hidden || []).filter(k => known.includes(k)) };
  }
  function applySections() {
    const { order, hidden } = sectionPrefs();
    order.forEach((id, i) => {
      const el = document.querySelector(`#tab-overview [data-sec="${id}"]`);
      if (el) { el.style.order = i + 1; el.classList.toggle('sec-off', hidden.includes(id)); }
    });
    $('fab').hidden = hidden.includes('entry');   // nothing to jump to
  }

  function renderPrefs() {
    $('pz-profile').textContent = profile.name;
    document.querySelectorAll('#personalize [data-pref]').forEach(b => {
      const v = b.hasAttribute('data-num') ? Number(b.dataset.val) : b.dataset.val;
      b.classList.toggle('active', pref(b.dataset.pref) === v);
    });
    document.querySelectorAll('#personalize [data-check]').forEach(c => { c.checked = !!pref(c.dataset.check); });
    document.querySelectorAll('#personalize [data-select]').forEach(s => { s.value = pref(s.dataset.select); });
    document.querySelectorAll('#personalize [data-range]').forEach(r => { r.value = pref(r.dataset.range); });
    $('bg-dim-val').textContent = pref('dim') + '%';
    $('bg-blur-val').textContent = pref('blur') ? pref('blur') + 'px' : 'off';
    $('card-op-val').textContent = pref('cardOpacity') + '%';
    $('bg-adjust').hidden = !pref('bg');
    const swatch = (attr, value, current, fill, title) =>
      `<button class="swatch ${current === value ? 'active' : ''}" data-${attr}="${value}" title="${title}" style="background:${fill}"></button>`;
    $('accent-swatches').innerHTML = swatch('accent', '', pref('accent'), 'linear-gradient(135deg,#4b4d26 50%,#80916d 50%)', 'Default')
      + ACCENTS.map(c => swatch('accent', c, pref('accent'), c, c)).join('')
      + `<label title="Custom color" style="display:flex"><input type="color" id="accent-custom" value="${pref('accent') || '#4b4d26'}" style="margin:0;width:44px"></label>`;
    $('bg-presets').innerHTML = BG_PRESETS.map((p, i) =>
      `<button class="preset ${pref('bg') === p.css ? 'active' : ''}" data-preset="${i}" title="${p.name}" style="background:${p.css || 'var(--page)'}"></button>`).join('');
    $('bg-color').value = pref('bgColor') || '#f4ede3';
    $('island-swatches').innerHTML = swatch('card', '', pref('card'), 'linear-gradient(135deg,#fbf7f1 50%,#221f18 50%)', 'Default')
      + ISLAND_COLORS.map(c => swatch('card', c, pref('card'), c, c)).join('')
      + `<label title="Custom color" style="display:flex"><input type="color" id="island-custom" value="${pref('card') || '#fbf7f1'}" style="margin:0;width:44px"></label>`;
    const { order, hidden } = sectionPrefs();
    $('sec-list').innerHTML = order.map((id, i) => {
      const off = hidden.includes(id);
      return `<div class="sec-row ${off ? 'off' : ''}">
        <label class="check" style="margin:0" title="Show on Overview"><input type="checkbox" data-sec-toggle="${id}" ${off ? '' : 'checked'}></label>
        <span class="name">${SECTIONS.find(([k]) => k === id)[1]}</span>
        <button data-sec-move="${id}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="Move up">↑</button>
        <button data-sec-move="${id}" data-dir="1" ${i === order.length - 1 ? 'disabled' : ''} title="Move down">↓</button>
      </div>`;
    }).join('');
  }

  $('pz-tabs').addEventListener('click', e => {
    const pane = e.target.dataset.pane; if (!pane) return;
    document.querySelectorAll('#pz-tabs button').forEach(b => b.classList.toggle('active', b.dataset.pane === pane));
    document.querySelectorAll('.pz-pane').forEach(p => { p.hidden = p.dataset.pane !== pane; });
  });
  $('personalize').addEventListener('click', e => {
    const t = e.target, opt = t.closest('[data-pref]');
    if (opt) { prefs[opt.dataset.pref] = opt.hasAttribute('data-num') ? Number(opt.dataset.val) : opt.dataset.val; savePrefs(); return; }
    if (t.dataset.accent !== undefined) { prefs.accent = t.dataset.accent; savePrefs(); }
    if (t.dataset.card !== undefined) { prefs.card = t.dataset.card; savePrefs(); }
    if (t.dataset.preset !== undefined) { prefs.bg = BG_PRESETS[t.dataset.preset].css; savePrefs(); }
    if (t.dataset.secMove) {
      const { order, hidden } = sectionPrefs(), i = order.indexOf(t.dataset.secMove), j = i + Number(t.dataset.dir);
      [order[i], order[j]] = [order[j], order[i]];
      prefs.sections = { order, hidden }; savePrefs();
    }
  });
  $('personalize').addEventListener('input', e => {
    const k = e.target.dataset.range; if (!k) return;
    prefs[k] = Number(e.target.value);
    applyPrefs();
    $('bg-dim-val').textContent = pref('dim') + '%';
    $('bg-blur-val').textContent = pref('blur') ? pref('blur') + 'px' : 'off';
    $('card-op-val').textContent = pref('cardOpacity') + '%';
  });
  $('personalize').addEventListener('change', e => {
    const t = e.target;
    if (t.dataset.range) savePrefs();
    else if (t.dataset.check) { prefs[t.dataset.check] = t.checked; if (t.dataset.check === 'privacy') privacyOverride = null; savePrefs(); }
    else if (t.dataset.select) { prefs[t.dataset.select] = t.value; savePrefs(); }
    else if (t.dataset.secToggle) {
      const { order, hidden } = sectionPrefs(), id = t.dataset.secToggle;
      prefs.sections = { order, hidden: t.checked ? hidden.filter(k => k !== id) : [...hidden, id] }; savePrefs();
    }
    else if (t.id === 'accent-custom') { prefs.accent = t.value; savePrefs(); }
    else if (t.id === 'island-custom') { prefs.card = t.value; savePrefs(); }
    else if (t.id === 'bg-color') { prefs.bgColor = t.value; prefs.bg = ''; savePrefs(); }
  });
  $('pz-reset').addEventListener('click', () => {
    if (!confirm(`Reset all of ${profile.name}’s customization to the defaults? This also applies on your other synced devices.`)) return;
    prefs = {}; privacyOverride = null; savePrefs();
  });
  $('fab').addEventListener('click', () => {
    document.querySelector('#nav button[data-tab="overview"]').click();
    $('txn-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => $('f-amount').focus({ preventScroll: true }), 350);
  });
  $('eye').addEventListener('click', () => { privacyOverride = !document.body.classList.contains('privacy'); applyPrefs(); });
  $('bg-url-use').addEventListener('click', () => {
    const url = $('bg-url').value.trim();
    if (!/^https?:\/\//i.test(url)) { alert('Paste a link that starts with http:// or https://'); return; }
    prefs.bg = `url("${url.replace(/["\\]/g, encodeURIComponent)}")`; $('bg-url').value = ''; savePrefs();
  });
  $('bg-upload-btn').addEventListener('click', () => $('bg-upload').click());
  $('bg-upload').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      // shrink so it fits in browser storage and syncs quickly
      const img = await createImageBitmap(file);
      const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      prefs.bg = `url("${c.toDataURL('image/jpeg', 0.72)}")`;
      savePrefs();
    } catch { alert('Couldn’t read that image. Try a JPG or PNG.'); }
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderCharts);

  // ---------- backup ----------
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const fileSlug = () => profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
  $('b-export').addEventListener('click', () => {
    download(`wallet-tracker-${fileSlug()}-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
    ls.set(BACKUP_KEY, String(now()));
    render();
  });
  $('b-csv').addEventListener('click', () => {
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['date', 'type', 'wallet', 'to_wallet', 'category', 'amount', 'monthly', 'note'].join(',')];
    [...state.txns].sort((a, b) => a.date.localeCompare(b.date)).forEach(t =>
      lines.push([t.date, t.type, q(walletName(t.walletId)), q(t.toWalletId ? walletName(t.toWalletId) : ''), q(t.category), t.amount, t.recurringId ? 'yes' : '', q(t.note)].join(',')));
    download(`wallet-transactions-${fileSlug()}-${today()}.csv`, lines.join('\n'), 'text/csv');
  });
  $('b-import-btn').addEventListener('click', () => $('b-import').click());
  $('b-import').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.wallets) || !Array.isArray(data.txns)) throw new Error('Not a Wallet Tracker backup');
      if (!confirm(`Replace all of ${profile.name}’s data with this backup?`)) return;
      // tombstone everything currently here so a synced copy doesn't bring it back
      const old = COLS.flatMap(c => state[c].map(r => r.id));
      const keepPrefs = state.prefs;
      state = normalize(data);
      // a backup's look is newer than whatever is synced; without one, keep the current look
      state.prefs = Object.keys(state.prefs).length ? { ...state.prefs, u: now() } : keepPrefs;
      const keep = new Set(COLS.flatMap(c => state[c].map(r => r.id)));
      forget(...old.filter(id => !keep.has(id)));
      save();
    } catch (err) { alert('Import failed: ' + err.message); }
    e.target.value = '';
  });
  $('b-reset').addEventListener('click', () => {
    if (!confirm(`Erase ALL of ${profile.name}’s wallets, entries, monthly items and goals? This cannot be undone.` + (syncCfg ? ' Your other synced devices will be erased too.' : ''))) return;
    const old = COLS.flatMap(c => state[c].map(r => r.id));
    state = { ...freshState(), deleted: state.deleted, prefs: state.prefs };   // erasing data keeps the look
    forget(...old);
    save();
  });

  // ---------- sync via a private GitHub Gist ----------
  const SYNC_KEY = KEY + '.sync';
  const GIST_PREFIX = 'wallet-tracker';
  let syncCfg = ls.json(SYNC_KEY);
  const saveCfg = () => syncCfg ? ls.set(SYNC_KEY, JSON.stringify(syncCfg)) : ls.del(SYNC_KEY);

  async function gh(path, opts = {}) {
    const res = await fetch('https://api.github.com' + path, {
      cache: 'no-store', ...opts,
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + syncCfg.token },
    });
    if (res.status === 401) throw new Error('GitHub rejected the token (expired or wrong).');
    if (res.status === 403 || res.status === 404) throw new Error(`GitHub said ${res.status}. Check the token has the “gist” permission.`);
    if (!res.ok) throw new Error(`GitHub error ${res.status}`);
    return res.json();
  }
  const fmtStamp = iso => iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'unknown';
  async function readGist() {
    // the timestamp keeps Safari from answering with a cached copy
    const g = await gh(`/gists/${syncCfg.gistId}?t=${Date.now()}`);
    const f = g.files?.[syncCfg.file];
    if (!f) return null;
    const text = f.truncated ? await (await fetch(f.raw_url, { cache: 'no-store' })).text() : f.content;
    const parsed = JSON.parse(text);
    syncCfg.remoteEncrypted = isEncrypted(parsed);
    if (!syncCfg.remoteEncrypted) return normalize(parsed);
    // encrypted: this device must never write until it can read it
    syncCfg.salt = parsed.salt;
    const locked = msg => Object.assign(new Error(msg), { code: 'NEEDS_PASSPHRASE' });
    if (!syncCfg.passphrase) throw locked('Synced data is encrypted. Enter the passphrase to sync this device.');
    // while a passphrase change is being written, the file is still locked with the old one
    for (const pass of [syncCfg.passphrase, syncCfg.oldPassphrase].filter(Boolean)) {
      try { return normalize(await decryptJson(parsed, pass)); } catch {}
    }
    delete syncCfg.passphrase;
    throw locked('Wrong passphrase (it may have been changed on another device).');
  }
  // every Wallet Tracker file on this GitHub account: [{ gistId, file }]
  async function listSyncFiles() {
    const found = [];
    for (let page = 1; page <= 10; page++) {
      const list = await gh(`/gists?per_page=100&page=${page}`);
      for (const g of list) for (const name of Object.keys(g.files || {}))
        if (name.startsWith(GIST_PREFIX) && name.endsWith('.json')) found.push({ gistId: g.id, file: name, updated: g.updated_at });
      if (list.length < 100) break;
    }
    return found;
  }
  async function gistBody(data) {
    let content = data;
    if (syncCfg.encrypt && syncCfg.passphrase) {
      content = await encryptJson(data, syncCfg.passphrase, syncCfg.salt);
      syncCfg.salt = content.salt;
    }
    return { files: { [syncCfg.file]: { content: JSON.stringify(content) } } };
  }

  // A profile that has never been used: default wallets only, nothing entered or edited.
  const isPristine = s => !s.txns.length && !s.goals.length && !s.goalEntries.length && !s.recurring.length
    && !s.installments.length && !s.plans.length && !s.loans.length && !s.budgets.length && s.wallets.every(w => !w.u && !w.opening);

  let syncing = false, syncAgain = false, syncTimer;
  function scheduleSync() {
    if (!syncCfg) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(runSync, 1500);
  }
  async function runSync() {
    if (!syncCfg?.gistId || !navigator.onLine) { renderSync(); return; }
    if (syncing) { syncAgain = true; return; }
    syncing = true; renderSync('Syncing…');
    try {
      const remote = await readGist() || normalize({});
      // encryption follows the synced file, unless this device just turned it on/off
      if (!syncCfg.forceWrite) syncCfg.encrypt = !!syncCfg.remoteEncrypted;
      // linked while the file was locked: a brand-new profile takes the synced data as-is
      if (syncCfg.pendingReplace) {
        delete syncCfg.pendingReplace;
        if (isPristine(state)) { state = normalize(remote); applyRecurring(); persist(); render(); }
      }
      const merged = normalize(merge(state, remote));   // uses the latest local state, after the await
      applyRecurringTo(merged);
      if (sig(merged) !== sig(state)) { state = merged; persist(); render(); }
      if (sig(merged) !== sig(remote) || syncCfg.forceWrite) {
        await gh('/gists/' + syncCfg.gistId, { method: 'PATCH', body: JSON.stringify(await gistBody(merged)) });
        syncCfg.remoteEncrypted = !!syncCfg.encrypt;
        delete syncCfg.forceWrite;
        delete syncCfg.oldPassphrase;
        if (!syncCfg.encrypt) delete syncCfg.passphrase;   // encryption was turned off
      }
      syncCfg.lastSync = now(); syncCfg.error = ''; syncCfg.needsPass = false;
    } catch (err) { if (syncCfg) { syncCfg.error = err.message; syncCfg.needsPass = err.code === 'NEEDS_PASSPHRASE'; } }
    if (syncCfg) saveCfg();
    syncing = false; renderSync();
    if (syncAgain) { syncAgain = false; runSync(); }
  }
  function applyRecurringTo(s) { const keep = state; state = s; applyRecurring(); state = keep; }

  async function connectSync(token, { restore = false } = {}) {
    syncCfg = { token, file: `${GIST_PREFIX}-${fileSlug()}.json` };
    renderSync('Connecting…');
    try {
      const files = await listSyncFiles();
      let pick = files.find(f => f.file === syncCfg.file);
      if (!pick && files.length === 1 && restore) pick = files[0];   // restoring: the only synced profile is the one
      else if (!pick && files.length === 1) {
        if (confirm(`This GitHub account already has synced data: “${files[0].file}” (last saved ${fmtStamp(files[0].updated)}).\n\n`
          + `OK = link ${profile.name} to it (choose this if it’s you on another device)\nCancel = keep ${profile.name}’s data separate`)) pick = files[0];
      } else if (!pick && files.length > 1) {
        const n = prompt(`This GitHub account has ${files.length} synced profiles:\n\n`
          + files.map((f, i) => `${i + 1}. ${f.file} (last saved ${fmtStamp(f.updated)})`).join('\n')
          + `\n\nType the number to link ${profile.name} to (the one your other device uses), or leave it empty to keep it separate:`);
        pick = files[parseInt(n, 10) - 1];
      }
      if (pick) {
        Object.assign(syncCfg, pick);
        let remote;
        try { remote = await readGist(); }
        catch (e) {
          if (e.code !== 'NEEDS_PASSPHRASE') throw e;
          // stay linked, ask for the passphrase, and finish on the first successful sync
          Object.assign(syncCfg, { needsPass: true, error: e.message, pendingReplace: isPristine(state) });
          saveCfg(); $('sync-token').value = ''; renderSync(); unlockSync();
          return;
        }
        if (remote && (isPristine(state) || confirm('Found synced data on GitHub.\n\nOK = replace what’s on this device with it\nCancel = merge both (wallets may appear twice)'))) {
          state = remote; applyRecurring(); persist(); render();
        }
      } else {
        if (restore) toast('No synced data found on that GitHub account, so this device starts a new synced profile');
        const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: `Wallet Tracker sync data for ${profile.name} (do not edit)`, public: false, ...(await gistBody(state)) }) });
        syncCfg.gistId = g.id;
      }
      saveCfg();
      $('sync-token').value = '';
      runSync();
    } catch (err) {
      syncCfg = null; saveCfg(); renderSync();
      alert('Could not connect: ' + err.message);
    }
  }

  // ---------- encrypted sync ----------
  const passFields = [{ name: 'a', label: 'Passphrase (at least 8 characters)', type: 'password' }, { name: 'b', label: 'Type it again', type: 'password' }];
  const checkPass = v => v.a.length < 8 ? 'Use at least 8 characters.' : v.a !== v.b ? 'The two passphrases don’t match.' : '';
  function unlockSync() {
    ask({ title: 'Enter your sync passphrase', ok: 'Unlock',
      message: 'This profile’s synced data is encrypted. Enter the passphrase you set on your other device.',
      fields: [{ name: 'p', label: 'Passphrase', type: 'password' }], validate: v => v.p ? '' : 'Enter the passphrase.' },
    ({ p }) => { Object.assign(syncCfg, { passphrase: p, needsPass: false, error: '' }); saveCfg(); runSync(); });
  }
  function setPassphrase(turnOn) {
    ask({ title: turnOn ? 'Encrypt synced data' : 'Change passphrase', ok: turnOn ? 'Encrypt' : 'Change', fields: passFields,
      message: 'The synced file on GitHub becomes unreadable without this passphrase. Enter it once on each of your devices. '
        + 'If you forget it, the synced copy can’t be recovered (the data on your devices is not affected).',
      validate: checkPass },
    ({ a }) => {
      if (!turnOn && syncCfg.passphrase) syncCfg.oldPassphrase = syncCfg.passphrase;   // to read the file one last time
      Object.assign(syncCfg, { passphrase: a, encrypt: true, forceWrite: true });
      delete syncCfg.salt;   // new passphrase, new salt
      saveCfg(); runSync();
      toast(turnOn ? 'Synced data is now encrypted. Enter the passphrase on your other devices.' : 'Passphrase changed. Enter the new one on your other devices.');
    });
  }
  $('sync-enc-btn').addEventListener('click', e => {
    const act = e.target.dataset.act;
    if (act === 'unlock') unlockSync();
    if (act === 'on') setPassphrase(true);
    if (act === 'off' && confirm('Turn off encryption? The synced file on GitHub will be readable again by anyone who gets its link.')) {
      Object.assign(syncCfg, { encrypt: false, forceWrite: true }); saveCfg(); runSync();
    }
  });
  $('sync-enc-change').addEventListener('click', () => setPassphrase(false));

  function renderSync(msg) {
    $('sync-off').hidden = !!syncCfg;
    $('sync-on').hidden = !syncCfg;
    if (!syncCfg) { $('sync-badge').textContent = profile.name; return; }
    const time = syncCfg.lastSync && new Date(syncCfg.lastSync).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
    let text = msg || (syncCfg.error ? 'Sync failed: ' + syncCfg.error : time ? 'Synced ' + time : 'Not synced yet');
    if (!msg && !navigator.onLine) text = 'Offline: changes will sync when you’re back online';
    $('sync-status').textContent = text;
    $('sync-detail').textContent = syncCfg.gistId
      ? `This device syncs “${profile.name}” with ${syncCfg.file} (Gist ${syncCfg.gistId.slice(0, 7)}). Your other devices should show the same file and Gist.`
      : '';
    const [encText, encAct, encLabel] = syncCfg.needsPass
      ? ['🔒 The synced data is encrypted. Enter the passphrase to sync this device.', 'unlock', 'Enter passphrase']
      : syncCfg.encrypt ? ['🔒 Encrypted: the synced file can only be read with your passphrase.', 'off', 'Turn off encryption']
        : ['Not encrypted: anyone with the Gist link could read the synced file.', 'on', 'Encrypt with a passphrase'];
    $('sync-enc-state').textContent = encText;
    $('sync-enc-btn').textContent = encLabel;
    $('sync-enc-btn').dataset.act = encAct;
    $('sync-enc-btn').classList.toggle('primary', encAct === 'unlock');
    $('sync-enc-change').hidden = !syncCfg.encrypt || syncCfg.needsPass;
    const short = msg || (!navigator.onLine ? 'Offline' : syncCfg.needsPass ? '🔒 Needs passphrase' : syncCfg.error ? '⚠ Sync failed' : time ? '✓ Synced ' + time : '');
    $('sync-badge').textContent = profile.name + (short ? ' · ' + short : '') + (syncCfg.encrypt && !syncCfg.needsPass ? ' · 🔒' : '');
  }

  $('sync-connect').addEventListener('click', () => {
    const token = $('sync-token').value.trim();
    if (!token) { alert('Paste your GitHub token first.'); return; }
    connectSync(token);
  });
  $('sync-now').addEventListener('click', runSync);
  $('sync-disconnect').addEventListener('click', () => {
    if (!confirm('Stop syncing on this device? Your data stays here and on GitHub.')) return;
    syncCfg = null; saveCfg(); renderSync();
  });
  // switch this device to a different synced file on the same GitHub account
  $('sync-change').addEventListener('click', async () => {
    renderSync('Looking up synced data…');
    try {
      const files = await listSyncFiles();
      $('sync-files').innerHTML = files.map((f, i) => `<option value="${i}" ${f.gistId === syncCfg.gistId && f.file === syncCfg.file ? 'selected' : ''}>
        ${esc(f.file)} · last saved ${esc(fmtStamp(f.updated))}${f.gistId === syncCfg.gistId && f.file === syncCfg.file ? ' (this device)' : ''}</option>`).join('');
      $('sync-files').dataset.files = JSON.stringify(files);
      $('sync-pick').hidden = false;
    } catch (err) { alert('Could not list synced data: ' + err.message); }
    renderSync();
  });
  $('sync-pick-cancel').addEventListener('click', () => { $('sync-pick').hidden = true; });
  $('sync-link').addEventListener('click', () => {
    const f = JSON.parse($('sync-files').dataset.files)[$('sync-files').value];
    if (!f) return;
    if (!confirm(`Link this device to ${f.file}? What’s on this device will be merged into it.`)) return;
    Object.assign(syncCfg, { gistId: f.gistId, file: f.file, error: '' });
    saveCfg(); $('sync-pick').hidden = true;
    runSync();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (applyRecurring()) { persist(); render(); }   // a new month may have started
    runSync();
  });
  // iOS restores home-screen apps from memory without always firing visibilitychange
  addEventListener('pageshow', () => runSync());
  addEventListener('focus', () => runSync());
  // pick up changes from other devices while the app stays open
  setInterval(() => { if (document.visibilityState === 'visible' && !syncing) runSync(); }, 30000);
  addEventListener('online', runSync);
  addEventListener('offline', () => renderSync());

  // ---------- charts ----------
  const charts = {};
  // read tokens from a chart card, since custom card colors re-scope them there
  const css = name => getComputedStyle($('ch-monthly').closest('.card')).getPropertyValue(name).trim();

  function baseOptions() {
    const muted = css('--muted'), text = css('--text');
    return {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: css('--text-2'), boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2 } },
        tooltip: {
          backgroundColor: css('--surface'), titleColor: text, bodyColor: text, borderColor: css('--axis'), borderWidth: 1,
          padding: 10, boxPadding: 4, usePointStyle: true,
          callbacks: { label: c => ` ${c.dataset.label}: ${peso(c.parsed.y ?? c.parsed.x)}` },
        },
      },
      scales: {
        x: { grid: { display: false }, border: { color: css('--axis') }, ticks: { color: muted } },
        y: { beginAtZero: true, grid: { color: css('--grid') }, border: { display: false },
             ticks: { color: muted, callback: v => '₱' + Number(v).toLocaleString('en-PH', { notation: 'compact' }) } },
      },
    };
  }

  function draw(id, config) {
    charts[id]?.destroy();
    charts[id] = new Chart($(id), config);
  }

  function renderCharts() {
    if (typeof Chart === 'undefined') return;

    if ($('tab-overview').classList.contains('active')) {
      const months = lastMonths(6);
      const totals = months.map(monthTotals);
      const bar = { borderRadius: { topLeft: 4, topRight: 4 }, borderSkipped: 'start', barPercentage: 0.8, categoryPercentage: 0.6 };
      draw('ch-monthly', {
        type: 'bar',
        data: {
          labels: months.map(monthLabel),
          datasets: [
            { label: 'Revenue', data: totals.map(t => t.income), backgroundColor: css('--series-1'), ...bar },
            { label: 'Expenses', data: totals.map(t => t.expense), backgroundColor: css('--series-2'), ...bar },
          ],
        },
        options: baseOptions(),
      });

      const ym = $('cat-month').value || thisMonth();
      const byCat = {};
      state.txns.filter(t => t.type === 'expense' && t.date.startsWith(ym)).forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
      const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      $('cat-empty').hidden = sorted.length > 0;
      $('ch-category').parentElement.hidden = sorted.length === 0;
      if (sorted.length) {
        const opts = baseOptions();
        opts.indexAxis = 'y';
        opts.plugins.legend.display = false;
        opts.plugins.tooltip.callbacks.label = c => {
          const total = sorted.reduce((s, [, v]) => s + v, 0);
          return ` ${peso(c.parsed.x)} (${(c.parsed.x / total * 100).toFixed(0)}%)`;
        };
        [opts.scales.x, opts.scales.y] = [opts.scales.y, opts.scales.x];
        opts.scales.x.grid = { color: css('--grid') };
        opts.scales.y.ticks = { color: css('--text-2') };
        draw('ch-category', {
          type: 'bar',
          data: { labels: sorted.map(([k]) => k), datasets: [{ label: 'Spent', data: sorted.map(([, v]) => v), backgroundColor: css('--series-2'),
            borderRadius: { topRight: 4, bottomRight: 4 }, borderSkipped: 'start', barPercentage: 0.7, categoryPercentage: 0.9 }] },
          options: opts,
        });
      }
    }

    if ($('tab-savings').classList.contains('active')) {
      const entries = [...state.goalEntries].sort((a, b) => a.date.localeCompare(b.date));
      $('sv-empty').hidden = entries.length > 0;
      $('ch-savings').parentElement.hidden = entries.length === 0;
      if (entries.length) {
        const byDate = new Map(); let running = 0;
        entries.forEach(e => { running += e.amount; byDate.set(e.date, running); });
        if (!byDate.has(today())) byDate.set(today(), running);
        const opts = baseOptions();
        opts.plugins.legend.display = false;
        draw('ch-savings', {
          type: 'line',
          data: { labels: [...byDate.keys()], datasets: [{ label: 'Saved', data: [...byDate.values()], borderColor: css('--series-1'),
            backgroundColor: css('--series-1'), borderWidth: 2, stepped: true, pointRadius: 0, pointHoverRadius: 5, pointHitRadius: 12 }] },
          options: opts,
        });
      }
    }
  }
  $('cat-month').addEventListener('input', renderCharts);

  // ---------- render ----------
  function renderWalletOptions() {
    const optList = ws => ws.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join('');
    const opts = creditCards().length
      ? `<optgroup label="Wallets">${optList(cashWallets())}</optgroup><optgroup label="Credit cards">${optList(creditCards())}</optgroup>`
      : optList(state.wallets);
    const keep = id => { const el = $(id); const v = el.value; return () => { if ([...el.options].some(o => o.value === v)) el.value = v; }; };
    const r1 = keep('f-wallet'), r2 = keep('f-to'), r3 = keep('t-wallet');
    $('f-wallet').innerHTML = opts;
    $('f-to').innerHTML = opts;
    if (!$('f-to').value || $('f-to').value === $('f-wallet').value) $('f-to').selectedIndex = Math.min(1, state.wallets.length - 1);
    $('t-wallet').innerHTML = '<option value="">All wallets</option>' + opts;
    r1(); r2(); r3();
  }

  function render() {
    // state was replaced (sync, import, reset): pick up its look
    if (prefs !== state.prefs) { prefs = state.prefs || (state.prefs = {}); applyPrefs(); renderPrefs(); }
    const total = cashWallets().reduce((s, w) => s + balanceOf(w.id), 0);
    const owed = renderCards();
    renderSummary();
    renderIcsInfo();
    renderBudgets();   // before renderLoans, which draws the shared alert box
    renderLoans();
    const m = monthTotals(thisMonth());
    $('st-total').textContent = peso(total);
    $('st-total-sub').textContent = creditCards().length ? `${peso(total - owed)} after card debt` : '';
    $('st-income').textContent = peso(m.income);
    $('st-expense').textContent = peso(m.expense);
    $('st-net').textContent = peso(m.net);
    $('st-net').className = 'value ' + (m.net > 0 ? 'pos' : m.net < 0 ? 'neg' : '');

    $('wallet-list').innerHTML = cashWallets().map(w => `<div class="wallet">
      <div class="name">${esc(w.name)}</div><div class="bal">${peso(balanceOf(w.id))}</div>
      <button class="link" data-rec="${w.id}" style="padding:0">Update balance</button></div>`).join('') ||
      '<div class="empty">No wallets. Add one in Settings.</div>';

    $('w-body').innerHTML = cashWallets().map(w => `<tr><td>${esc(w.name)}</td><td class="num">${peso(Number(w.opening) || 0)}</td>
      <td class="num">${peso(balanceOf(w.id))}</td>
      <td><button class="link" data-act="rename" data-id="${w.id}">Rename</button><button class="link" data-act="opening" data-id="${w.id}">Edit start</button><button class="link danger" data-act="del" data-id="${w.id}">Remove</button></td></tr>`).join('');

    renderWalletOptions();
    setType(entryType);
    renderRecurring();
    renderInstallments();
    renderPlans();
    renderTxns();
    renderGoals();

    const goalTotal = state.goals.reduce((s, g) => s + goalSaved(g.id), 0);
    $('sv-total').textContent = peso(goalTotal);
    $('sv-month').textContent = peso(m.net);
    $('sv-month').className = 'value ' + (m.net > 0 ? 'pos' : m.net < 0 ? 'neg' : '');
    $('sv-rate').textContent = m.income > 0 ? (m.net / m.income * 100).toFixed(0) + '%' : '—';
    const six = lastMonths(6).map(monthTotals);
    $('sv-avg').textContent = peso(six.reduce((s, t) => s + t.net, 0) / 6);

    renderCharts();
  }

  $('wallet-list').addEventListener('click', e => { if (e.target.dataset.rec) reconcile(e.target.dataset.rec); });

  $('f-date').value = today();
  $('cat-month').value = thisMonth();
  $('t-month').value = thisMonth();
  if (applyRecurring()) persist();
  applyPrefs();
  renderPrefs();
  renderProfile();
  render();
  if (pref('startTab') !== 'overview') document.querySelector(`#nav [data-tab="${pref('startTab')}"]`)?.click();
  $('app-version').textContent = APP_VERSION;
  renderSync();
  // finishing a sign-up that chose "restore from another device"
  const restoreToken = ss.get(RESTORE_KEY);
  if (restoreToken) { ss.del(RESTORE_KEY); connectSync(restoreToken, { restore: true }); }
  else runSync();
})();
