// Adds the plan to the iPhone/iPad Calendar with reminders (reliable alerts, even offline).
const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
const stamp = (date, time) => date.replace(/-/g, '') + 'T' + (time || '09:00').replace(':', '') + '00';

export function buildICS(trip, items, tickets) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TRIPPIN//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(trip?.name || 'TRIPPIN')}`];
  const ev = (uid, date, time, title, desc, alarmMin) => {
    if (!date) return;
    const start = stamp(date, time);
    const endH = time ? String(Math.min(23, Number(time.slice(0, 2)) + 1)).padStart(2, '0') + time.slice(2) : '10:00';
    lines.push('BEGIN:VEVENT', `UID:${uid}@trippin`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
      `DTSTART:${start}`, `DTEND:${stamp(date, endH)}`, `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`);
    if (alarmMin) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:-PT${alarmMin}M`, 'END:VALARM');
    lines.push('END:VEVENT');
  };
  for (const it of items) if (it.time) ev(it.id, it.date, it.time, it.title, it.sub || it.note || '', 30);
  for (const t of tickets) if (!items.some((i) => i.ticketId === t.id)) ev(t.id, t.date, t.time, t.title, [t.confirmation && 'Conf. ' + t.confirmation, t.seat && 'Seat ' + t.seat].filter(Boolean).join(' · '), t.kind === 'train' || t.kind === 'flight' ? 60 : 30);
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(trip, items, tickets) {
  const blob = new Blob([buildICS(trip, items, tickets)], { type: 'text/calendar' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (trip?.name || 'trip').replace(/\W+/g, '-') + '.ics';
  document.body.appendChild(a); a.click(); a.remove();
}
