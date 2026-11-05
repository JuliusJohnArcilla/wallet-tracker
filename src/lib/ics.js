// Calendar (.ics) file with all-day events and a reminder at 9:00 the day before.

const escText = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = d => d.replace(/-/g, '');
const nextDay = d => { const x = new Date(d + 'T00:00'); x.setDate(x.getDate() + 1); return `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, '0')}${String(x.getDate()).padStart(2, '0')}`; };

// UTF-8 byte length of one character (₱ is 3 bytes, emoji 4)
const utf8 = ch => { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };

// Long lines must be folded at 75 octets: continuation lines start with a space.
function fold(line) {
  if ([...line].reduce((n, ch) => n + utf8(ch), 0) <= 75) return line;
  const out = []; let cur = '', size = 0;
  for (const ch of line) {
    const n = utf8(ch);
    if (size + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; size = 0; }
    cur += ch; size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// events: [{ uid, date: 'YYYY-MM-DD', title, description }]; stamp: Date for DTSTAMP
export function buildIcs(events, stamp = new Date()) {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wallet Tracker//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Wallet Tracker'];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${dtstamp}`, `DTSTART;VALUE=DATE:${compact(e.date)}`,
      `DTEND;VALUE=DATE:${nextDay(e.date)}`, `SUMMARY:${escText(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${escText(e.description)}`);
    lines.push('TRANSP:TRANSPARENT', 'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(e.title)}`, 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
