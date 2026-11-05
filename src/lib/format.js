// Small pure helpers: ids, dates as YYYY-MM-DD strings, money and text formatting.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const pad = n => String(n).padStart(2, '0');
export const ymd = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
export const today = () => ymd(new Date());
export const thisMonth = () => today().slice(0, 7);
export const nextYm = ym => { const [y, m] = ym.split('-').map(Number); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; };
export const prevYm = ym => { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${pad(m - 1)}`; };
// day `d` of month `ym`, clamped to the month's length (Feb 31 → Feb 28/29)
export const dayIn = (ym, d) => { const [y, m] = ym.split('-').map(Number); return `${ym}-${pad(Math.min(d, new Date(y, m, 0).getDate()))}`; };
export const addDays = (d, n) => { const x = new Date(d + 'T00:00'); x.setDate(x.getDate() + n); return ymd(x); };
export const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00') - new Date(a + 'T00:00')) / 86400000);
export const daysUntil = d => daysBetween(today(), d);
export const lastMonths = n => {
  const out = [], d = new Date();
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(`${x.getFullYear()}-${pad(x.getMonth() + 1)}`); }
  return out;
};

export const round2 = n => Math.round(n * 100) / 100;
export const peso = n => (n < 0 ? '−₱' : '₱') + Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
export const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-PH', { month: 'short', year: '2-digit' }); };

// escape user text before putting it into HTML (prevents script injection)
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// true when dark text reads better than light text on this color (WCAG contrast)
export const isLight = hex => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (L + 0.05) / 0.067 >= 0.86 / (L + 0.05);   // vs #2b2116 and #f1e9dd
};
