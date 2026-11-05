// Profile data shape and the sync merge. Every record carries `u` (last-modified ms) and deletions
// leave a tombstone in `deleted`, so two devices can be merged record by record.

export const COLS = ['wallets', 'txns', 'goals', 'goalEntries', 'recurring', 'installments', 'plans', 'loans'];

export const normalize = s => ({ wallets: [], txns: [], goals: [], goalEntries: [], recurring: [], installments: [], plans: [],
  loans: [], deleted: {}, prefs: {}, ...s });

export function merge(a, b) {
  const deleted = { ...a.deleted };
  for (const [id, ts] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, ts);
  const out = { deleted };
  // also carry collections this version doesn't know about, so an older copy of the app
  // on another device can't wipe out data a newer version added
  const cols = new Set([...COLS, ...[a, b].flatMap(s => Object.keys(s).filter(k => Array.isArray(s[k])))]);
  for (const col of cols) {
    const m = new Map();
    for (const r of [...(a[col] || []), ...(b[col] || [])]) {
      const cur = m.get(r.id);
      if (!cur || (r.u || 0) > (cur.u || 0)) m.set(r.id, r);
    }
    // a tombstone hides a record only if it's newer than the record's last change, so a record
    // restored with Undo (fresh u) beats an older delete
    out[col] = [...m.values()].filter(r => !(r.id in deleted) || (r.u || 0) > deleted[r.id]);
  }
  // the look is one record per profile: the most recently changed one wins
  out.prefs = ((a.prefs?.u || 0) >= (b.prefs?.u || 0) ? a.prefs : b.prefs) || {};
  return out;
}

// cheap fingerprint of a profile's data, to tell whether a merge changed anything
export const sig = s => JSON.stringify([COLS.map(c => (s[c] || []).map(r => r.id + ':' + (r.u || 0)).sort()),
  Object.keys(s.deleted || {}).sort(), s.prefs?.u || 0]);
