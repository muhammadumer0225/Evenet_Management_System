export const cx = (...a) => a.filter(Boolean).join(' ');

export const uid = (p = 'id') =>
  `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;

export const pad = (n) => String(n).padStart(2, '0');

/** Local date -> YYYY-MM-DD */
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** YYYY-MM-DD -> local Date (no timezone shift) */
export const parseYmd = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

export const addDays = (n, from = new Date()) => {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + n);
  return ymd(d);
};

export const addDaysTo = (dateStr, n) => addDays(n, parseYmd(dateStr));

export const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);

export const fmtDate = (s, opts = { month: 'short', day: 'numeric', year: 'numeric' }) =>
  s ? parseYmd(s).toLocaleDateString('en-US', opts) : '—';

export const fmtRange = (start, end) => {
  if (!start) return '—';
  if (!end || start === end) return fmtDate(start);
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${a.toLocaleDateString('en-US', { month: 'short' })} ${a.getDate()}–${b.getDate()}, ${b.getFullYear()}`;
  }
  return `${fmtDate(start, { month: 'short', day: 'numeric' })} – ${fmtDate(end)}`;
};

export const fmtTime = (hhmm) => {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
};

/** Convert a venue-local YYYY-MM-DD + HH:mm wall time into an ISO instant. */
export function zonedDateTimeToISO(date, time, timeZone = 'Asia/Karachi') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time))) {
    throw new Error('Choose a valid date and time.');
  }
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
    const correction = target - represented;
    instant += correction;
    if (correction === 0) break;
  }
  const result = new Date(instant);
  const check = formatter.formatToParts(result);
  const actual = Object.fromEntries(check.map((part) => [part.type, part.value]));
  if (`${actual.year}-${actual.month}-${actual.day}T${actual.hour}:${actual.minute}` !== `${date}T${time}`) {
    throw new Error('This local time does not exist in the selected Expo timezone (daylight-saving time change).');
  }
  return result.toISOString();
}

export const sessionStart = (s) => {
  if (s?.startTime) {
    const instant = new Date(s.startTime);
    if (!Number.isNaN(instant.getTime())) return instant;
  }
  const d = parseYmd(s.date);
  const [h, m] = String(s.start || '00:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};
export const sessionEnd = (s) => {
  if (s?.endTime) {
    const instant = new Date(s.endTime);
    if (!Number.isNaN(instant.getTime())) return instant;
  }
  const d = parseYmd(s.date);
  const [h, m] = String(s.end || '00:00').split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

export const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

export const money = (n) => `PKR ${Number(n || 0).toLocaleString('en-PK')}`;

export const hueOf = (str = '') => {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return h;
};

export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function downloadFile(filename, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => esc(r[k])).join(','))].join('\n');
  downloadFile(filename, csv, 'text/csv');
}

export function passwordStrength(pw = '') {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) score++;
  const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];
  return { score, label: pw ? labels[score] : '' };
}

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s || '');

export function icsFor(session, expo) {
  const formatUtc = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) throw new Error('Cannot export a session with an invalid date/time.');
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };
  const escapeIcsText = (value) => String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventSphere//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(session.id)}@eventsphere`,
    `DTSTART:${formatUtc(session.startTime || sessionStart(session))}`,
    `DTEND:${formatUtc(session.endTime || sessionEnd(session))}`,
    `SUMMARY:${escapeIcsText(session.title)}`,
    `LOCATION:${escapeIcsText(`${session.room || ''}${expo ? ' — ' + (expo.location || '') : ''}`)}`,
    `DESCRIPTION:${escapeIcsText(session.description || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
