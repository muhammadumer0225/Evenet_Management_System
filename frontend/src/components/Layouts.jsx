import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Bell, CalendarClock, CalendarDays, ClipboardCheck, ExternalLink, Handshake, LayoutDashboard, LifeBuoy, LogOut,
  Map, Menu, MessageSquare, Moon, Settings, Store, Sun, Ticket, Users, X, Building2, UserCog, Search, Megaphone, ShieldCheck, ScanLine,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { Avatar, Logo } from './ui';
import NotificationBell from './NotificationBell';
import ChatbotWidget from './ChatbotWidget';
import { getMyConversations } from '../lib/api';
import { socket } from '../lib/socket';
import { cx } from '../lib/utils';

/* ---------------- Theme toggle ---------------- */
export function ThemeToggle() {
  const { theme, toggleTheme } = useUI();
  return (
    <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>
      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
    </button>
  );
}

/* ---------------- Route guards ---------------- */
export function RequireAuth({ roles }) {
  const { user, authLoading } = useAuth();
  const loc = useLocation();

  if (authLoading) {
    return <div>Checking authentication...</div>;
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: loc.pathname }}
      />
    );
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export function GuestOnly() {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/* ---------------- Cookie / consent banner (GDPR) ---------------- */
function ConsentBanner() {
  const [show, setShow] = useState(() => {
    try {
      return !localStorage.getItem('eventsphere.cookies');
    } catch {
      return false;
    }
  });
  if (!show) return null;
  const set = (v) => {
    try {
      localStorage.setItem('eventsphere.cookies', v);
    } catch {
      /* ignore */
    }
    setShow(false);
  };
  return (
    <div className="consent" role="dialog" aria-label="Cookie consent">
      <ShieldCheck size={22} />
      <p>
        We use essential cookies to keep you signed in and optional analytics to improve events. You are in control —{' '}
        <Link to="/privacy">read our Privacy Policy</Link>.
      </p>
      <div className="row gap-sm">
        <button className="btn btn-ghost btn-sm" onClick={() => set('essential')}>
          Essential only
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => set('all')}>
          Accept all
        </button>
      </div>
    </div>
  );
}

/* ---------------- Public layout ---------------- */
const PUB_NAV = [
  ['/expos', 'Expos'],
  ['/exhibitors', 'Exhibitors'],
  ['/schedule', 'Schedule'],
  ['/help', 'Help'],
  ['/contact', 'Contact'],
];

export function PublicLayout() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  return (
    <div className="site">
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" aria-label="EventSphere home">
            <Logo />
          </Link>
          <nav className={cx('site-nav', open && 'open')} aria-label="Main">
            {PUB_NAV.map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) => cx('nav-link', isActive && 'active')}>
                {label}
              </NavLink>
            ))}
            <div className="nav-cta-mobile">
              {user ? (
                <Link to="/dashboard" className="btn btn-primary">Open dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="btn btn-outline">Log in</Link>
                  <Link to="/register" className="btn btn-primary">Get started</Link>
                </>
              )}
            </div>
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard" className="btn btn-primary btn-sm hide-sm">
                <LayoutDashboard size={16} /> Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm hide-sm">Log in</Link>
                <Link to="/register" className="btn btn-primary btn-sm hide-sm">Get started</Link>
              </>
            )}
            <button className="icon-btn menu-btn" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Logo light />
            <p>The all-in-one platform for expos and trade shows — floor plans, exhibitors, schedules and live analytics in one place.</p>
          </div>
          <div>
            <h4>Explore</h4>
            <Link to="/expos">Browse expos</Link>
            <Link to="/exhibitors">Exhibitor directory</Link>
            <Link to="/schedule">Event schedule</Link>
          </div>
          <div>
            <h4>Get involved</h4>
            <Link to="/register?role=exhibitor">Exhibit with us</Link>
            <Link to="/register?role=attendee">Attend an expo</Link>
            <Link to="/register?role=admin">Organize events</Link>
          </div>
          <div>
            <h4>Support</h4>
            <Link to="/help">Help centre &amp; FAQ</Link>
            <Link to="/contact">Contact &amp; feedback</Link>
            <Link to="/privacy">Privacy &amp; consent</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} EventSphere Management. All rights reserved.</span>
          <span>Built with MongoDB · Express · React · Node.js</span>
        </div>
      </footer>
      <ConsentBanner />
      <ChatbotWidget />
    </div>
  );
}

/* ---------------- Dashboard layout ---------------- */
const NAV = {
  admin: [
    ['/dashboard', 'Overview', LayoutDashboard, true],
    ['/dashboard/expos', 'Expos', CalendarDays],
    ['/dashboard/applications', 'Applications', ClipboardCheck, false, 'pending'],
    ['/dashboard/booths', 'Floor plan & booths', Map],
    ['/dashboard/check-in', 'Attendee check-in', ScanLine],
    ['/dashboard/booth-visits', 'Booth visitor check-in', Store],
    ['/dashboard/schedule', 'Schedule', CalendarClock],
    ['/dashboard/analytics', 'Analytics & reports', BarChart3],
    ['/dashboard/users', 'Users', Users],
    ['/dashboard/feedback', 'Feedback inbox', Megaphone, false, 'feedback'],
    ['/dashboard/announcements', 'Announcements', Megaphone],
    ['/dashboard/messages', 'Messages', MessageSquare, false, 'messages'],
  ],
  exhibitor: [
    ['/dashboard', 'Overview', LayoutDashboard, true],
    ['/dashboard/expos', 'Find expos & apply', CalendarDays],
    ['/dashboard/applications', 'My applications', ClipboardCheck],
    ['/dashboard/booth', 'Book a booth', Map],
    ['/dashboard/showcase', 'Booth showcase', Store],
    ['/dashboard/booth-analytics', 'Booth analytics', BarChart3],
    ['/dashboard/neighbors', 'Neighbours', Handshake],
    ['/dashboard/announcements', 'Announcements', Megaphone],
    ['/dashboard/messages', 'Messages', MessageSquare, false, 'messages'],
    ['/dashboard/profile', 'Company profile', Building2],
  ],
  attendee: [
    ['/dashboard', 'Overview', LayoutDashboard, true],
    ['/dashboard/expos', 'Expos & tickets', Ticket],
    ['/dashboard/agenda', 'My agenda', CalendarClock],
    ['/dashboard/exhibitors', 'Find exhibitors', Search],
    ['/dashboard/announcements', 'Announcements', Megaphone],
    ['/dashboard/messages', 'Messages', MessageSquare, false, 'messages'],
  ],
};
const ROLE_LABEL = { admin: 'Organizer', exhibitor: 'Exhibitor', attendee: 'Attendee' };

export function DashLayout() {
  const { user, db, logout } = useAuth();
  const { toast } = useUI();
  const nav = useNavigate();
  const loc = useLocation();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);

  useEffect(() => setOpen(false), [loc.pathname]);

  // Load unread conversation count from the backend and keep it current over Socket.IO.
  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    const refreshUnread = async () => {
      try {
        const conversations = await getMyConversations();
        if (active) setUnreadMessageCount(conversations.reduce((sum, conversation) => sum + (conversation.unread || 0), 0));
      } catch {
        if (active) setUnreadMessageCount(0);
      }
    };
    void refreshUnread();
    const onNewMessage = () => { void refreshUnread(); };
    const onConversationRead = () => { void refreshUnread(); };
    const onNewNotification = (notification) => toast.info(notification.title, notification.message);
    socket.on('new-message', onNewMessage);
    socket.on('conversation-read', onConversationRead);
    socket.on('new-notification', onNewNotification);
    return () => {
      active = false;
      socket.off('new-message', onNewMessage);
      socket.off('conversation-read', onConversationRead);
      socket.off('new-notification', onNewNotification);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenu(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menu]);

  if (!user) return null;
  const items = NAV[user.role] || [];
  const counts = {
    pending: db.applications.filter((a) => a.status === 'pending').length,
    feedback: db.feedback.filter((f) => f.status === 'open').length,
    messages: unreadMessageCount,
  };
  const live = db.expos.find((e) => e.status === 'live');

  const bottom = [
    ['/dashboard/notifications', 'Notifications', Bell],
    ...(user.role === 'attendee' ? [['/dashboard/feedback', 'Help & feedback', LifeBuoy]] : []),
    ['/dashboard/account', 'Account settings', Settings],
  ];

  const renderItem = ([to, label, Icon, end, countKey]) => (
    <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('side-link', isActive && 'active')}>
      <Icon size={19} />
      <span>{label}</span>
      {countKey && counts[countKey] > 0 && <b className="side-count">{counts[countKey]}</b>}
    </NavLink>
  );

  return (
    <div className="dash">
      <aside className={cx('sidebar', open && 'open')}>
        <div className="sidebar-top">
          <Link to="/" aria-label="EventSphere home">
            <Logo />
          </Link>
          <button className="icon-btn side-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <div className="role-chip">
          <UserCog size={14} /> {ROLE_LABEL[user.role]} portal
        </div>
        <nav className="side-nav" aria-label="Dashboard">
          {items.map(renderItem)}
          <hr />
          {bottom.map(([to, label, Icon]) => renderItem([to, label, Icon]))}
        </nav>
        {live && (
          <Link to={`/expos/${live.id}`} className="side-live">
            <span className="pulse" /> <div><small>Happening now</small><strong>{live.title}</strong></div>
          </Link>
        )}
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="dash-main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div className="topbar-hello">
            <small>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</small>
            <strong>Hello, {user.name.split(' ')[0]} 👋</strong>
          </div>
          <div className="topbar-actions">
            <Link to="/expos" className="btn btn-ghost btn-sm hide-sm">
              <ExternalLink size={15} /> Public site
            </Link>
            <ThemeToggle />
            <NotificationBell />
            <div className="dropdown" ref={menuRef}>
              <button className="user-btn" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Account menu">
                <Avatar user={user} size={36} />
              </button>
              {menu && (
                <div className="dropdown-panel user-panel">
                  <div className="user-panel-head">
                    <Avatar user={user} size={44} />
                    <div>
                      <strong>{user.name}</strong>
                      <small>{user.email}</small>
                    </div>
                  </div>
                  <Link to="/dashboard/account" onClick={() => setMenu(false)}><Settings size={16} /> Account settings</Link>
                  <Link to="/" onClick={() => setMenu(false)}><ExternalLink size={16} /> Public website</Link>
                  <button
                    onClick={() => {
                      logout();
                      nav('/');
                    }}
                  >
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="dash-content" id="main" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <ChatbotWidget />
    </div>
  );
}
