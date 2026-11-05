// Monthly budgets per expense category.
import { round2 } from './format.js';

export const NEAR = 0.8;   // warn from 80% of the limit

// budgets: [{ id, category, limit }], txns: all entries, ym: 'YYYY-MM'
// → each budget with spent, left, pct (0–1+) and level 'ok' | 'near' | 'over'
export function budgetStatus(budgets, txns, ym) {
  const spentBy = {};
  for (const t of txns) {
    if (t.type !== 'expense' || !t.date.startsWith(ym)) continue;
    const key = (t.category || 'Other').trim().toLowerCase();
    spentBy[key] = (spentBy[key] || 0) + t.amount;
  }
  return budgets.map(b => {
    const spent = round2(spentBy[b.category.trim().toLowerCase()] || 0);
    const pct = b.limit > 0 ? spent / b.limit : 0;
    return { ...b, spent, left: round2(b.limit - spent), pct, level: pct > 1 ? 'over' : pct >= NEAR ? 'near' : 'ok' };
  }).sort((a, b) => b.pct - a.pct);
}
