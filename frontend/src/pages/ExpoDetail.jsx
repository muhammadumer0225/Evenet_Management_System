import { useEffect, useMemo, useState } from 'react';
import { getExpoById, getExpoSessions, getBooths, getMyApplications } from '../lib/api';
import { normalizeExpo, normalizeSession, normalizeBooth } from '../lib/normalizers';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, CheckCircle2, Clock, Info, LayoutGrid, MapPin, Settings2, Store, Ticket, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ExhibitorCard, SessionCard } from '../components/Cards';
import FloorPlan, { PlanLegend } from '../components/FloorPlan';
import { PassModal, RegisterModal } from '../components/Tickets';
import { Avatar, Badge, EmptyState, ExpoCover, Progress, StatusBadge, Tabs } from '../components/ui';
import { boothsOf, expoById, expoExhibitors, expoStats, myRegistration, userById } from '../lib/selectors';
import { fmtDate, fmtRange, money } from '../lib/utils';
import { useExpoRealtimeVersion } from '../hooks/useExpoRealtimeVersion';

export default function ExpoDetail() {
  const { id } = useParams();
  const realtimeVersion = useExpoRealtimeVersion(id);
  const { user, db, authLoading } = useAuth();

const [serverExpo, setServerExpo] = useState(null);
const [expoLoading, setExpoLoading] = useState(true);
const [expoError, setExpoError] = useState('');
const [serverSessions, setServerSessions] = useState([]);
const [sessionsLoading, setSessionsLoading] = useState(true);
const [sessionsError, setSessionsError] = useState('');
const [serverBooths, setServerBooths] = useState([]);
const [myApplication, setMyApplication] = useState(null);
const [boothsLoading, setBoothsLoading] = useState(true);
const [boothsError, setBoothsError] = useState('');
  const nav = useNavigate();
 const expo = serverExpo;
  const [tab, setTab] = useState('overview');
  const [reg, setReg] = useState(false);
  const [pass, setPass] = useState(false);
  const [picked, setPicked] = useState(null);
  

  useEffect(() => {
  if (authLoading) return;

  let active = true;

  async function loadExpo() {
    try {
      setExpoLoading(true);
      setExpoError('');
      setServerExpo(null);

      const data = await getExpoById(id, user?.role === 'admin');

      if (active) {
        setServerExpo(normalizeExpo(data));
      }
    } catch (error) {
      if (active) {
        setExpoError(error.message || 'Unable to load expo.');
      }
    } finally {
      if (active) {
        setExpoLoading(false);
      }
    }
  }

  loadExpo();

  return () => {
    active = false;
  };
}, [id, user?.role, authLoading, realtimeVersion]);

useEffect(() => {
  if (authLoading) return;

  let active = true;

  async function loadSessions() {
    try {
      setSessionsLoading(true);
      setSessionsError('');
      setServerSessions([]);

      const data = await getExpoSessions(id, user?.role === 'admin');

      if (active) {
        setServerSessions(data);
      }

    } catch (error) {
      if (active) {
        setSessionsError(error.message || 'Unable to load sessions.');
      }
    } finally {
      if (active) {
        setSessionsLoading(false);
      }
    }
  }

  loadSessions();

  return () => {
    active = false;
  };
}, [id, user?.role, authLoading, realtimeVersion]);

      useEffect(() => {
  if (authLoading || user?.role !== 'exhibitor') {
    setMyApplication(null);
    return undefined;
  }

  let active = true;
  getMyApplications()
    .then((applications) => {
      if (!active) return;
      const match = (applications || []).find((application) =>
        String(application.expo?._id || application.expo?.id || application.expo) === String(id)
      );
      setMyApplication(match || null);
    })
    .catch(() => {
      if (active) setMyApplication(null);
    });

  return () => { active = false; };
}, [id, user?.id, user?.role, authLoading, realtimeVersion]);

useEffect(() => {
  if (authLoading) return;

  let active = true;

  async function loadBooths() {
    try {
      setBoothsLoading(true);
      setBoothsError('');
      setServerBooths([]);

      const data = await getBooths(id);

      if (active) {
        setServerBooths(data);
      }
    } catch (error) {
      if (active) {
        setBoothsError(error.message || 'Unable to load booths.');
      }
    } finally {
      if (active) {
        setBoothsLoading(false);
      }
    }
  }

  loadBooths();

  return () => {
    active = false;
  };
}, [id, authLoading, realtimeVersion]);

  const sessions = useMemo(
  () => serverSessions
    .map((session) => normalizeSession({
      ...session,
      expo: { ...(typeof session.expo === 'object' ? session.expo : {}), timezone: expo?.timezone || 'Asia/Karachi' },
    }))
    .filter((s) => s.expoId === id)
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
  [serverSessions, id, expo?.timezone]
);

 const booths = useMemo(
  () => serverBooths
    .map((booth) => normalizeBooth(booth, user))
    .filter((booth) => booth.expoId === id),
  [serverBooths, user, id]
);

if (authLoading || expoLoading) {
  return (
    <div className="container page">
      <p className="muted">Loading expo details...</p>
    </div>
  );
}

if (expoError || !expo || (expo.status === 'draft' && user?.role !== 'admin')) {
  return (
    <div className="container page">
      <EmptyState
        icon={Info}
        title="Expo not found"
        text={expoError || 'This expo may have been removed or is not published yet.'}
        action={
          <Link to="/expos" className="btn btn-primary">
            Browse expos
          </Link>
        }
      />
    </div>
  );
}

  const st = expoStats(db, id);

  const exhibitors = expoExhibitors(db, id);
  const myReg = user?.role === 'attendee' ? myRegistration(db, user.id, id) : null;
  const myApp = user?.role === 'exhibitor' ? myApplication : null;
  const organizer = userById(db, expo.organizerId);

  const days = sessions.reduce((m, s) => ((m[s.date] = m[s.date] || []).push(s), m), {});
  const pickedBooth = booths.find((b) => b.id === picked);
  const pickedOwner = pickedBooth && userById(db, pickedBooth.exhibitorId);

  let cta;
  if (expo.status === 'completed') cta = <Badge tone="neutral">This expo has ended</Badge>;
  else if (!user)
    cta = (
      <>
        <Link to="/register?role=attendee" className="btn btn-primary btn-lg"><Ticket size={18} /> Register to attend</Link>
        <Link to="/register?role=exhibitor" className="btn btn-lg cover-btn"><Store size={18} /> Exhibit</Link>
      </>
    );
  else if (user.role === 'attendee')
    cta = myReg ? (
      <button className="btn btn-lg btn-primary" onClick={() => setPass(true)}><CheckCircle2 size={18} /> Registered · view pass</button>
    ) : (
      <button className="btn btn-lg btn-primary" onClick={() => setReg(true)}><Ticket size={18} /> Register · from {expo.ticketPrice ? money(expo.ticketPrice) : 'Free'}</button>
    );
  else if (user.role === 'exhibitor')
    cta = myApp ? (
      <Link to="/dashboard/applications" className="btn btn-lg btn-primary">Application: {myApp.status}</Link>
    ) : (
      <Link to={`/dashboard/expos?apply=${expo.id}`} className="btn btn-lg btn-primary"><Store size={18} /> Apply to exhibit</Link>
    );
  else
    cta = <Link to="/dashboard/expos" className="btn btn-lg btn-primary"><Settings2 size={18} /> Manage this expo</Link>;

  return (
    <>
      <ExpoCover expo={expo} className="expo-hero">
        <div className="container expo-hero-inner">
          <div className="row gap-sm wrap">
            <Badge tone="neutral" className="glass">{expo.category}</Badge>
            <StatusBadge status={expo.status} />
            {expo.status === 'draft' && <Badge tone="gold">Only visible to organizers</Badge>}
          </div>
          <h1>{expo.title}</h1>
          <p className="expo-theme">{expo.theme}</p>
          <ul className="expo-facts">
            <li><CalendarDays size={18} /> {fmtRange(expo.startDate, expo.endDate)}</li>
            <li><Clock size={18} /> Daily hours: {expo.startTime || '09:00'}–{expo.endTime || '18:00'} ({expo.timezone || 'Asia/Karachi'})</li>
            <li><MapPin size={18} /> {expo.location}</li>
            <li><Users size={18} /> {expo.capacity.toLocaleString()} capacity</li>
          </ul>
          <div className="row wrap gap-lg">{cta}</div>
        </div>
      </ExpoCover>

      <div className="container page">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'overview', label: 'Overview', icon: Info },
            { key: 'schedule', label: 'Schedule', icon: Clock, count: sessions.length },
            { key: 'exhibitors', label: 'Exhibitors', icon: Store, count: exhibitors.length },
            { key: 'plan', label: 'Floor plan', icon: LayoutGrid },
          ]}
        />

        <div className="mt-lg">
          {tab === 'overview' && (
            <div className="split">
              <div className="stack">
                <div className="card card-pad stack">
                  <h2 className="h3">About this expo</h2>
                  <p className="prose">{expo.description}</p>
                  <div className="chip-row">
                    {(expo.tags || []).map((t) => <span key={t} className="tag">#{t}</span>)}
                  </div>
                </div>
                {sessions.length > 0 && (
                  <div className="card card-pad stack">
                    <div className="row between"><h2 className="h3">Highlights</h2><button className="link btn-link" onClick={() => setTab('schedule')}>Full schedule →</button></div>
                    {sessions.filter((s) => s.type === 'Keynote').slice(0, 3).map((s) => (
                      <div key={s.id} className="highlight">
                        <div className="highlight-date"><strong>{fmtDate(s.date, { day: 'numeric' })}</strong><span>{fmtDate(s.date, { month: 'short' })}</span></div>
                        <div><strong>{s.title}</strong><p className="small muted">{s.speaker} · {s.speakerRole}</p></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <aside className="stack">
                <div className="card card-pad stack">
                  <h3>Event facts</h3>
                  <dl className="facts">
                    <div><dt>Dates</dt><dd>{fmtRange(expo.startDate, expo.endDate)}</dd></div>
                    <div><dt>Daily hours</dt><dd>{expo.startTime || '09:00'}–{expo.endTime || '18:00'} ({expo.timezone || 'Asia/Karachi'})</dd></div>
                    <div><dt>Venue</dt><dd>{expo.location}</dd></div>
                    {expo.registrationDeadline && <div><dt>Registration closes</dt><dd>{fmtDate(expo.registrationDeadline)}</dd></div>}
                    <div><dt>Tickets from</dt><dd>{expo.ticketPrice ? money(expo.ticketPrice) : 'Free'}</dd></div>
                    <div><dt>Exhibitors</dt><dd>{st.exhibitors}</dd></div>
                    <div><dt>Sessions</dt><dd>{st.sessions}</dd></div>
                    {organizer && <div><dt>Organizer</dt><dd>{organizer.name}</dd></div>}
                  </dl>
                </div>
                {expo.status !== 'completed' && (
                  <div className="card card-pad stack-sm">
                    <div className="row between"><strong>Booth availability</strong><span className="small muted">{st.available} of {st.total} left</span></div>
                    <Progress value={st.occupancy} tone={st.occupancy > 85 ? 'accent' : 'teal'} label="Occupancy" />
                    <p className="xs faint">Updated in real time as exhibitors reserve booths.</p>
                  </div>
                )}
              </aside>
            </div>
          )}

{tab === 'schedule' && (
  sessionsLoading ? (
    <div className="card">
      <p className="muted">Loading sessions...</p>
    </div>
  ) : sessionsError ? (
    <div className="card">
      <EmptyState
        icon={Info}
        title="Unable to load schedule"
        text={sessionsError}
      />
    </div>
  ) : sessions.length ? (
    <div className="stack-lg">
      {Object.entries(days).map(([date, list], i) => (
        <section key={date}>
          <h2 className="day-head">
            <span>Day {i + 1}</span>{' '}
            {fmtDate(date, {
              weekday: 'long',
              month: 'long',
              day: 'numeric'
            })}
          </h2>

          <div className="stack">
            {list.map((s) => (
              <SessionCard key={s.id} session={s} expoOverride={expo} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ) : (
    <div className="card">
      <EmptyState
        icon={Clock}
        title="Schedule coming soon"
        text="The organizers are still finalising the programme."
      />
    </div>
  )
)}

          {tab === 'exhibitors' &&
            (exhibitors.length ? (
              <div className="grid grid-auto">
                {exhibitors.map(({ user: u, booth }) => <ExhibitorCard key={u.id} user={u} booth={booth} />)}
              </div>
            ) : (
              <div className="card"><EmptyState icon={Store} title="No exhibitors confirmed yet" text="Check back soon — booths are being allocated." /></div>
            ))}

          {tab === 'plan' && (
  boothsLoading ? (
    <div className="card card-pad">
      <p className="muted">Loading booths...</p>
    </div>
  ) : boothsError ? (
    <div className="card card-pad">
      <EmptyState
        icon={Info}
        title="Unable to load booths"
        text={boothsError}
      />
    </div>
  ) : (
    <div className="split">
      <div className="card card-pad">
        <FloorPlan
          booths={booths}
          layout={expo.layout}
          users={db.users}
          userId={user?.id}
          onSelect={(b) => setPicked(b.id)}
          selectedId={picked}
        />
        <PlanLegend
          items={user?.role === 'exhibitor'
            ? ['available', 'reserved', 'booked', 'blocked', 'mine']
            : ['available', 'reserved', 'booked', 'blocked']}
        />
      </div>

      <aside className="card card-pad stack">
        {pickedBooth && pickedOwner ? (
          <>
            <span className="eyebrow">
              Booth {pickedBooth.label} · {pickedBooth.zone}
            </span>
            <div className="row">
              <Avatar user={pickedOwner} size={52} square />
              <div>
                <h3>{pickedOwner.company}</h3>
                <Badge tone="accent">{pickedOwner.category}</Badge>
              </div>
            </div>
            <p className="muted small">
              {pickedBooth.showcase?.tagline || pickedOwner.tagline}
            </p>
            <Link
              to={`/exhibitors/${pickedOwner.id}?expo=${expo.id}`}
              className="btn btn-primary"
            >
              View exhibitor
            </Link>
          </>
        ) : (
          <EmptyState
            icon={LayoutGrid}
            title="Tap a booked booth"
            text="Select any occupied booth on the plan to see who's there and visit their profile."
          />
        )}
      </aside>
    </div>
  )
)}
        </div>
      </div>

      {user?.role === 'attendee' && (
        <>
          <RegisterModal expo={expo} user={user} open={reg} onClose={() => setReg(false)} />
          <PassModal reg={myReg} expo={expo} user={user} open={pass} onClose={() => setPass(false)} />
        </>
      )}
    </>
  );
}
