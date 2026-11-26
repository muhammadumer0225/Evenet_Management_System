import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarX } from 'lucide-react';
import { SessionCard } from '../components/Cards';
import { EmptyState, PageHeader, SearchBox } from '../components/ui';
import { getPublishedExpos, getPublishedSessions } from '../lib/api';
import { normalizeExpo, normalizeSession } from '../lib/normalizers';
import { SESSION_TYPES } from '../lib/seed';
import { fmtDate } from '../lib/utils';
import { useExpoRealtimeVersion } from '../hooks/useExpoRealtimeVersion';

export default function Schedule() {
  const realtimeVersion = useExpoRealtimeVersion();
  const [expos, setExpos] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getPublishedExpos(), getPublishedSessions()])
      .then(([expoData, sessionData]) => {
        if (!active) return;
        const normalizedExpos = expoData.map(normalizeExpo).filter((expo) => sessionData.some((session) => String(session.expo?._id || session.expo) === expo.id));
        setExpos(normalizedExpos);
        setSessions(sessionData.map((session) => {
          const relatedExpo = normalizedExpos.find((expo) => expo.id === String(session.expo?._id || session.expo));
          return normalizeSession({ ...session, expo: { ...(typeof session.expo === 'object' ? session.expo : {}), timezone: relatedExpo?.timezone || 'Asia/Karachi' } });
        }));
      })
      .catch((loadError) => { if (active) setError(loadError.message || 'Unable to load the schedule.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [realtimeVersion]);
  const [sp, setSp] = useSearchParams();
  const defaultExpo = (expos.find((e) => e.status === 'live') || expos.find((e) => e.status === 'upcoming') || expos[0])?.id;
  const expoId = sp.get('expo') || defaultExpo;
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [day, setDay] = useState('');

  const all = useMemo(() => sessions.filter((s) => s.expoId === expoId).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)), [sessions, expoId]);
  const dates = [...new Set(all.map((s) => s.date))];
  const typeOptions = useMemo(() => [...new Set([...SESSION_TYPES, ...sessions.map((session) => session.type).filter(Boolean)])], [sessions]);
  const list = all.filter((s) => (!type || s.type === type) && (!day || s.date === day) && (!q || `${s.title} ${s.speaker} ${s.room} ${s.topic}`.toLowerCase().includes(q.toLowerCase())));
  const grouped = list.reduce((m, s) => ((m[s.date] = m[s.date] || []).push(s), m), {});

  return (
    <div className="container page">
      <PageHeader eyebrow="Programme" title="Event schedule" subtitle="Browse keynotes, workshops and panels. Register or bookmark sessions and we'll remind you before they start." />
      <div className="toolbar">
        <select className="select" value={expoId || ''} onChange={(e) => { setSp({ expo: e.target.value }); setDay(''); }} aria-label="Choose expo">
          {expos.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <select className="select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Session type">
          <option value="">All session types</option>
          {typeOptions.map((t) => <option key={t}>{t}</option>)}
        </select>
        <SearchBox value={q} onChange={setQ} placeholder="Search sessions or speakers…" />
      </div>
      {loading && <p className="muted">Loading the live schedule…</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <div className="chip-row" style={{ marginBottom: 24 }}>
        <button className={`chip ${!day ? 'active' : ''}`} onClick={() => setDay('')}>All days</button>
        {dates.map((d, i) => (
          <button key={d} className={`chip ${day === d ? 'active' : ''}`} onClick={() => setDay(day === d ? '' : d)}>Day {i + 1} · {fmtDate(d, { month: 'short', day: 'numeric' })}</button>
        ))}
      </div>
      {list.length ? (
        <div className="stack-lg">
          {Object.entries(grouped).map(([date, items]) => (
            <section key={date}>
              <h2 className="day-head"><span>Day {dates.indexOf(date) + 1}</span> {fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <div className="stack">{items.map((s) => <SessionCard key={s.id} session={s} expoOverride={expos.find((expo) => expo.id === s.expoId)} />)}</div>
            </section>
          ))}
        </div>
      ) : !loading && !error ? (
        <div className="card"><EmptyState icon={CalendarX} title="No sessions match" text="Try another day, type or search term." /></div>
      ) : null}
    </div>
  );
}
