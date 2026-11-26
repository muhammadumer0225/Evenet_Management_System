/** Derived-data helpers (pure functions over the db snapshot). */

export const expoById = (d, id) => d.expos.find((e) => e.id === id);
export const userById = (d, id) => d.users.find((u) => u.id === id);
export const publicExpos = (d) => d.expos.filter((e) => e.status !== 'draft');

export const boothsOf = (d, expoId) => d.booths.filter((b) => b.expoId === expoId);

export function expoStats(d, expoId) {
  const booths = boothsOf(d, expoId).filter((b) => b.status !== 'blocked');
  const booked = booths.filter((b) => b.status === 'booked').length;
  const reserved = booths.filter((b) => b.status === 'reserved').length;
  const total = booths.length;
  return {
    total,
    booked,
    reserved,
    available: total - booked - reserved,
    occupancy: total ? Math.round(((booked + reserved) / total) * 100) : 0,
    exhibitors: new Set(booths.filter((b) => b.exhibitorId).map((b) => b.exhibitorId)).size,
    registrations: d.registrations.filter((r) => r.expoId === expoId).length,
    sessions: d.sessions.filter((s) => s.expoId === expoId).length,
    pending: d.applications.filter((a) => a.expoId === expoId && a.status === 'pending').length,
  };
}

/** Exhibitors that hold a booth at an expo (public directory). */
export function expoExhibitors(d, expoId) {
  return boothsOf(d, expoId)
    .filter((b) => b.exhibitorId && b.status === 'booked')
    .map((b) => ({ booth: b, user: userById(d, b.exhibitorId) }))
    .filter((x) => x.user && x.user.status === 'active' && x.user.consent?.directory !== false);
}

export const unreadNotifications = (d, userId) => d.notifications.filter((n) => n.userId === userId && !n.read).length;
export const unreadMessages = (d, userId) => d.messages.filter((m) => m.to === userId && !m.read).length;

export function threadsFor(d, me) {
  const map = new Map();
  d.messages
    .filter((m) => m.from === me || m.to === me)
    .forEach((m) => {
      const other = m.from === me ? m.to : m.from;
      const t = map.get(other) || { other, last: m, unread: 0 };
      if (new Date(m.createdAt) > new Date(t.last.createdAt)) t.last = m;
      if (m.to === me && !m.read) t.unread++;
      map.set(other, t);
    });
  return [...map.values()]
    .filter((t) => userById(d, t.other))
    .sort((a, b) => new Date(b.last.createdAt) - new Date(a.last.createdAt));
}

export function sessionCounts(d, sessionId) {
  const regs = d.sessionRegs.filter((r) => r.sessionId === sessionId);
  return {
    registered: regs.filter((r) => r.type === 'register').length,
    bookmarked: regs.filter((r) => r.type === 'bookmark').length,
  };
}

export function sessionSeats(d, s) {
  const c = sessionCounts(d, s.id);
  const taken = c.registered + Math.round((s.interest || 0) / 4);
  return { taken: Math.min(taken, s.capacity), capacity: s.capacity, full: taken >= s.capacity, pct: Math.min(100, Math.round((taken / s.capacity) * 100)) };
}

export const sessionPopularity = (d, s) => {
  const c = sessionCounts(d, s.id);
  return (s.interest || 0) + c.registered * 5 + c.bookmarked * 2;
};

export const myRegistration = (d, userId, expoId) => d.registrations.find((r) => r.userId === userId && r.expoId === expoId);

export const mySessionState = (d, userId, sessionId) => {
  const rs = d.sessionRegs.filter((r) => r.userId === userId && r.sessionId === sessionId);
  return { registered: rs.some((r) => r.type === 'register'), bookmarked: rs.some((r) => r.type === 'bookmark') };
};

/** Booths adjacent (incl. diagonals) to a given booth that are occupied. */
export function neighborsOf(d, booth) {
  return boothsOf(d, booth.expoId)
    .filter((b) => b.id !== booth.id && b.exhibitorId && Math.abs(b.row - booth.row) <= 1 && Math.abs(b.col - booth.col) <= 1)
    .map((b) => ({ booth: b, user: userById(d, b.exhibitorId) }))
    .filter((x) => x.user);
}

export function profileCompleteness(u) {
  if (u.role !== 'exhibitor') return 100;
  const checks = [u.company, u.tagline, u.description?.length > 40, u.website, u.logo, u.products?.length >= 2, u.staff?.length >= 1, u.phone];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export const TICKETS = [
  { name: 'Standard', mult: 1, perks: ['Expo floor access', 'Session registration', 'Digital pass'] },
  { name: 'Premium', mult: 2, perks: ['Everything in Standard', 'Priority entry', 'Premium lounge', 'Workshop seats'] },
  { name: 'VIP', mult: 4, perks: ['Everything in Premium', 'VIP networking dinner', 'Speaker meet & greet', 'Reserved keynote seating'] },
];
