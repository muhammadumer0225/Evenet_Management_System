
import { useEffect, useState } from 'react';
import { CalendarDays, Megaphone, RefreshCw, Users } from 'lucide-react';
import { EmptyState, PageHeader } from '../../components/ui';
import { getMyAnnouncements } from '../../lib/api';
import { timeAgo } from '../../lib/utils';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await getMyAnnouncements();
        setAnnouncements(data || []);
      } catch (err) {
        setError(err.message || 'Could not load announcements.');
      } finally {
        setLoading(false);
      }
    };

    loadAnnouncements();
  }, [reloadVersion]);

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Important updates and announcements from the event team."
        actions={<button type="button" className="btn btn-outline" onClick={() => setReloadVersion((value) => value + 1)} disabled={loading}><RefreshCw size={16} /> Refresh</button>}
      />

      {loading ? (
        <p className="muted">Loading announcements...</p>
      ) : error ? (
        <div className="alert alert-error" role="alert">
          <p>{error}</p>
          <button type="button" className="btn btn-sm btn-outline" onClick={() => setReloadVersion((value) => value + 1)}>Try again</button>
        </div>
      ) : announcements.length ? (
        <div className="announcement-admin-grid announcement-public-grid">
          {announcements.map((item) => (
            <article className="announcement-admin-card announcement-public-card" key={item._id}>
              <div className="announcement-admin-top">
                <span className="announcement-published"><Megaphone size={13} /> Announcement</span>
                <span className="announcement-audience"><Users size={14} /> {item.targetAudience === 'all' ? 'Everyone' : item.targetAudience === 'attendees' ? 'Attendees' : 'Exhibitors'}</span>
              </div>
              <h3>{item.title}</h3>
              <p className="announcement-admin-message">{item.message}</p>
              <div className="announcement-admin-meta">
                <span><CalendarDays size={14} /> {new Date(item.createdAt).toLocaleDateString()}</span>
                {item.expo?.title && <span>Expo: {item.expo.title}</span>}
                <span>{timeAgo(item.createdAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Megaphone}
          title="No announcements yet"
          text="There are no announcements available for you right now."
        />
      )}
    </>
  );
}
