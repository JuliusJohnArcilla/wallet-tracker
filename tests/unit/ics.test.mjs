import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcs } from '../../src/lib/ics.js';

test('builds a valid all-day calendar with day-before reminders', () => {
  const ics = buildIcs([
    { uid: 'card-1-2026-11-15@wallet-tracker', date: '2026-11-15', title: 'BPI, Amore; payment ₱12,450.00', description: 'line1\nline2' },
    { uid: 'bill-2-2026-12@wallet-tracker', date: '2026-12-31', title: 'Internet ₱1,899.00' },
  ], new Date('2026-11-05T01:02:03Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART;VALUE=DATE:20261115\r\nDTEND;VALUE=DATE:20261116/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/, 'end date rolls over the year');
  assert.ok(ics.includes(String.raw`SUMMARY:BPI\, Amore\; payment ₱12\,450.00`), 'commas and semicolons escaped');
  assert.ok(ics.includes(String.raw`DESCRIPTION:line1\nline2`), 'newlines escaped');
  assert.match(ics, /TRIGGER:-PT15H/);
  assert.match(ics, /DTSTAMP:20261105T010203Z/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line}`);
});

test('folds long lines', () => {
  const ics = buildIcs([{ uid: 'x', date: '2026-11-15', title: 'A'.repeat(200) }]);
  assert.match(ics, /\r\n A/);
});
