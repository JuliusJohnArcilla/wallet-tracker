// Payment schedules for loans and credit card installments.
import { addDays, dayIn, nextYm, round2 } from './format.js';

// Loan payment due dates. One-time loans have a single payment on `due`; installment loans split
// the total evenly (the last payment absorbs rounding). Twice-a-month means the 15th and month end.
export function loanSchedule(l) {
  const total = l.total || l.principal;
  if (!l.freq) return [{ n: 1, date: l.due, amount: total }];
  const count = Math.max(1, l.count || 1), per = round2(total / count), out = [];
  let ym = l.firstDue.slice(0, 7), half = Number(l.firstDue.slice(8, 10)) <= 15 ? 0 : 1;
  const anchor = Number(l.firstDue.slice(8, 10));
  for (let k = 0; k < count; k++) {
    let date;
    if (l.freq === 'weekly') date = addDays(l.firstDue, 7 * k);
    else if (l.freq === 'biweekly') date = addDays(l.firstDue, 14 * k);
    else if (l.freq === 'monthly') { date = dayIn(ym, anchor); ym = nextYm(ym); }
    else { date = half === 0 ? `${ym}-15` : dayIn(ym, 31); if (half === 1) ym = nextYm(ym); half = 1 - half; }
    out.push({ n: k + 1, date, amount: k === count - 1 ? round2(total - per * (count - 1)) : per });
  }
  return out;
}

// Installment plan p = { id, total, months, rate (monthly add-on %), purchaseDate, closedAt }.
export const instMonthly = p => round2(p.total / p.months + p.total * (p.rate || 0) / 100);
export const instPayable = p => round2(p.total + p.total * (p.rate || 0) / 100 * p.months);

// One charge per statement date (the card's closing day), starting with the first statement
// on/after the purchase. Ids are plan#k so synced devices never double-bill.
export function instSchedule(p, closeDay) {
  let ym = p.purchaseDate.slice(0, 7);
  if (dayIn(ym, closeDay) < p.purchaseDate) ym = nextYm(ym);
  const monthly = instMonthly(p), out = [];
  for (let k = 0; k < p.months; k++, ym = nextYm(ym)) {
    const date = dayIn(ym, closeDay);
    if (p.closedAt && date > p.closedAt) break;
    out.push({ id: `${p.id}#${k}`, n: k + 1, date, amount: k === p.months - 1 ? round2(instPayable(p) - monthly * (p.months - 1)) : monthly });
  }
  return out;
}
