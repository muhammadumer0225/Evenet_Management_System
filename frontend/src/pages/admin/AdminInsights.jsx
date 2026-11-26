import { useEffect, useState } from 'react';
import { Activity, Ban, CalendarClock, CheckCircle2, Download, Star, Store, Trash2, Users as UsersIcon, Ticket } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../context/UIContext';
import { Avatar, Badge, EmptyState, PageHeader, SearchBox, StatCard, StatusBadge, Tabs } from '../../components/ui';
import {
  getAdminUsersApi,
  updateAdminUserStatusApi,
  updateAdminUserRoleApi,
  deleteAdminUserApi,
  getAllFeedback,
  updateFeedback,
  getDashboardAnalytics,
  getExpoAnalytics,
  downloadExpoAnalyticsPdf,
} from '../../lib/api';
import { boothsOf, expoStats } from '../../lib/selectors';
import {fmtDate, timeAgo } from '../../lib/utils';
import { MessageCircleHeart } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useExpoRealtimeVersion } from '../../hooks/useExpoRealtimeVersion';

const tip = { contentStyle: { background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)' }, cursor: { fill: 'var(--surface-2)' } };
const ax = { tickLine: false, axisLine: false, tick: { fill: 'var(--ink-3)', fontSize: 12 } };
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)'];

export function AdminAnalytics() {
  const [dashboardAnalytics, setDashboardAnalytics] = useState(null);
  const [expoAnalytics, setExpoAnalytics] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [expoId, setExpoId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const realtimeVersion = useExpoRealtimeVersion();
  const selected = expoAnalytics.find((item) => String(item.expo?._id) === String(expoId));

  useEffect(() => {
    let active = true;
    const load = async () => {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      try {
        const [dashboard, expos] = await Promise.all([getDashboardAnalytics(), getExpoAnalytics()]);
        if (!active) return;
        setDashboardAnalytics(dashboard.analytics || null);
        setExpoAnalytics(expos.analytics || []);
        setExpoId((current) => current && expos.analytics?.some((item) => String(item.expo?._id) === String(current)) ? current : String(expos.analytics?.[0]?.expo?._id || ''));
      } catch (error) {
        if (active) setAnalyticsError(error.message || 'Failed to load analytics.');
      } finally {
        if (active) setAnalyticsLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [refreshKey, realtimeVersion]);

  const daily = selected?.dailyAttendance || [];
  const registrationTrend = selected?.registrationTrend || [];
  const ticketTiers = selected?.ticketTiers || [];
  const paymentBreakdown = selected?.paymentBreakdown || [];
  const boothStatus = selected?.boothStatus || {};
  const boothData = Object.entries(boothStatus).map(([status, count]) => ({ status: status[0].toUpperCase() + status.slice(1), count }));
  const popular = selected?.popularSessions || [];
  const industries = selected?.exhibitorsByIndustry || [];
  const boothTraffic = selected?.boothTraffic || { totalVisits: 0, uniqueAttendees: 0, topBooths: [], dailyVisits: [] };
  const topBooths = boothTraffic.topBooths || [];
  const dailyBoothVisits = boothTraffic.dailyVisits || [];
  const csvCell = (value) => { const raw = String(value ?? ''); const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw; return `\"${safe.replaceAll('\"', '\"\"')}\"`; };
  const csv = [
    ['Expo', selected?.expo?.title || ''],
    ['Metric', 'Value'],
    ['Total registrations', selected?.totalRegistrations ?? 0],
    ['Active registrations', selected?.activeRegistrations ?? 0],
    ['Cancelled registrations', selected?.cancelledRegistrations ?? 0],
    ['Total booths', selected?.totalBooths ?? 0],
    ['Total sessions', selected?.totalSessions ?? 0],
    ['Recorded booth visits', boothTraffic.totalVisits ?? 0],
    ['Unique attendees visiting booths', boothTraffic.uniqueAttendees ?? 0],
    [], ['Booth', 'Unique visitors'],
    ...topBooths.map((row) => [row.boothNumber, row.uniqueVisitors]),
    [], ['Booth visit date', 'Recorded visits'],
    ...dailyBoothVisits.map((row) => [row.date, row.visits]),
    [], ['Daily check-ins', 'Check-ins'],
    ...daily.map((row) => [row.date, row.checkIns]),
    [], ['Registration date', 'Total', 'Active', 'Cancelled'],
    ...registrationTrend.map((row) => [row.date, row.registrations, row.active, row.cancelled]),
    [], ['Ticket tier', 'Total', 'Active'],
    ...ticketTiers.map((row) => [row.tier, row.count, row.active]),
    [], ['Payment status', 'Registrations', 'Amount paid (PKR)', 'Refunded (PKR)'],
    ...paymentBreakdown.map((row) => [row.status, row.count, row.amountPaid, row.refundedAmount]),
    [], ['Session', 'Registrations'],
    ...popular.map((row) => [row.title, row.registeredCount]),
    [], ['Industry', 'Approved exhibitors'],
    ...industries.map((row) => [row.industry, row.count]),
  ].map((row) => row.map(csvCell).join(',')).join('\r\n');

  const exportPdf = async () => {
    if (!expoId || pdfLoading) return;
    setPdfLoading(true);
    try {
      const blob = await downloadExpoAnalyticsPdf(expoId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `eventsphere-${(selected?.expo?.title || 'expo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setAnalyticsError(error.message || 'Unable to export the PDF report.');
    } finally {
      setPdfLoading(false);
    }
  };

  return <>
    <PageHeader title="Analytics & reports" subtitle="Live database metrics for registrations, check-ins, verified booth visits and session engagement."
      actions={<><select className="select" value={expoId} onChange={(event) => setExpoId(event.target.value)} aria-label="Choose Expo" disabled={!expoAnalytics.length}>{expoAnalytics.map((item) => <option key={item.expo._id} value={item.expo._id}>{item.expo.title}</option>)}</select><button className="btn btn-outline" onClick={() => setRefreshKey((key) => key + 1)} disabled={analyticsLoading}><Activity size={16}/> Refresh</button><button className="btn btn-outline" disabled={!selected || pdfLoading} onClick={exportPdf}><Download size={16}/> {pdfLoading ? 'Preparing PDF…' : 'Export PDF'}</button><button className="btn btn-primary" disabled={!selected} onClick={() => { const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `eventsphere-${(selected?.expo?.title || 'expo').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-report.csv`; a.click(); URL.revokeObjectURL(url); }}><Download size={16}/> Export CSV</button></>} />
    {analyticsLoading && <p className="muted">Loading live analytics…</p>}
    {analyticsError && <div className="alert alert-error" role="alert">{analyticsError}</div>}
    {!analyticsLoading && !analyticsError && !selected && <div className="card"><EmptyState icon={Activity} title="No Expo analytics yet" text="Create and publish an Expo with registrations to see its report." /></div>}
    <div className="grid grid-4">
      <StatCard icon={Activity} label="Total Expos" value={dashboardAnalytics?.totalExpos ?? '—'} tone="accent" />
      <StatCard icon={UsersIcon} label="Attendee accounts" value={dashboardAnalytics?.totalAttendees ?? '—'} tone="blue" />
      <StatCard icon={Store} label="Exhibitor accounts" value={dashboardAnalytics?.totalExhibitors ?? '—'} tone="teal" />
      <StatCard icon={Ticket} label="Active Expo registrations" value={dashboardAnalytics?.activeExpoRegistrations ?? '—'} tone="gold" />
    </div>
    {selected && <>
      <div className="grid grid-4 mt">
        <StatCard icon={Ticket} label="Total registrations" value={selected.totalRegistrations} />
        <StatCard icon={CheckCircle2} label="Active registrations" value={selected.activeRegistrations} />
        <StatCard icon={Ban} label="Cancelled registrations" value={selected.cancelledRegistrations} />
        <StatCard icon={Activity} label="Sessions" value={selected.totalSessions} />
      </div>
      <div className="grid grid-2 mt">
        <div className="card card-pad"><h3>Registration trend</h3><p className="muted small">Registrations by registration date in the Expo timezone. Cancelled records remain visible for historical context.</p><div className="chart">{registrationTrend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={registrationTrend}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/><XAxis dataKey="date" tick={ax.tick} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tick={ax.tick}/><Tooltip contentStyle={tip.contentStyle}/><Line type="monotone" dataKey="active" name="Active" stroke="var(--c2)" strokeWidth={2.5} dot={false}/><Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="var(--c4)" strokeWidth={2} dot={false}/></LineChart></ResponsiveContainer> : <EmptyState icon={Ticket} title="No registration history" text="Registration trends appear when attendees register for this Expo."/>}</div></div>
        <div className="card card-pad"><h3>Ticket tier breakdown</h3><p className="muted small">Total and currently active registrations by ticket tier.</p><div className="chart">{ticketTiers.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={ticketTiers}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/><XAxis dataKey="tier" tick={ax.tick}/><YAxis allowDecimals={false} tick={ax.tick}/><Tooltip contentStyle={tip.contentStyle}/><Bar dataKey="active" name="Active" fill="var(--c2)" radius={[5,5,0,0]}/><Bar dataKey="count" name="Total" fill="var(--c1)" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyState icon={Ticket} title="No ticket records" text="Ticket tier statistics appear after registrations are created."/>}</div></div>
        <div className="card card-pad"><h3>Payment summary</h3><p className="muted small">Payment status and amounts recorded in the database. Amounts are in PKR.</p>{paymentBreakdown.length ? <div className="table-wrap"><table className="table"><thead><tr><th>Status</th><th className="right">Tickets</th><th className="right">Paid</th><th className="right">Refunded</th></tr></thead><tbody>{paymentBreakdown.map((row) => <tr key={row.status}><td><strong className="capitalize">{row.status.replaceAll('_', ' ')}</strong></td><td className="right">{row.count}</td><td className="right">{Number(row.amountPaid || 0).toLocaleString('en-PK')}</td><td className="right">{Number(row.refundedAmount || 0).toLocaleString('en-PK')}</td></tr>)}</tbody></table></div> : <EmptyState icon={Activity} title="No payment records" text="Payment summaries appear when ticket records exist."/>}</div>
        <div className="card card-pad"><h3>Daily attendance check-ins</h3><p className="muted small">Actual attendee check-ins grouped by the Expo timezone.</p><div className="chart">{daily.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/><XAxis dataKey="date" tick={ax.tick} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tick={ax.tick}/><Tooltip contentStyle={tip.contentStyle}/><Bar dataKey="checkIns" name="Check-ins" fill="var(--c1)" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyState icon={UsersIcon} title="No check-ins recorded" text="Check-ins will appear here after attendees are scanned at the event."/>}</div></div>
        <div className="card card-pad"><h3>Booth allocation</h3><p className="muted small">Current booth status from the database; this is allocation, not visitor-traffic tracking.</p><div className="chart">{selected.totalBooths ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={boothData} dataKey="count" nameKey="status" outerRadius="78%" label>{boothData.map((entry, index) => <Cell key={entry.status} fill={COLORS[index % COLORS.length]}/>)}</Pie><Tooltip contentStyle={tip.contentStyle}/></PieChart></ResponsiveContainer> : <EmptyState icon={Store} title="No booths yet" text="Booth allocation will appear after booths are added."/>}</div><div className="row wrap gap-sm">{boothData.map((item) => <Badge key={item.status}>{item.status}: {item.count}</Badge>)}</div></div>
        <div className="card card-pad"><h3>Booth traffic</h3><p className="muted small">Verified attendee-to-booth visits. Each attendee is counted once per booth; this is scan-based engagement, not an automatic people counter.</p><div className="row wrap gap-md" style={{ marginBottom: 14 }}><StatCard icon={Store} label="Recorded booth visits" value={boothTraffic.totalVisits || 0} /><StatCard icon={UsersIcon} label="Unique Expo attendees visiting booths" value={boothTraffic.uniqueAttendees || 0} /></div>{topBooths.length ? <div className="chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={topBooths} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/><XAxis type="number" allowDecimals={false} tick={ax.tick}/><YAxis type="category" dataKey="boothNumber" width={90} tick={ax.tick}/><Tooltip contentStyle={tip.contentStyle}/><Bar dataKey="uniqueVisitors" name="Unique visitors" fill="var(--c3)" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer></div> : <EmptyState icon={Store} title="No booth visits recorded" text="Scan an already checked-in attendee's ticket at a booth to start measuring booth engagement."/>}</div>
        <div className="card card-pad"><h3>Daily booth engagement</h3><p className="muted small">Recorded attendee visits grouped by the Expo timezone.</p><div className="chart">{dailyBoothVisits.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={dailyBoothVisits}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/><XAxis dataKey="date" tick={ax.tick} tickLine={false} axisLine={false}/><YAxis allowDecimals={false} tick={ax.tick}/><Tooltip contentStyle={tip.contentStyle}/><Bar dataKey="visits" name="Booth visits" fill="var(--c2)" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyState icon={Activity} title="No daily booth engagement yet" text="Daily booth visits will appear after verified scans are recorded."/>}</div></div>
        <div className="card card-pad"><h3>Session popularity</h3><p className="muted small">Ranked by active attendee registrations (bookmarks excluded).</p><div className="chart">{popular.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={popular} layout="vertical" margin={{ left: 12, right: 12 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/><XAxis type="number" allowDecimals={false} tick={ax.tick}/><YAxis type="category" dataKey="title" width={130} tick={ax.tick}/><Tooltip contentStyle={tip.contentStyle}/><Bar dataKey="registeredCount" name="Registrations" fill="var(--c2)" radius={[0,5,5,0]}/></BarChart></ResponsiveContainer> : <EmptyState icon={CalendarClock} title="No session registrations" text="Session popularity appears when attendees register for sessions."/>}</div></div>
        <div className="card card-pad"><h3>Approved exhibitors by industry</h3><p className="muted small">Approved applications for the selected Expo, grouped by exhibitor profile industry.</p><div className="chart">{industries.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={industries}><CartesianGrid strokeDasharray="3 3" stroke="var(--line)"/><XAxis dataKey="industry" tick={ax.tick}/><YAxis allowDecimals={false} tick={ax.tick}/><Tooltip contentStyle={tip.contentStyle}/><Bar dataKey="count" name="Exhibitors" fill="var(--c3)" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer> : <EmptyState icon={Store} title="No approved exhibitors" text="Approved exhibitors will be grouped by industry here."/>}</div></div>
      </div>
    </>}
  </>;
}

export function AdminUsers() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getAdminUsersApi({ page, limit: 20, search: q, role, status });
        if (!active) return;
        setUsers((data.users || []).map((item) => ({ ...item, id: String(item._id || item.id) })));
        setPagination(data.pagination || { total: 0, totalPages: 1 });
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load users.');
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [page, q, role, status, refreshKey]);

  const refresh = () => setRefreshKey((value) => value + 1);
  const L = { admin: 'Organizer', exhibitor: 'Exhibitor', attendee: 'Attendee' };

  const changeStatus = async (account) => {
    const nextStatus = account.status === 'active' ? 'suspended' : 'active';
    if (!(await confirm({ title: `${nextStatus === 'suspended' ? 'Suspend' : 'Reactivate'} ${account.name}?`, message: nextStatus === 'suspended' ? 'They will lose access to authenticated features.' : 'They will be able to sign in again.', confirmText: nextStatus === 'suspended' ? 'Suspend' : 'Reactivate', danger: nextStatus === 'suspended' }))) return;
    try {
      await updateAdminUserStatusApi(account.id, nextStatus);
      toast.success(nextStatus === 'suspended' ? 'User suspended' : 'User reactivated');
      refresh();
    } catch (actionError) { toast.error('Could not update user', actionError.message); }
  };

  const changeRole = async (account, nextRole) => {
    if (nextRole === account.role) return;
    if (!(await confirm({ title: `Change ${account.name}'s role?`, message: `Change from ${L[account.role]} to ${L[nextRole]}. Role changes can remove access to role-specific data.`, confirmText: 'Change role', danger: true }))) return;
    try {
      await updateAdminUserRoleApi(account.id, nextRole);
      toast.success('User role updated');
      refresh();
    } catch (actionError) { toast.error('Could not change role', actionError.message); }
  };

  const removeUser = async (account) => {
    if (!(await confirm({ title: `Delete ${account.name}?`, message: 'This permanently removes the account and linked personal records. Event ownership is transferred where required.', danger: true, confirmText: 'Delete account' }))) return;
    try {
      await deleteAdminUserApi(account.id);
      toast.success('User deleted');
      if (users.length === 1 && page > 1) setPage((value) => value - 1);
      else refresh();
    } catch (actionError) { toast.error('Could not delete user', actionError.message); }
  };

  return (
    <>
      <PageHeader title="Users" subtitle={`${pagination.total} database accounts across all roles.`} />
      <div className="toolbar">
        <SearchBox value={q} onChange={(value) => { setQ(value); setPage(1); }} placeholder="Search name, email or company…" />
        <select className="select" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }} aria-label="Filter by role"><option value="">All roles</option><option value="admin">Organizers</option><option value="exhibitor">Exhibitors</option><option value="attendee">Attendees</option></select>
        <select className="select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} aria-label="Filter by status"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
      </div>
      <div className="card card-flush">
        {loading ? <p className="center muted small">Loading database users…</p> : error ? <div className="card-pad"><p className="alert alert-error">{error}</p><button className="btn btn-outline" onClick={refresh}>Retry</button></div> : users.length ? <>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>User</th><th>Role</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{users.map((account) => (
              <tr key={account.id}>
                <td><div className="cell-user"><Avatar user={account} size={38} /><div><strong>{account.company || account.name}</strong><small>{account.company ? `${account.name} · ` : ''}{account.email}</small></div></div></td>
                <td><select className="select" value={account.role} disabled={account.id === user.id} onChange={(event) => changeRole(account, event.target.value)} aria-label={`Role for ${account.name}`}><option value="admin">Organizer</option><option value="exhibitor">Exhibitor</option><option value="attendee">Attendee</option></select></td>
                <td className="muted">{account.createdAt ? fmtDate(String(account.createdAt).slice(0, 10)) : '—'}</td>
                <td><StatusBadge status={account.status || 'active'} /></td>
                <td className="right nowrap">{account.id !== user.id && <><button className="btn btn-sm btn-outline" onClick={() => changeStatus(account)}>{account.status === 'active' ? <><Ban size={14} /> Suspend</> : <><CheckCircle2 size={14} /> Activate</>}</button>{' '}<button className="icon-btn" aria-label={`Delete ${account.name}`} onClick={() => removeUser(account)}><Trash2 size={17} /></button></>}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <div className="row between card-pad"><span className="small muted">Page {pagination.page || page} of {Math.max(1, pagination.totalPages || 1)}</span><div className="row gap-sm"><button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</button><button className="btn btn-sm btn-outline" disabled={page >= (pagination.totalPages || 1)} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
        </> : <EmptyState icon={UsersIcon} title="No users found" text="Try changing your search or filters." />}
      </div>
    </>
  );
}

export function AdminFeedback() {
  const toast = useToast();

  const [tab, setTab] = useState('all');
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [note, setNote] = useState({});

  const loadFeedback = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};

      if (['suggestion', 'issue', 'question'].includes(tab)) {
        params.type = tab;
      } else if (['open', 'in_progress', 'resolved'].includes(tab)) {
        params.status = tab;
      }

      const data = await getAllFeedback(params);
      setFeedbacks(data.feedbacks || []);
    } catch (err) {
      setError(err.message || 'Unable to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeedback();
  }, [tab]);

  const handleUpdate = async (id, status, currentNote) => {
    try {
      const result = await updateFeedback(id, {
        status,
        note: currentNote,
      });

      setFeedbacks((previous) =>
        previous.map((f) =>
          f._id === id ? result.feedback : f
        )
      );

      toast.success('Feedback updated');
    } catch (err) {
      toast.error('Update failed', err.message);
    }
  };

  const T = {
    suggestion: 'Suggestion',
    issue: 'Issue',
    question: 'Question',
  };

  return (
    <>
      <PageHeader
        title="Feedback inbox"
        subtitle="Suggestions, issues and questions submitted by attendees."
      />

      <div className="card card-flush">
        <div style={{ padding: '0 14px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'all', label: 'All' },
              { key: 'open', label: 'Open' },
              { key: 'in_progress', label: 'In progress' },
              { key: 'resolved', label: 'Resolved' },
              { key: 'issue', label: 'Issues' },
              { key: 'suggestion', label: 'Suggestions' },
              { key: 'question', label: 'Questions' },
            ]}
          />
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            Loading feedback...
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p>{error}</p>
            <button className="btn btn-outline" onClick={loadFeedback}>
              Retry
            </button>
          </div>
        ) : feedbacks.length ? (
          <ul className="fb-list wide">
            {feedbacks.map((f) => (
              <li key={f._id}>
                <div className="row between top wrap">
                  <div>
                    <strong>{f.subject}</strong>
                    <p className="small faint">
                      {f.attendee?.name || f.name || 'Attendee'} ·
                      {' '}{f.attendee?.email || f.email || 'No email'} ·
                      {' '}{timeAgo(f.createdAt)}
                    </p>
                    {f.expo?.title && <p className="xs muted">Expo: {f.expo.title}</p>}
                  </div>

                  <div className="row gap-sm">
                    <Badge
                      tone={
                        f.type === 'issue'
                          ? 'red'
                          : f.type === 'question'
                            ? 'blue'
                            : 'teal'
                      }
                    >
                      {T[f.type] || f.type}
                    </Badge>
                    <StatusBadge status={f.status} />
                  </div>
                </div>

                <p className="muted">{f.comment}</p>

                <div className="row wrap gap-sm">
                  {f.rating > 0 && (
                    <span className="row gap-sm small faint">
                      <Star size={14} fill="currentColor" />
                      {f.rating}/5
                    </span>
                  )}

                  <input
                    className="input grow"
                    style={{ minWidth: 200 }}
                    placeholder="Internal / reply note..."
                    value={note[f._id] ?? f.note ?? ''}
                    onChange={(e) =>
                      setNote((previous) => ({
                        ...previous,
                        [f._id]: e.target.value,
                      }))
                    }
                    aria-label="Internal note"
                  />

                  {['open', 'in_progress', 'resolved'].map((status) => (
                    <button
                      key={status}
                      className={`btn btn-sm ${
                        f.status === status ? 'btn-dark' : 'btn-outline'
                      }`}
                      onClick={() =>
                        handleUpdate(
                          f._id,
                          status,
                          note[f._id] ?? f.note ?? ''
                        )
                      }
                    >
                      {status === 'in_progress'
                        ? 'In progress'
                        : status[0].toUpperCase() + status.slice(1)}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MessageCircleHeart}
            title="Inbox zero"
            text="No feedback in this view."
          />
        )}
      </div>
    </>
  );
}

