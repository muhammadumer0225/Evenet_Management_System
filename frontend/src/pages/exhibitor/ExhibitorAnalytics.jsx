import { useEffect, useState } from 'react';
import { Activity, BarChart3, Download, Store, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState, PageHeader, StatCard } from '../../components/ui';
import { downloadMyBoothAnalyticsPdf, getMyBoothAnalytics } from '../../lib/api';
import { useExpoRealtimeVersion } from '../../hooks/useExpoRealtimeVersion';
import { buildExhibitorAnalyticsCsv } from '../../utils/exhibitorAnalyticsCsv';

const tooltipStyle = {
  contentStyle: {
    background: 'var(--surface)',
    border: '1px solid var(--line)',
    borderRadius: 10,
    color: 'var(--ink)',
  },
};

export default function ExhibitorAnalytics() {
  const [analytics, setAnalytics] = useState({ summary: {}, booths: [], dailyVisits: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [appliedRange, setAppliedRange] = useState({ from: '', to: '' });
  const realtimeVersion = useExpoRealtimeVersion();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const result = await getMyBoothAnalytics(appliedRange);
        if (active) setAnalytics(result);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load your booth analytics.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [realtimeVersion, appliedRange]);

  const summary = analytics.summary || {};
  const booths = analytics.booths || [];
  const dailyVisits = analytics.dailyVisits || [];

  const exportPdf = async () => {
    setPdfLoading(true);
    setError('');
    try {
      const blob = await downloadMyBoothAnalyticsPdf(appliedRange);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'eventsphere-my-booth-analytics.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Unable to export your booth analytics PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  const exportCsv = () => {
    const csv = buildExhibitorAnalyticsCsv(analytics);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'eventsphere-my-booth-analytics.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="page-section">
      <PageHeader
        title="Booth analytics"
        subtitle="Track verified attendee engagement across booths assigned to your company."
      />
      <p className="muted small">These figures come from verified booth check-ins, not automatic physical footfall. The selected date range applies to visits and attendee counts; assigned booth count is not date-limited. Unique attendees are deduplicated across all your booths, while daily unique counts are calculated separately for each day.</p>
      <div className="card card-pad" style={{ marginBottom: 16 }}>
        <div className="row wrap gap-md align-end">
          <label className="field"><span>From date</span><input className="input" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label className="field"><span>To date</span><input className="input" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
          <button type="button" className="btn btn-primary" onClick={() => setAppliedRange({ from: fromDate, to: toDate })} disabled={Boolean(fromDate && toDate && fromDate > toDate)}>Apply dates</button>
          <button type="button" className="btn btn-outline" onClick={() => { setFromDate(''); setToDate(''); setAppliedRange({ from: '', to: '' }); }}>Clear filter</button>
        </div>
        <p className="muted small">Showing all dates until a range is applied. Date boundaries use Pakistan Standard Time; exports use the same selected range.</p>
      </div>
      <div className="row justify-end" style={{ marginBottom: 16 }}>
        <button type="button" className="btn btn-outline" onClick={exportCsv} disabled={loading || Boolean(error)}>
          <Download size={16} /> Export CSV
        </button>
        <button type="button" className="btn btn-primary" onClick={exportPdf} disabled={loading || pdfLoading || Boolean(error)}>
          <Download size={16} /> {pdfLoading ? 'Preparing PDF…' : 'Export PDF'}
        </button>
      </div>
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {loading ? (
        <div className="page-loading"><p>Loading your booth analytics...</p></div>
      ) : (
        <>
          <div className="row wrap gap-md">
            <StatCard icon={Activity} label="Recorded visits" value={summary.totalVisits || 0} />
            <StatCard icon={Users} label="Unique attendees" value={summary.uniqueAttendees || 0} />
            <StatCard icon={Store} label="Assigned booths" value={summary.assignedBooths || 0} />
          </div>

          <div className="card card-pad" style={{ marginTop: 20 }}>
            <h3>Daily booth engagement</h3>
            <p className="muted small">Recorded visits per day, using Pakistan Standard Time.</p>
            <div className="chart">
              {dailyVisits.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyVisits}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--ink-3)', fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fill: 'var(--ink-3)', fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle.contentStyle} />
                    <Bar dataKey="visits" name="Recorded visits" fill="var(--c2)" radius={[5, 5, 0, 0]} />
                    <Bar dataKey="uniqueVisitors" name="Unique attendees that day" fill="var(--c3)" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={BarChart3} title="No booth visits yet" text="Daily engagement will appear after an admin records verified attendee visits at your booths." />
              )}
            </div>
          </div>

          <div className="card card-pad" style={{ marginTop: 20 }}>
            <h3>Your booth performance</h3>
            {booths.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>Expo</th><th>Booth</th><th>Status</th><th>Recorded visits</th><th>Unique attendees</th></tr></thead>
                  <tbody>
                    {booths.map((booth) => (
                      <tr key={booth.boothId}>
                        <td>{booth.expo?.title || 'Expo'}</td>
                        <td>{booth.boothNumber || '—'}</td>
                        <td><span className="badge">{booth.status}</span></td>
                        <td>{booth.visits}</td>
                        <td>{booth.uniqueVisitors}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={Store} title="No assigned booths" text="Once an Expo booth is assigned to your exhibitor account, its engagement statistics will appear here." />
            )}
          </div>
        </>
      )}
    </section>
  );
}
