import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Clock, Compass, Mail, MapPin, Phone, ShieldCheck, Store, Ticket, ClipboardList, Download, Eye, Trash2, Lock, FileQuestion } from 'lucide-react';
import FeedbackForm from '../components/FeedbackForm';
import { EmptyState, PageHeader, Tabs } from '../components/ui';
import { useAuth } from '../context/AuthContext';

/* ---------------- Contact ---------------- */
export function Contact() {
  return (
    <div className="container page">
      <PageHeader eyebrow="We're listening" title="Contact &amp; feedback" subtitle="Suggest a feature, report a problem or ask a question — it goes straight to the organizer team." />
      <div className="split">
        <div className="card card-pad"><FeedbackForm /></div>
        <aside className="stack">
          <div className="card card-pad stack">
            <h3>EventSphere Management</h3>
            <ul className="contact-list">
              <li><Mail size={17} /> support@eventsphere.example</li>
              <li><Phone size={17} /> +92 21 3555 0100</li>
              <li><MapPin size={17} /> Karachi Expo Centre, Business Wing</li>
              <li><Clock size={17} /> Mon–Sat · 9am – 6pm PKT</li>
            </ul>
          </div>
          <div className="card card-pad stack-sm">
            <h3>Looking for quick answers?</h3>
            <p className="muted small">Most questions are covered in the help centre.</p>
            <Link to="/help" className="btn btn-outline">Open help centre</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---------------- Help centre ---------------- */
const FAQ = {
  general: [
    ['What is EventSphere?', 'EventSphere is a platform for running expos and trade shows. Organizers manage events and floor plans, exhibitors apply for and manage booths, and attendees register, build agendas and discover exhibitors.'],
    ['Do I need an account to browse?', 'No. You can browse expos, the schedule and the exhibitor directory without signing in. You need a free account to register, bookmark sessions, apply as an exhibitor or send messages.'],
    ['How do real-time updates work?', 'Schedule changes, booth allocations, application decisions and new messages reach you instantly as in-app notifications. Reminders are generated for sessions that start within 24 hours.'],
    ['I forgot my password.', 'Use “Forgot password” on the login page. Enter your email and follow the reset link — it expires after 15 minutes.'],
  ],
  attendee: [
    ['How do I register for an expo?', 'Open an expo, choose Register and pick a ticket tier. Your digital pass with QR code appears under Expos & tickets.'],
    ['How do I build my agenda?', 'On the Schedule page, press Register to reserve a seat or Save to bookmark a session. Everything shows up in My agenda, and you can add sessions to your calendar.'],
    ['How do I contact an exhibitor?', 'Open the exhibitor profile and choose Message, or Book appointment to propose a time at their booth.'],
  ],
  exhibitor: [
    ['How do I exhibit at an expo?', 'Go to Find expos, press Apply, fill in your company details, products and upload documents. The organizer reviews applications and notifies you.'],
    ['How do I choose my booth?', 'After approval, open Book a booth. Select an available booth on the live floor plan and reserve it. The organizer confirms the reservation.'],
    ['Can I talk to the exhibitors next to me?', 'Yes — the Neighbours page lists adjacent booths and lets you message them or share your contact card.'],
  ],
  organizer: [
    ['How do I create an expo?', 'In Expos, choose New expo. Fill in title, dates, venue and description. A default floor plan is generated automatically and can be regenerated in Floor plan & booths.'],
    ['How do I approve exhibitors?', 'Open Applications, review the details and documents, then Approve (optionally assigning a booth immediately) or Reject with a reason.'],
    ['Can I export reports?', 'Yes. Analytics & reports lets you export attendance, booth traffic and session popularity as CSV.'],
  ],
};

export function Help() {
  const [tab, setTab] = useState('general');
  const [open, setOpen] = useState(0);
  const guides = [
    [Ticket, 'Attendees', 'Register, plan, explore.', 'attendee'],
    [Store, 'Exhibitors', 'Apply, book, showcase.', 'exhibitor'],
    [ClipboardList, 'Organizers', 'Create, allocate, analyse.', 'organizer'],
  ];
  return (
    <div className="container page">
      <PageHeader eyebrow="Help centre" title="How can we help?" subtitle="User guides and answers to common questions." />
      <div className="grid grid-3" style={{ marginBottom: 32 }}>
        {guides.map(([Icon, t, d, k]) => (
          <button key={k} className="card card-pad card-hover guide-card" onClick={() => { setTab(k); setOpen(0); }}>
            <span className="role-icon"><Icon size={22} /></span>
            <strong>{t} guide</strong>
            <span className="muted small">{d}</span>
          </button>
        ))}
      </div>
      <div className="card card-pad">
        <Tabs value={tab} onChange={(k) => { setTab(k); setOpen(0); }} tabs={[{ key: 'general', label: 'General', icon: Compass }, { key: 'attendee', label: 'Attendees', icon: Ticket }, { key: 'exhibitor', label: 'Exhibitors', icon: Store }, { key: 'organizer', label: 'Organizers', icon: ClipboardList }]} />
        <div className="faq">
          {FAQ[tab].map(([q, a], i) => (
            <div key={q} className={`faq-item ${open === i ? 'open' : ''}`}>
              <button onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i}>
                {q} <ChevronDown size={20} />
              </button>
              {open === i && <p>{a}</p>}
            </div>
          ))}
        </div>
      </div>
      <div className="card card-pad row between wrap mt">
        <div className="row"><FileQuestion size={26} className="faint" /><div><strong>Still stuck?</strong><p className="muted small">Our team usually replies within a few hours.</p></div></div>
        <Link to="/contact" className="btn btn-primary">Contact support</Link>
      </div>
    </div>
  );
}

/* ---------------- Privacy ---------------- */
export function Privacy() {
  const { user } = useAuth();
  const sections = [
    [Eye, 'What we collect', 'Account details (name, email, role), registrations, messages you send on the platform, and optional analytics about how pages are used. Exhibitors also provide company details and documents.'],
    [Lock, 'How we protect it', 'Passwords are stored only as salted hashes. Data is encrypted in transit (HTTPS) and at rest. Access is role-based: you can only see your own data and information that is public by design.'],
    [ShieldCheck, 'Your consent controls', 'You decide whether your company appears in the public directory, whether anonymous analytics are collected and whether you receive marketing messages. Change these any time in Account settings → Privacy.'],
    [Download, 'Your data, your rights', 'You may download a copy of your data or request deletion of your account at any time. Deletion removes your profile, registrations, applications and messages.'],
    [Trash2, 'Retention', 'We keep data only as long as needed to run the events you take part in, then archive or delete it according to applicable regulations such as GDPR.'],
  ];
  return (
    <div className="container page narrow">
      <PageHeader eyebrow="Privacy" title="Privacy &amp; consent" subtitle="Plain-language summary of how EventSphere handles your data." />
      <div className="stack">
        {sections.map(([Icon, t, d]) => (
          <section key={t} className="card card-pad row top gap-lg">
            <span className="role-icon"><Icon size={22} /></span>
            <div><h3>{t}</h3><p className="muted prose">{d}</p></div>
          </section>
        ))}
      </div>
      <div className="mt-lg center">
        {user ? <Link className="btn btn-primary" to="/dashboard/account?tab=privacy">Manage my privacy settings</Link> : <Link className="btn btn-primary" to="/login">Sign in to manage consent</Link>}
      </div>
    </div>
  );
}

/* ---------------- 404 ---------------- */
export function NotFound() {
  return (
    <div className="container page">
      <div className="card"><EmptyState icon={Compass} title="Page not found" text="The page you're looking for doesn't exist or has moved." action={<Link to="/" className="btn btn-primary">Back to home</Link>} /></div>
    </div>
  );
}
