import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight, CalendarClock, CalendarDays, Check, ClipboardCheck, Map, MessageSquare, Store, Ticket, Users, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { ExpoCard } from '../components/Cards';
import { Avatar, Badge, EmptyState, PageHeader, Progress, StatCard, StatusBadge } from '../components/ui';
import { approveExhibitorApplication, getAdminActivities, getAllApplications, getDashboardAnalytics, getExpoAnalytics, getMyApplications, getMyBoothAnalytics, getMyConversations, getMyExhibitorProfile, getPublishedExpos, rejectExhibitorApplication } from '../lib/api';
import { profileCompleteness } from '../lib/selectors';
import { normalizeExpo } from '../lib/normalizers';
import { fmtDate, fmtRange, fmtTime, sessionStart } from '../lib/utils';
import { useExpoRealtimeVersion } from '../hooks/useExpoRealtimeVersion';

export default function Overview() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminOverview />;
  if (user.role === 'exhibitor') return <ExhibitorOverview />;
  return <AttendeeOverview />;
}

function AdminOverview() {
  const toast = useToast();
  const [dashboard, setDashboard] = useState(null);
  const [expoAnalytics, setExpoAnalytics] = useState([]);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [updatingApplication, setUpdatingApplication] = useState('');

  const loadOverview = async ({ background = false } = {}) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled([
        getDashboardAnalytics(),
        getExpoAnalytics(),
        getAllApplications({ status: 'pending', page: 1, limit: 5 }),
        getAdminActivities(8),
      ]);
      const failures = [];
      if (results[0].status === 'fulfilled') setDashboard(results[0].value.analytics || null);
      else failures.push(results[0].reason?.message || 'Dashboard totals unavailable');
      if (results[1].status === 'fulfilled') setExpoAnalytics(results[1].value.analytics || []);
      else failures.push(results[1].reason?.message || 'Expo statistics unavailable');
      if (results[2].status === 'fulfilled') {
        setPendingApplications(results[2].value.applications || []);
        setPendingCount(results[2].value.pagination?.total ?? results[2].value.applications?.length ?? 0);
      } else failures.push(results[2].reason?.message || 'Pending applications unavailable');
      if (results[3].status === 'fulfilled') setActivities(results[3].value || []);
      else failures.push(results[3].reason?.message || 'Activity feed unavailable');
      if (failures.length) setError(failures.join(' · '));
    } catch (loadError) {
      setError(loadError.message || 'Unable to load organizer overview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const decide = async (application, status) => {
    const id = application._id;
    if (!id || updatingApplication) return;
    setUpdatingApplication(id);
    try {
      if (status === 'approved') {
        await approveExhibitorApplication(id);
      } else {
        await rejectExhibitorApplication(id, 'Not approved for this edition.');
      }
      toast.success(`Application ${status}`, application.exhibitorProfile?.companyName || application.exhibitor?.name || '');
      await loadOverview({ background: true });
    } catch (actionError) {
      toast.error(actionError.message || `Unable to ${status} application.`);
    } finally {
      setUpdatingApplication('');
    }
  };

  const totalBooths = expoAnalytics.reduce((sum, item) => sum + (item.totalBooths || 0), 0);
  const occupiedBooths = expoAnalytics.reduce((sum, item) => sum + (item.boothStatus?.occupied || 0) + (item.boothStatus?.reserved || 0), 0);
  const occupancy = totalBooths ? Math.round((occupiedBooths / totalBooths) * 100) : 0;
  const activeExpos = expoAnalytics.filter((item) => item.expo?.status !== 'draft' && item.expo?.status !== 'completed');

  return (
    <>
      <PageHeader title="Organizer overview" subtitle="Everything happening across your expos, at a glance." actions={<div className="row wrap"><button className="btn btn-outline" onClick={() => loadOverview({ background: true })} disabled={loading || refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button><Link to="/dashboard/expos" className="btn btn-primary">Manage expos</Link></div>} />
      {error && <div className="alert alert-warning" role="alert"><div><strong>Dashboard data could not be fully loaded.</strong><p className="small">{error}</p><button className="btn btn-sm btn-outline" onClick={() => loadOverview()}>Try again</button></div></div>}
      <div className="grid grid-4">
        <StatCard icon={CalendarDays} label="Active expos" value={loading ? '—' : activeExpos.length} hint={`${dashboard?.totalExpos ?? '—'} total expos`} />
        <StatCard icon={Store} label="Exhibitors" value={loading ? '—' : (dashboard?.totalExhibitors ?? 0).toLocaleString()} tone="teal" hint={`${pendingCount} applications pending`} />
        <StatCard icon={Users} label="Registrations" value={loading ? '—' : (dashboard?.activeExpoRegistrations ?? 0).toLocaleString()} tone="blue" hint="active registrations across all expos" />
        <StatCard icon={Map} label="Booth occupancy" value={loading ? '—' : `${occupancy}%`} tone="gold" hint={`${occupiedBooths} of ${totalBooths} reserved or occupied`} />
      </div>
      <div className="split mt">
        <div className="stack">
          <div className="card card-flush">
            <div className="card-head"><h3>Applications awaiting review</h3><Link className="link small" to="/dashboard/applications">View all</Link></div>
            {loading ? <div className="card-pad small muted">Loading applications…</div> : pendingApplications.length ? (
              <div className="table-wrap"><table className="table"><tbody>
                {pendingApplications.map((application) => {
                  const company = application.exhibitorProfile?.companyName || application.exhibitor?.name || 'Exhibitor';
                  const expoTitle = application.expo?.title || 'Expo';
                  const busy = updatingApplication === application._id;
                  return (
                    <tr key={application._id}>
                      <td><div className="cell-user"><Avatar user={{ name: company }} size={36} square /><div><strong>{company}</strong><small>{expoTitle}</small></div></div></td>
                      <td className="right nowrap"><button className="btn btn-sm btn-soft-success" disabled={Boolean(updatingApplication)} onClick={() => decide(application, 'approved')}><Check size={14} /> {busy ? 'Saving…' : 'Approve'}</button> <button className="btn btn-sm btn-soft-danger" disabled={Boolean(updatingApplication)} onClick={() => decide(application, 'rejected')}><X size={14} /> Reject</button></td>
                    </tr>
                  );
                })}
              </tbody></table></div>
            ) : <EmptyState icon={ClipboardCheck} title="All caught up" text="No applications waiting for review." />}
          </div>
          <div className="card card-pad stack-sm">
            <div className="row between wrap"><h3>Expo performance snapshot</h3><Link className="link small" to="/dashboard/analytics">Full analytics →</Link></div>
            <div className="grid grid-3">
              <div><strong>{(dashboard?.totalSessions ?? 0).toLocaleString()}</strong><p className="small muted">Sessions</p></div>
              <div><strong>{(dashboard?.activeSessionRegistrations ?? 0).toLocaleString()}</strong><p className="small muted">Session registrations</p></div>
              <div><strong>{(dashboard?.totalBooths ?? 0).toLocaleString()}</strong><p className="small muted">Total booths</p></div>
            </div>
          </div>
        </div>
        <aside className="stack">
          <div className="card card-pad stack-sm">
            <h3>Booth occupancy by Expo</h3>
            {loading ? <p className="small muted">Loading Expo statistics…</p> : activeExpos.length ? activeExpos.map((item) => {
              const reserved = item.boothStatus?.reserved || 0;
              const occupied = item.boothStatus?.occupied || 0;
              const count = reserved + occupied;
              const percent = item.totalBooths ? Math.round((count / item.totalBooths) * 100) : 0;
              return (
                <div key={item.expo._id} className="stack-sm" style={{ marginTop: 6 }}>
                  <div className="row between small"><span className="truncate">{item.expo.title}</span><strong>{percent}%</strong></div>
                  <Progress value={percent} tone="teal" label={item.expo.title} />
                  <p className="small muted">{count} of {item.totalBooths} booths reserved or occupied</p>
                </div>
              );
            }) : <p className="small muted">No active Expos available.</p>}
          </div>
          <div className="card card-pad stack-sm">
            <div className="row between"><h3>Recent admin activity</h3><span className="pulse" /></div>
            {loading ? <p className="small muted">Loading recent activity…</p> : activities.length ? (
              <div className="stack-sm" aria-live="polite">
                {activities.map((activity) => (
                  <div key={activity._id} className="row align-start" style={{ gap: 10, padding: '9px 0', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
                    <span className="icon-bubble" aria-hidden="true"><CalendarClock size={15} /></span>
                    <div className="stack-xs" style={{ minWidth: 0, flex: 1 }}>
                      <p className="small">{activity.description}</p>
                      <p className="small muted">{activity.actor?.name || activity.actorName || 'Administrator'} · {activity.createdAt ? new Date(activity.createdAt).toLocaleString() : 'Recently'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState icon={CalendarClock} title="No activity yet" text="Admin actions will appear here as they happen." />}
          </div>
        </aside>
      </div>
    </>
  );
}

function ExhibitorOverview() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [expos, setExpos] = useState([]);
  const [analytics, setAnalytics] = useState({ summary: {}, booths: [], dailyVisits: [] });
  const [companyProfile, setCompanyProfile] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const realtimeVersion = useExpoRealtimeVersion();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const results = await Promise.allSettled([
        getMyApplications(),
        getMyBoothAnalytics(),
        getPublishedExpos(),
        getMyConversations(),
        getMyExhibitorProfile(),
      ]);
      if (!active) return;
      const failures = [];
      if (results[0].status === 'fulfilled') setApplications(results[0].value || []);
      else failures.push('Applications');
      if (results[1].status === 'fulfilled') setAnalytics(results[1].value || { summary: {}, booths: [], dailyVisits: [] });
      else failures.push('Booth analytics');
      if (results[2].status === 'fulfilled') setExpos((results[2].value || []).map(normalizeExpo));
      else failures.push('Expo list');
      if (results[3].status === 'fulfilled') setUnreadCount((results[3].value || []).reduce((sum, conversation) => sum + (conversation.unread || 0), 0));
      else failures.push('Messages');
      if (results[4].status === 'fulfilled') setCompanyProfile(results[4].value || null);
      else setCompanyProfile(null);
      if (failures.length) setError(`Some dashboard information could not load: ${failures.join(', ')}. Use the relevant page to retry.`);
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, [user.id, realtimeVersion]);

  const apps = applications;
  const booths = analytics.booths || [];
  const summary = analytics.summary || {};
  const pending = apps.filter((application) => application.status === 'pending').length;
  const approved = apps.filter((application) => application.status === 'approved').length;
  const rejected = apps.filter((application) => application.status === 'rejected').length;
  const needBooth = apps.filter((application) => application.status === 'approved' && !application.booth);
  const appliedExpoIds = new Set(apps.map((application) => String(application.expo?._id || application.expo?.id || application.expo || '')));
  const upcoming = expos.filter((expo) => {
    const start = new Date(expo.startDate);
    return ['published', 'upcoming'].includes(expo.status) && !Number.isNaN(start.getTime()) && start >= new Date() && !appliedExpoIds.has(String(expo._id || expo.id));
  }).slice(0, 2);
  const pct = profileCompleteness({ ...user, tagline: companyProfile?.tagline, description: companyProfile?.description, website: companyProfile?.website, logo: companyProfile?.logo, products: companyProfile?.productsServices || [], staff: companyProfile?.staff || [], phone: companyProfile?.contactPhone || user.phone });

  return (
    <>
      <PageHeader title={user.company || 'Exhibitor dashboard'} subtitle="Your applications, booth activity and next steps in one place." actions={<Link to="/dashboard/expos" className="btn btn-primary">Find expos & apply for a booth</Link>} />
      {error && <div className="alert alert-warning" role="status">{error}</div>}
      {needBooth.length > 0 && <div className="alert alert-warning" style={{ marginBottom: 18 }}><Map size={18} /><div><strong>Action needed:</strong> {needBooth.length} approved application{needBooth.length === 1 ? '' : 's'} still need a booth. <Link to="/dashboard/booth">Choose your booth</Link>.</div></div>}
      {loading ? <div className="page-loading">Loading your exhibitor overview…</div> : (
        <>
          <div className="grid grid-4">
            <StatCard icon={ClipboardCheck} label="Applications" value={apps.length} hint={`${pending} pending review`} />
            <StatCard icon={Store} label="Assigned booths" value={summary.assignedBooths ?? booths.length} tone="teal" hint={`${needBooth.length} approved without booth`} />
            <StatCard icon={Users} label="Recorded visits" value={summary.totalVisits || 0} tone="blue" hint={`${summary.uniqueAttendees || 0} unique attendees`} />
            <StatCard icon={MessageSquare} label="Unread messages" value={unreadCount} tone="gold" hint="Conversations awaiting your reply" />
          </div>
          <div className="split mt">
            <div className="stack">
              <div className="card card-flush">
                <div className="card-head"><h3>Application pipeline</h3><Link className="link small" to="/dashboard/applications">View all</Link></div>
                <div className="grid grid-3" style={{ padding: 16 }}>
                  <div><strong className="stat-value">{pending}</strong><p className="small muted">Pending</p></div>
                  <div><strong className="stat-value">{approved}</strong><p className="small muted">Approved</p></div>
                  <div><strong className="stat-value">{rejected}</strong><p className="small muted">Not approved</p></div>
                </div>
              </div>
              <div className="card card-flush">
                <div className="card-head"><h3>Your Expo applications</h3><Link className="link small" to="/dashboard/applications">All applications</Link></div>
                {apps.length ? <ul className="list">{apps.slice(0, 5).map((application) => {
                  const expo = application.expo || {};
                  const booth = application.booth;
                  return <li key={application._id}><div className="grow"><strong>{expo.title || 'Expo unavailable'}</strong><p className="small muted">{expo.startDate && expo.endDate ? fmtRange(expo.startDate, expo.endDate) : 'Dates to be confirmed'}{booth?.boothNumber ? ` · Booth ${booth.boothNumber}` : ''}</p></div><StatusBadge status={application.status} /></li>;
                })}</ul> : <EmptyState icon={Store} title="No applications yet" text="Apply to an upcoming Expo to get started." action={<Link to="/dashboard/expos" className="btn btn-primary">Find expos</Link>} />}
              </div>
              {upcoming.length > 0 && <div><h3 style={{ marginBottom: 12 }}>Open for applications</h3><div className="grid grid-2">{upcoming.map((expo) => <ExpoCard key={expo._id || expo.id} expo={expo} db={{ expos }} to={`/dashboard/expos?apply=${expo._id || expo.id}`} />)}</div></div>}
            </div>
            <aside className="stack">
              <div className="card card-pad stack-sm">
                <div className="row between"><h3>Profile strength</h3><strong>{pct}%</strong></div>
                <Progress value={pct} tone={pct > 80 ? 'green' : 'gold'} label="Profile completeness" />
                <p className="small muted">Keep your company details and showcase up to date so attendees can learn about your business.</p>
                <Link to="/dashboard/profile" className="btn btn-outline btn-sm">Update company profile</Link>
              </div>
              <div className="card card-pad stack-sm"><h3>Booth activity</h3>
                {booths.length ? booths.slice(0, 4).map((booth) => <div className="row between" key={booth.boothId}><div><strong>{booth.boothNumber || 'Booth'}</strong><p className="small muted">{booth.expo?.title || 'Expo'}</p></div><div className="text-right"><strong>{booth.visits || 0}</strong><p className="small muted">visits</p></div></div>) : <p className="small muted">Assigned booth engagement will appear here.</p>}
                <Link to="/dashboard/booth-analytics" className="btn btn-outline btn-sm">Open booth analytics</Link>
              </div>
              <div className="card card-pad stack-sm"><h3>Quick links</h3>
                <Link to="/dashboard/showcase" className="side-link"><Store size={18} /> Booth showcase</Link>
                <Link to="/dashboard/neighbors" className="side-link"><Users size={18} /> Neighbours</Link>
                <Link to="/dashboard/messages" className="side-link"><MessageSquare size={18} /> Messages</Link>
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

function AttendeeOverview() {
  const { user, db } = useAuth();
  const regs = db.registrations.filter((r) => r.userId === user.id);
  const mySess = db.sessionRegs.filter((r) => r.userId === user.id).map((r) => ({ ...r, s: db.sessions.find((s) => s.id === r.sessionId) })).filter((x) => x.s && sessionStart(x.s) > new Date()).sort((a, b) => sessionStart(a.s) - sessionStart(b.s));
  const next = mySess[0]?.s;
  const recommended = db.expos.filter((e) => e.status === 'upcoming' && !regs.some((r) => r.expoId === e.id));
  const mins = next ? Math.max(0, Math.round((sessionStart(next) - new Date()) / 60000)) : 0;
  return (
    <>
      <PageHeader title="Your expo hub" subtitle="Tickets, agenda and exhibitors you want to meet." actions={<Link to="/dashboard/expos" className="btn btn-primary"><Ticket size={17} /> Browse expos</Link>} />
      {next && (
        <div className="next-up">
          <div><span className="eyebrow" style={{ color: 'inherit', opacity: 0.85 }}>Next on your agenda</span><h2>{next.title}</h2><p>{fmtDate(next.date, { weekday: 'long', month: 'short', day: 'numeric' })} · {fmtTime(next.start)} · {next.room}</p></div>
          <div className="next-count"><strong>{mins >= 1440 ? `${Math.floor(mins / 1440)}d` : mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`}</strong><span>to go</span></div>
        </div>
      )}
      <div className="grid grid-3 mt">
        <StatCard icon={Ticket} label="Expo passes" value={regs.length} />
        <StatCard icon={CalendarClock} label="Sessions registered" value={mySess.filter((x) => x.type === 'register').length} tone="teal" />
        <StatCard icon={CalendarDays} label="Bookmarked" value={mySess.filter((x) => x.type === 'bookmark').length} tone="gold" />
      </div>
      <div className="split mt">
        <div className="card card-flush">
          <div className="card-head"><h3>Upcoming sessions</h3><Link to="/dashboard/agenda" className="link small">Full agenda</Link></div>
          {mySess.length ? <ul className="list">{mySess.slice(0, 5).map(({ s, type }) => (
            <li key={s.id + type}><div className="highlight-date"><strong>{fmtDate(s.date, { day: 'numeric' })}</strong><span>{fmtDate(s.date, { month: 'short' })}</span></div><div className="grow"><strong>{s.title}</strong><p className="small muted">{fmtTime(s.start)} · {s.room}</p></div><Badge tone={type === 'register' ? 'green' : 'gold'}>{type === 'register' ? 'Registered' : 'Saved'}</Badge></li>
          ))}</ul> : <EmptyState icon={CalendarClock} title="Your agenda is empty" text="Register for or bookmark sessions to build your plan." action={<Link to="/schedule" className="btn btn-primary">Browse schedule</Link>} />}
        </div>
        <aside className="stack">
          <div className="card card-pad stack-sm"><h3>Discover</h3><p className="muted small">Find exhibitors by what they sell.</p><Link to="/dashboard/exhibitors" className="btn btn-outline">Search exhibitors <ArrowRight size={16} /></Link></div>
          {recommended.length > 0 && <div className="card card-pad stack-sm"><h3>Recommended expos</h3>{recommended.slice(0, 2).map((e) => <Link key={e.id} to={`/expos/${e.id}`} className="rec"><strong>{e.title}</strong><small>{fmtRange(e.startDate, e.endDate)}</small></Link>)}</div>}
        </aside>
      </div>
    </>
  );
}
