
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  BellRing,
  CheckCircle2,
  Info,
  MessageSquare,
  TriangleAlert,
  CheckCheck,
  RefreshCw,
} from 'lucide-react';

import { useAuth } from '../../context/AuthContext';
import { EmptyState, PageHeader, Tabs } from '../../components/ui';
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsRead,
} from '../../lib/api';
import { cx, timeAgo } from '../../lib/utils';
import { socket } from '../../lib/socket';

const ICON = {
  application_approved: CheckCircle2,
  application_rejected: TriangleAlert,
  info: Info,
  message: MessageSquare,
  reminder: BellRing,
  new_message: MessageSquare,
  feedback_update: MessageSquare,
  new_announcement: BellRing,
  new_application: CheckCircle2,
  session_reminder: BellRing,
  session_update: BellRing,
  session_cancelled: TriangleAlert,
};

export default function Notifications() {
  const { user } = useAuth();
  const nav = useNavigate();

  const [tab, setTab] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await getMyNotifications();

        if (active) {
          setNotifications(data.notifications || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load notifications.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadNotifications();

    return () => {
      active = false;
    };
  }, [reloadVersion]);

  useEffect(() => {
  const handleNewNotification = (notification) => {
    setNotifications((previous) => {
      const exists = previous.some(
        (n) => n._id === notification._id
      );

      if (exists) return previous;

      return [notification, ...previous];
    });
  };

  const handleNotificationRead = ({ notificationId, readAt }) => {
    setNotifications((previous) => previous.map((item) => item._id === notificationId ? { ...item, isRead: true, readAt } : item));
  };
  const handleAllRead = ({ readAt }) => {
    setNotifications((previous) => previous.map((item) => ({ ...item, isRead: true, readAt })));
  };

  socket.on('new-notification', handleNewNotification);
  socket.on('notification-read', handleNotificationRead);
  socket.on('notifications-read-all', handleAllRead);

  return () => {
    socket.off('new-notification', handleNewNotification);
    socket.off('notification-read', handleNotificationRead);
    socket.off('notifications-read-all', handleAllRead);
  };
}, []);

  const unread = notifications.filter((n) => !n.isRead).length;

  const list =
    tab === 'unread'
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  const handleMarkAllRead = async () => {
    if (markingAll || !unread) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead();
      setNotifications((previous) => previous.map((notification) => ({ ...notification, isRead: true })));
    } catch (err) {
      setError(err.message || 'Unable to mark notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    try {
      if (!notification.isRead) {
        await markNotificationAsRead(notification._id);

        setNotifications((previous) =>
          previous.map((n) =>
            n._id === notification._id
              ? { ...n, isRead: true }
              : n
          )
        );
      }

      if (notification.link) {
        nav(notification.link);
      }
    } catch (err) {
      setError(err.message || 'Unable to update notification.');
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates about your applications and activities."
        actions={<div className="row gap-sm"><button type="button" className="btn btn-outline" onClick={() => setReloadVersion((value) => value + 1)} disabled={loading}><RefreshCw size={16} /> Refresh</button><button className="btn btn-outline" onClick={handleMarkAllRead} disabled={!unread || markingAll}><CheckCheck size={16} /> {markingAll ? 'Updating…' : 'Mark all read'}</button></div>}
      />

      <div className="card card-flush">
        <div style={{ padding: '0 14px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                key: 'all',
                label: 'All',
                count: notifications.length,
              },
              {
                key: 'unread',
                label: 'Unread',
                count: unread,
              },
            ]}
          />
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            Loading notifications...
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <p>{error}</p>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setReloadVersion((value) => value + 1)}
            >
              Retry
            </button>
          </div>
        ) : list.length ? (
          <ul className="notif-list">
            {list.map((n) => {
              const Icon = ICON[n.type] || Bell;

              return (
                <li key={n._id}>
                  <button
                    className={cx(
                      'notif-row',
                      !n.isRead && 'unread'
                    )}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <span
                      className={cx(
                        'notif-ico',
                        `tone-bg-${n.type}`
                      )}
                    >
                      <Icon size={18} />
                    </span>

                    <span className="grow">
                      <strong>{n.title}</strong>
                      <small>{n.message}</small>
                    </span>

                    <em>{timeAgo(n.createdAt)}</em>

                    {!n.isRead && (
                      <i
                        className="unread-dot"
                        aria-label="Unread"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={Bell}
            title={
              tab === 'unread'
                ? 'No unread notifications'
                : 'Nothing here yet'
            }
            text="We'll let you know when something happens."
          />
        )}
      </div>
    </>
  );
}
