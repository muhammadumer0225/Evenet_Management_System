import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, BarChart3, CalendarCheck, CheckCircle2, ClipboardList, LayoutGrid, Map, MessageSquare, Radio, ShieldCheck,
  Sparkles, Store, Ticket,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ExpoCard } from '../components/Cards';
import FloorPlan from '../components/FloorPlan';
import { Badge, CountUp } from '../components/ui';
import { getBooths, getExpoStats, getPublishedExpos } from '../lib/api';
import { normalizeBooth, normalizeExpo } from '../lib/normalizers';
import { CATEGORIES } from '../lib/seed';
import { fmtRange } from '../lib/utils';
import { useExpoRealtimeVersion } from '../hooks/useExpoRealtimeVersion';

const ROLES = [
  {
    icon: ClipboardList, title: 'Organizers', tone: 'accent', to: '/login', action: 'Organizer access',
    text: 'Create expos, allocate booths on the floor plan, approve exhibitors, schedule sessions and review analytics.',
    points: ['Expo and booth management', 'Application review', 'Attendance and payment analytics'],
  },
  {
    icon: Store, title: 'Exhibitors', tone: 'teal', to: '/register?role=exhibitor', action: 'Join as exhibitor',
    text: 'Apply to published expos, reserve an available booth, build your company showcase and connect with visitors.',
    points: ['Apply for exhibitor space', 'Showcase products and staff', 'Message organizers and visitors'],
  },
  {
    icon: Ticket, title: 'Attendees', tone: 'blue', to: '/register?role=attendee', action: 'Join as attendee',
    text: 'Discover expos, register for passes, plan your agenda and keep your digital ticket ready for check-in.',
    points: ['Digital pass with QR code', 'Session agenda and bookmarks', 'Registration verification and check-in'],
  },
];

const FEATURES = [
  [Map, 'Interactive floor plans', 'Explore booth locations, availability and exhibitor spaces on an easy-to-read floor plan.'],
  [Radio, 'Timely updates', 'Keep up with expo announcements, schedule changes, booth allocations and messages.'],
  [CalendarCheck, 'Session scheduling', 'Browse sessions, speakers and timings, then build an agenda for your visit.'],
  [BarChart3, 'Useful analytics', 'Review registrations, check-ins, booth occupancy and session popularity.'],
  [MessageSquare, 'Built-in messaging', 'Let exhibitors and organizers communicate without leaving the platform.'],
  [ShieldCheck, 'Role-based access', 'Separate organizer, exhibitor and attendee workspaces with protected account access.'],
];

const STEPS = [
  [LayoutGrid, 'Organizer publishes an expo', 'Expo details, ticket options and booth information become available to visitors.'],
  [Store, 'Exhibitors apply for space', 'Companies submit an application and manage their booth showcase after approval.'],
  [CalendarCheck, 'Attendees plan a visit', 'Visitors register for a pass, explore exhibitors and save sessions to their agenda.'],
  [BarChart3, 'The event stays connected', 'Announcements, check-in and analytics help teams manage the expo.'],
];

export default function Home() {
  const { user } = useAuth();
  const realtimeVersion = useExpoRealtimeVersion();
  const [expos, setExpos] = useState([]);
  const [statsByExpo, setStatsByExpo] = useState({});
  const [statsComplete, setStatsComplete] = useState(false);
  const [heroBooths, setHeroBooths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadHomeData() {
      setLoading(true);
      setError('');
      try {
        const published = await getPublishedExpos();
        const normalized = published.map(normalizeExpo);
        if (!active) return;
        setExpos(normalized);

        const statsResults = await Promise.allSettled(
          normalized.map(async (expo) => [expo.id, await getExpoStats(expo.id)])
        );
        if (!active) return;
        const nextStats = {};
        statsResults.forEach((result) => {
          if (result.status === 'fulfilled') {
            const [id, stats] = result.value;
            nextStats[id] = stats;
          }
        });
        setStatsByExpo(nextStats);
        setStatsComplete(statsResults.every((result) => result.status === 'fulfilled'));
      } catch (err) {
        if (active) setError(err.message || 'Unable to load published expos right now.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHomeData();
    return () => { active = false; };
  }, [realtimeVersion]);

  const featured = useMemo(() => expos.slice(0, 3), [expos]);
  const heroExpo = featured[0] || null;
  const heroStats = heroExpo ? statsByExpo[heroExpo.id] : null;

  useEffect(() => {
    let active = true;
    setHeroBooths([]);
    if (!heroExpo) {
      return () => { active = false; };
    }
    getBooths(heroExpo.id)
      .then((booths) => {
        if (active) setHeroBooths((booths || []).map((booth) => normalizeBooth(booth, user)));
      })
      .catch(() => {
        if (active) setHeroBooths([]);
      });
    return () => { active = false; };
  }, [heroExpo?.id, user, realtimeVersion]);

  const totals = useMemo(() => Object.values(statsByExpo).reduce((sum, stats) => ({
    registrations: sum.registrations + Number(stats.registrations || 0),
    exhibitors: sum.exhibitors + Number(stats.exhibitors || 0),
    available: sum.available + Number(stats.available || 0),
  }), { registrations: 0, exhibitors: 0, available: 0 }), [statsByExpo]);
  const hasStats = statsComplete;

  return (
    <>
      <section className="hero">
        <div className="hero-bg" aria-hidden="true" />
        <div className="container hero-grid">
          <div className="hero-copy">
            <Badge tone="accent" className="hero-pill"><Sparkles size={14} /> Expo &amp; trade show management</Badge>
            <h1>Run the whole expo <span className="hl">from one sphere.</span></h1>
            <p className="lead">
              EventSphere brings organizers, exhibitors and attendees together with expo management, booth reservations,
              schedules, digital passes, messaging and analytics.
            </p>
            <div className="row wrap gap-lg hero-cta">
              <Link to="/expos" className="btn btn-primary btn-lg">Explore expos <ArrowRight size={18} /></Link>
              {user ? (
                <Link to="/dashboard" className="btn btn-outline btn-lg">Go to dashboard</Link>
              ) : (
                <Link to="/register?role=attendee" className="btn btn-outline btn-lg">Join as attendee</Link>
              )}
            </div>
            <ul className="hero-proof">
              <li><CheckCircle2 size={16} /> Browse expos for free</li>
              <li><CheckCircle2 size={16} /> Standard passes are free</li>
              <li><CheckCircle2 size={16} /> Secure, role-based access</li>
            </ul>
          </div>

          {heroExpo ? (
            <div className="hero-visual">
              <div className="hero-card card">
                <div className="row between">
                  <div>
                    <Badge tone="blue">Featured expo</Badge>
                    <h3 className="hero-card-title">{heroExpo.title}</h3>
                    <p className="small muted">{fmtRange(heroExpo.startDate, heroExpo.endDate)} · {heroExpo.city || heroExpo.location}</p>
                  </div>
                  {heroStats && (
                    <div className="hero-occ">
                      <strong>{heroStats.occupancy}%</strong>
                      <span>booths occupied</span>
                    </div>
                  )}
                </div>
                {heroBooths.length > 0 ? (
                  <div className="hero-plan">
                    <FloorPlan booths={heroBooths} layout={heroExpo.layout} users={[]} />
                  </div>
                ) : (
                  <div className="home-plan-placeholder">
                    <Map size={28} />
                    <strong>Explore the expo floor plan</strong>
                    <span>View booth locations and availability</span>
                  </div>
                )}
                <Link to={`/expos/${heroExpo.id}`} className="btn btn-dark btn-block">
                  View expo details <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="hero-visual">
              <div className="home-plan-placeholder home-empty-hero">
                <CalendarCheck size={34} />
                <strong>{loading ? 'Loading published expos…' : 'Your next event starts here'}</strong>
                <span>{error || 'Explore the platform and check back for upcoming expos.'}</span>
                <Link to="/expos" className="btn btn-dark">Browse expos <ArrowRight size={16} /></Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="container stats-band" aria-label="EventSphere platform statistics">
        {[
          [expos.length, 'Published expos'],
          [totals.exhibitors, 'Exhibitor placements'],
          [totals.registrations, 'Attendee registrations'],
          [totals.available, 'Available booths'],
        ].map(([value, label]) => (
          <div key={label}>
            <strong>{loading || !hasStats ? (label === 'Published expos' && !loading ? <CountUp to={value} /> : '—') : <CountUp to={value} />}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="section container">
        <div className="section-head">
          <span className="eyebrow">One platform, three portals</span>
          <h2>Built for everyone on the expo floor</h2>
          <p className="muted">Choose your role and get the tools and workspace that match how you take part.</p>
        </div>
        <div className="grid grid-3">
          {ROLES.map((role) => (
            <article key={role.title} className={`card card-pad role-card role-${role.tone}`}>
              <span className="role-icon"><role.icon size={24} /></span>
              <h3>{role.title}</h3>
              <p className="muted">{role.text}</p>
              <ul>
                {role.points.map((point) => <li key={point}><CheckCircle2 size={16} /> {point}</li>)}
              </ul>
              <Link to={role.to} className="link row gap-sm">{role.action} <ArrowRight size={16} /></Link>
              {role.title === 'Organizers' && <span className="small muted">Organizer registration requires an invitation code.</span>}
            </article>
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="section-head row between wrap">
          <div><span className="eyebrow">What's on</span><h2>Featured expos</h2></div>
          <Link to="/expos" className="btn btn-outline">View all expos <ArrowRight size={16} /></Link>
        </div>
        {loading ? (
          <div className="card card-pad home-message" role="status">Loading published expos…</div>
        ) : error ? (
          <div className="card card-pad home-message" role="alert">{error} <Link to="/expos" className="link">Browse expos</Link></div>
        ) : featured.length ? (
          <div className="grid grid-3">
            {featured.map((expo) => <ExpoCard key={expo.id} expo={expo} />)}
          </div>
        ) : (
          <div className="card card-pad home-message">
            <CalendarCheck size={24} />
            <strong>No published expos yet</strong>
            <span className="muted">New events will appear here when organizers publish them.</span>
          </div>
        )}
        <div className="chip-row cat-row">
          {CATEGORIES.map((category) => <Link key={category} to={`/expos?category=${encodeURIComponent(category)}`} className="chip">{category}</Link>)}
        </div>
      </section>

      <section className="section features">
        <div className="container">
          <div className="section-head center">
            <span className="eyebrow">Everything in one place</span>
            <h2>Replace spreadsheets, inboxes and sticky notes</h2>
          </div>
          <div className="grid grid-3 feature-grid">
            {FEATURES.map(([Icon, title, description]) => (
              <div key={title} className="feature">
                <span className="feature-icon"><Icon size={22} /></span>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-head">
          <span className="eyebrow">How it works</span>
          <h2>From application to opening day</h2>
        </div>
        <ol className="steps">
          {STEPS.map(([Icon, title, description], index) => (
            <li key={title}>
              <span className="step-n">{index + 1}</span>
              <Icon size={22} className="step-icon" />
              <h3>{title}</h3>
              <p className="muted">{description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="container">
        <div className="cta-band">
          <div>
            <h2>Ready to make your next expo effortless?</h2>
            <p>Create your EventSphere account to register for expos, apply for booth space or manage an event.</p>
          </div>
          <div className="row wrap gap-lg">
            <Link to="/register" className="btn btn-primary btn-lg">Create an account</Link>
            <Link to="/login" className="btn btn-lg cta-ghost">Sign in</Link>
          </div>
        </div>
      </section>
    </>
  );
}
