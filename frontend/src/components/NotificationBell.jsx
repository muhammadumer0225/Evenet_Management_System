import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { getMyNotifications, markNotificationAsRead, markAllNotificationsRead } from '../lib/api';
import { socket } from '../lib/socket';
import { timeAgo } from '../lib/utils';

export default function NotificationBell() {
  const { user } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const nav = useNavigate();
  const unread = notifications.filter((notification) => !notification.isRead).length;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotifications([]);
    getMyNotifications()
      .then((data) => { if (active) setNotifications(data.notifications || []); })
      .catch((error) => { if (active) toast.error('Could not load notifications', error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    const handleNewNotification = (notification) => {
      setNotifications((previous) => previous.some((item) => item._id === notification._id)
        ? previous
        : [notification, ...previous]);
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

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const esc = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const markAllRead = async () => {
    if (!unread || busy) return;
    setBusy(true);
    try {
      await markAllNotificationsRead();
      setNotifications((previous) => previous.map((notification) => ({ ...notification, isRead: true })));
    } catch (error) {
      toast.error('Could not update notifications', error.message);
    } finally {
      setBusy(false);
    }
  };

  const openNotification = async (notification) => {
    if (!notification.isRead) {
      try {
        await markNotificationAsRead(notification._id);
        setNotifications((previous) => previous.map((item) => item._id === notification._id ? { ...item, isRead: true } : item));
      } catch (error) {
        toast.error('Could not update notification', error.message);
        return;
      }
    }
    setOpen(false);
    if (notification.link) nav(notification.link);
  };

  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn bell" onClick={() => setOpen((value) => !value)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} aria-expanded={open}>
        <Bell size={20} />
        {unread > 0 && <span className="bell-dot">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown-panel notif-panel">
          <div className="dropdown-head">
            <strong>Notifications</strong>
            <button className="btn btn-ghost btn-sm" onClick={markAllRead} disabled={!unread || busy}>
              <CheckCheck size={14} /> Mark all read
            </button>
          </div>
          <ul>
            {loading ? <li className="dropdown-empty">Loading notifications…</li> : notifications.slice(0, 6).map((notification) => (
              <li key={notification._id}>
                <button className={`notif-item ${notification.isRead ? '' : 'unread'}`} onClick={() => openNotification(notification)}>
                  <span className={`notif-dot tone-${notification.type}`} />
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{notification.message}</small>
                    <em>{timeAgo(notification.createdAt)}</em>
                  </span>
                </button>
              </li>
            ))}
            {!loading && !notifications.length && <li className="dropdown-empty">You're all caught up.</li>}
          </ul>
          <Link className="dropdown-foot" to="/dashboard/notifications" onClick={() => setOpen(false)}>View all notifications</Link>
        </div>
      )}
    </div>
  );
}
