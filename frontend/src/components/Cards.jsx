import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, BookmarkCheck, CalendarPlus, CheckCircle2, Clock, MapPin, Mic2, Store, Users } from 'lucide-react';
import { Avatar, Badge, ExpoCover, Progress, StatusBadge } from './ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { expoById, expoStats, mySessionState, sessionSeats } from '../lib/selectors';
import { toggleSession, getExpoStats, getMySessionRegistrationsApi, registerForSessionApi, cancelSessionRegistrationApi, bookmarkSessionApi, removeSessionBookmarkApi } from '../lib/api';
import { cx, downloadFile, fmtRange, fmtTime, icsFor } from '../lib/utils';
import { useEffect, useState } from 'react';


export function ExpoCard({ expo, db, to, footer }) {
  const [stats, setStats] = useState(null);

useEffect(() => {
  let active = true;

  getExpoStats(expo.id)
    .then((data) => {
      if (active) setStats(data);
    })
    .catch((error) => {
      console.error('Failed to load Expo stats:', error);
    });

  return () => {
    active = false;
  };
}, [expo.id]);

const st = stats || {
  exhibitors: 0,
  registrations: 0,
  available: 0,
  occupancy: 0,
};
  return (
    <article className="card card-flush card-hover expo-card">
      <Link to={to || `/expos/${expo.id}`} className="expo-card-link" aria-label={expo.title}>
        <ExpoCover expo={expo} className="expo-card-cover">
          <div className="row between top">
            <Badge tone="neutral" className="glass">{expo.category}</Badge>
            <StatusBadge status={expo.status} />
          </div>
          <span className="expo-card-theme">{expo.theme}</span>
        </ExpoCover>
        <div className="expo-card-body">
          <h3>{expo.title}</h3>
          <ul className="meta-list">
            <li><Clock size={15} /> {fmtRange(expo.startDate, expo.endDate)}</li>
            <li><Clock size={15} /> Daily: {expo.startTime || '09:00'}–{expo.endTime || '18:00'} ({expo.timezone || 'Asia/Karachi'})</li>
            <li><MapPin size={15} /> {expo.location}</li>
          </ul>
          <div className="expo-card-stats">
            <span><Store size={15} /> {st.exhibitors} exhibitors</span>
            <span><Users size={15} /> {st.registrations.toLocaleString()} registered</span>
          </div>
          {expo.status !== 'completed' && (
            <div className="stack-sm">
              <div className="row between xs muted">
                <span>{st.available} booths left</span>
                <span>{st.occupancy}% full</span>
              </div>
              <Progress value={st.occupancy} tone={st.occupancy > 85 ? 'accent' : 'teal'} label="Booth occupancy" />
            </div>
          )}
        </div>
      </Link>
      {footer && <div className="expo-card-foot">{footer}</div>}
    </article>
  );
}

export function ExhibitorCard({ user, booth, expo, compact, onClick, action }) {
  const inner = (
    <>
      <div className="row top">
        <Avatar user={user} size={52} square />
        <div className="grow">
          <h3 className="truncate">{user.company}</h3>
          <Badge tone="accent">{user.category}</Badge>
        </div>
        {booth && <span className="booth-tag mono">{booth.label}</span>}
      </div>
      {!compact && <p className="muted small clamp-2">{user.tagline || user.description}</p>}
      <div className="chip-row">
        {(user.products || []).slice(0, 3).map((p) => (
          <span className="tag" key={p}>{p}</span>
        ))}
      </div>
      {expo && (
        <div className="exhibitor-card-foot">
          <MapPin size={14} /> {expo.title} {booth ? `· Booth ${booth.label}` : ''}
        </div>
      )}
    </>
  );
  return (
    <article className="card card-pad card-hover exhibitor-card">
      {onClick ? (
        <button className="plain-btn" onClick={onClick}>{inner}</button>
      ) : (
        <Link to={`/exhibitors/${user.id}${booth ? `?expo=${booth.expoId}` : ''}`}>{inner}</Link>
      )}
      {action}
    </article>
  );
}

/** Persistent backend registration/bookmark actions for published MongoDB sessions. */
export function SessionActions({ session, compact }) {
  const { user, db } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const sessionId = session._id || session.id;
  const useRemote = /^[a-f0-9]{24}$/i.test(String(sessionId || ''));
  const [remoteRegistrations, setRemoteRegistrations] = useState([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const expo = expoById(db, session.expoId);
  const seats = session.remote
    ? {
        taken: Math.min(session.registeredCount || 0, session.capacity),
        capacity: session.capacity,
        full: (session.registeredCount || 0) >= session.capacity,
        pct: Math.min(100, Math.round(((session.registeredCount || 0) / session.capacity) * 100)),
      }
    : sessionSeats(db, session);
  const over = session.endTime
    ? new Date(session.endTime) < new Date()
    : new Date(`${session.date}T${session.end}`) < new Date();

  useEffect(() => {
    let active = true;
    if (!user || user.role !== 'attendee' || !useRemote) {
      setRemoteRegistrations([]);
      setRemoteLoading(false);
      return undefined;
    }
    setRemoteLoading(true);
    getMySessionRegistrationsApi({ userId: user.id })
      .then((items) => { if (active) setRemoteRegistrations(items); })
      .catch((error) => { if (active) toast.error('Could not load your session status', error.message); })
      .finally(() => { if (active) setRemoteLoading(false); });
    return () => { active = false; };
  }, [user?.id, user?.role, sessionId, useRemote]);

  const remoteRecord = remoteRegistrations.find((item) => {
    const id = typeof item.session === 'object' ? item.session?._id || item.session?.id : item.session;
    return String(id) === String(sessionId);
  });
  const remoteRegistered = remoteRecord?.type === 'register' && remoteRecord.status === 'registered';
  const remoteBookmarked = remoteRecord?.type === 'bookmark' && remoteRecord.status === 'registered';
  const localState = user ? mySessionState(db, user.id, sessionId) : { registered: false, bookmarked: false };
  const st = useRemote
    ? { registered: remoteRegistered, bookmarked: remoteBookmarked }
    : localState;

  const guard = async (action) => {
    if (!user) return nav('/login', { state: { from: '/schedule' } });
    if (user.role !== 'attendee') return toast.info('Attendee feature', 'Switch to an attendee account to register or bookmark sessions.');
    if (actionLoading || remoteLoading) return;
    setActionLoading(true);
    try {
      if (useRemote) {
        if (action === 'register') {
          if (st.registered && remoteRecord?._id) {
            await cancelSessionRegistrationApi(remoteRecord._id);
            toast.info('Session registration cancelled');
          } else {
            await registerForSessionApi(sessionId);
            toast.success("You're registered", `Your place for “${session.title}” is saved.`);
          }
        } else if (st.bookmarked) {
          await removeSessionBookmarkApi(sessionId);
          toast.info('Bookmark removed');
        } else {
          await bookmarkSessionApi(sessionId);
          toast.success('Session saved', "We'll remind you before it starts.");
        }
        const items = await getMySessionRegistrationsApi({ userId: user.id });
        setRemoteRegistrations(items);
      } else {
        const on = toggleSession(sessionId, user.id, action);
        if (action === 'register') {
          on ? toast.success("You're in!", `Registered for “${session.title}”.`) : toast.info('Registration cancelled');
        } else {
          on ? toast.success('Bookmarked', "We'll send you a reminder before it starts.") : toast.info('Bookmark removed');
        }
      }
    } catch (error) {
      toast.error('Could not complete that', error.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (over) return <Badge>Ended</Badge>;
  return (
    <div className={cx('row gap-sm wrap', compact && 'compact')}>
      <button
        className={cx('btn btn-sm', st.registered ? 'btn-soft-success' : 'btn-primary')}
        disabled={(seats.full && !st.registered) || actionLoading || remoteLoading}
        onClick={() => guard('register')}
      >
        {st.registered ? <><CheckCircle2 size={15} /> Registered</> : seats.full ? 'Full' : 'Register'}
      </button>
      {!st.registered && (
        <button
          className={cx('btn btn-sm btn-outline', st.bookmarked && 'is-on')}
          disabled={actionLoading || remoteLoading}
          onClick={() => guard('bookmark')}
          aria-pressed={st.bookmarked}
        >
          {st.bookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          {!compact && (st.bookmarked ? 'Saved' : 'Save')}
        </button>
      )}
      {(st.registered || st.bookmarked) && (
        <button
          className="icon-btn"
          title="Add to calendar (.ics)"
          aria-label="Add to calendar"
          onClick={() => downloadFile(`${session.title.slice(0, 30)}.ics`, icsFor(session, expo), 'text/calendar')}
        >
          <CalendarPlus size={18} />
        </button>
      )}
    </div>
  );
}

const TYPE_TONE = { Keynote: 'accent', Workshop: 'teal', Panel: 'blue', Talk: 'gold', Networking: 'neutral' };

export function SessionCard({ session, showExpo, actions = true, expoOverride }) {
  const { db } = useAuth();
  const expo = expoOverride || expoById(db, session.expoId);
  const seats = session.remote
    ? {
        taken: Math.min(session.registeredCount || 0, session.capacity),
        capacity: session.capacity,
        full: (session.registeredCount || 0) >= session.capacity,
        pct: Math.min(100, Math.round(((session.registeredCount || 0) / session.capacity) * 100)),
      }
    : sessionSeats(db, session);
  return (
    <article className="card session-card">
      <div className="session-time">
        <strong>{fmtTime(session.start)}</strong>
        <span>{fmtTime(session.end)}</span>
      </div>
      <div className="session-main">
        <div className="row wrap gap-sm">
          <Badge tone={TYPE_TONE[session.type] || 'neutral'}>{session.type}</Badge>
          <Badge tone="neutral"><MapPin size={12} /> {session.room}</Badge>
          {showExpo && (expo || session.expoTitle) && <Link className="xs link" to={`/expos/${expo?.id || session.expoId}`}>{expo?.title || session.expoTitle}</Link>}
        </div>
        <h3>{session.title}</h3>
        <p className="muted small"><Mic2 size={14} /> {session.speaker} · {session.speakerRole}</p>
        <div className="session-seats">
          <Progress value={seats.pct} tone={seats.pct > 85 ? 'accent' : 'teal'} label="Seats taken" />
          <span className="xs faint">{seats.full ? 'Sold out' : `${seats.capacity - seats.taken} seats left`}</span>
        </div>
      </div>
      {actions && <div className="session-actions"><SessionActions session={session} /></div>}
    </article>
  );
}
