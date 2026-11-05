// Month-to-date spending compared with the same days of the previous month.
import { prevYm, pad, round2 } from './format.js';

// txns: all entries; date: today as 'YYYY-MM-DD'
export function monthSummary(txns, date) {
  const ym = date.slice(0, 7), day = Number(date.slice(8, 10)), last = prevYm(ym);
  const lastCutoff = `${last}-${pad(day)}`;   // same day of last month ('-31' still sorts after every real day)
  const now = {}, prev = {};
  let spent = 0, prevSpent = 0;
  for (const t of txns) {
    if (t.type !== 'expense') continue;
    const cat = t.category || 'Other';
    if (t.date.startsWith(ym) && t.date <= date) { spent += t.amount; now[cat] = (now[cat] || 0) + t.amount; }
    else if (t.date.startsWith(last) && t.date <= lastCutoff) { prevSpent += t.amount; prev[cat] = (prev[cat] || 0) + t.amount; }
  }
  const cats = [...new Set([...Object.keys(now), ...Object.keys(prev)])]
    .map(category => ({ category, now: round2(now[category] || 0), prev: round2(prev[category] || 0) }))
    .map(c => ({ ...c, diff: round2(c.now - c.prev) }))
    .filter(c => c.diff !== 0)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  return {
    day, ym, last,
    spent: round2(spent), prevSpent: round2(prevSpent),
    change: prevSpent > 0 ? (spent - prevSpent) / prevSpent : null,   // null when there's nothing to compare
    biggest: cats.slice(0, 3),
    top: Object.entries(now).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
  };
}
