/** Convert MongoDB API documents into the stable shape used by the React UI. */
export const idOf = (value) => value && typeof value === 'object'
  ? String(value._id || value.id || '')
  : String(value || '');

export function dateOnly(value) {
  if (!value) return '';
  // MongoDB date-only strings should not shift to the previous day in negative UTC offsets.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function dateOnlyUTC(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function zonedParts(value, timezone = 'Asia/Karachi') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date).map((part) => [part.type, part.value]));
  } catch {
    return null;
  }
}

export function dateOnlyInTimezone(value, timezone = 'Asia/Karachi') {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = zonedParts(value, timezone);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : '';
}

export function timeOnlyInTimezone(value, timezone = 'Asia/Karachi') {
  if (!value) return '';
  const parts = zonedParts(value, timezone);
  return parts ? `${parts.hour}:${parts.minute}` : '';
}

export function timeOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function normalizeExpo(expo) {
  const location = expo.location || {};
  return {
    ...expo,
    id: idOf(expo),
    city: location.city || '',
    location: [location.venue, location.address, location.city, location.country].filter(Boolean).join(', '),
    venue: location.venue || '',
    address: location.address || '',
    city: location.city || '',
    country: location.country || '',
    registrationDeadline: dateOnlyUTC(expo.registrationDeadline),
    startDate: dateOnlyUTC(expo.startDate),
    endDate: dateOnlyUTC(expo.endDate),
    startTime: expo.startTime || '09:00',
    endTime: expo.endTime || '18:00',
    timezone: expo.timezone || 'Asia/Karachi',
    status: ({ published: 'upcoming', ongoing: 'live', cancelled: 'cancelled' })[expo.status] || expo.status,
    layout: { rows: 5, cols: 8 },
    tags: Array.isArray(expo.tags) ? expo.tags : [],
    hue: 205,
    ticketPrice: Number(expo.ticketPrice || 0),
  };
}

export function normalizeBooth(booth, user) {
  const exhibitorId = idOf(booth.exhibitor) || null;
  let status = booth.status === 'occupied' ? 'booked' : booth.status;
  const position = booth.position || {};
  return {
    ...booth,
    id: idOf(booth),
    expoId: idOf(booth.expo),
    label: booth.boothNumber,
    exhibitorId,
    owner: booth.exhibitor || null,
    row: Math.max(0, Math.floor(Number(position.y || 0) / 20)),
    col: Math.max(0, Math.floor(Number(position.x || 0) / 12.5)),
    status,
    visits: Number(booth.visits || 0),
    showcase: booth.showcase || null,
    zone: booth.zone || 'Main Hall',
  };
}

export function normalizeSession(session) {
  const speaker = Array.isArray(session.speakers) ? session.speakers[0] : null;
  const timezone = session.expo?.timezone || session.timezone || 'Asia/Karachi';
  return {
    ...session,
    id: idOf(session),
    expoId: idOf(session.expo),
    date: dateOnlyInTimezone(session.startTime, timezone),
    start: timeOnlyInTimezone(session.startTime, timezone),
    end: timeOnlyInTimezone(session.endTime, timezone),
    timezone,
    type: session.category || 'Talk',
    topic: session.title,
    speaker: speaker?.name || 'Speaker TBA',
    speakerRole: speaker?.designation || speaker?.company || '',
    capacity: Number(session.capacity || 100),
    registeredCount: Number(session.registeredCount || 0),
    remote: true,
    interest: 0,
    expoTitle: session.expo?.title || '', 
  };
}

export const normalizeUser = (user) => ({
  ...user,
  id: idOf(user),
  company: user.company || '',
  status: user.status || 'active',
});
