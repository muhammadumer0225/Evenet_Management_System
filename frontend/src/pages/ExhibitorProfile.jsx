import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarClock, Globe, Info, Mail, MapPin, MessageSquare, Phone, Tag, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FloorPlan from '../components/FloorPlan';
import { Avatar, Badge, EmptyState, Field, Modal } from '../components/ui';
import { useToast } from '../context/UIContext';
import { getPublicExhibitorProfile, getExpoFloorPlan, sendMessage } from '../lib/api';
import { addDays, fmtRange } from '../lib/utils';
import { idOf, normalizeBooth } from '../lib/normalizers';

export default function ExhibitorProfile() {
  const { id } = useParams();
const [sp] = useSearchParams();
const { user } = useAuth();
const nav = useNavigate();
const toast = useToast();

const [profileData, setProfileData] = useState(null);
const [floorPlanData, setFloorPlanData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');

const ex = profileData?.exhibitor;
const profile = profileData?.profile;
const booths = (profileData?.booths || []).map((booth) =>
  normalizeBooth(booth, user)
);
  const [appt, setAppt] = useState(false);
  const [form, setForm] = useState({ date: addDays(1), time: '11:00', note: '' });

const focusExpo = sp.get('expo');

const main =
  booths.find((b) => b.expoId === focusExpo) || booths[0];

const mainExpo = main?.expo;
const showcase = main?.showcase;

const staff = showcase?.staff?.length
  ? showcase.staff
  : profile?.staff || [];

const products = showcase?.products?.length
  ? showcase.products
  : profile?.productsServices || [];

  const floorBooths = (floorPlanData?.booths || []).map((booth) =>
  normalizeBooth(booth, user)
);

const floorUsers = (floorPlanData?.booths || [])
  .filter((booth) => booth.exhibitor)
  .map((booth) => ({
    id: idOf(booth.exhibitor),
    name: booth.exhibitor.name,
  }))
  .filter((person, index, people) =>
    people.findIndex((item) => item.id === person.id) === index
  );

  useEffect(() => {
  let active = true;

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const data = await getPublicExhibitorProfile(id);

      if (active) {
        setProfileData(data);
      }
    } catch (err) {
      if (active) {
        setError(err.message || 'Unable to load exhibitor profile.');
      }
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  };

  loadProfile();

  return () => {
    active = false;
  };
}, [id]);

useEffect(() => {
  let active = true;

  const loadFloorPlan = async () => {
    if (!mainExpo?._id && !main?.expoId) return;

    try {
      const data = await getExpoFloorPlan(main.expoId);

      if (active) {
        setFloorPlanData(data);
      }
    } catch (err) {
      if (active) {
        setFloorPlanData(null);
        console.error('Floor plan loading error:', err);
      }
    }
  };

  loadFloorPlan();

  return () => {
    active = false;
  };
}, [main?.expoId]);


if (loading) {
  return <div className="container page">Loading exhibitor profile...</div>;
}

if (error || !ex || !profile) {
  return (
    <div className="container page">
      <EmptyState
        icon={Info}
        title="Exhibitor not found"
        action={
          <Link className="btn btn-primary" to="/exhibitors">
            Back to directory
          </Link>
        }
      />
    </div>
  );
}
  


 
  const needLogin = () => {
    nav('/login', { state: { from: `/exhibitors/${id}` } });
  };
  const contact = () => {
    if (!user) return needLogin();
    if (idOf(user) === idOf(ex)) return toast.info('This is your own profile');
    nav(`/dashboard/messages?to=${idOf(ex)}`);
  };
  const bookAppt = () => {
    if (!user) return needLogin();
    if (idOf(user) === idOf(ex)) return toast.info('This is your own profile');
    setAppt(true);
  };
  const sendAppt = () => {
    if (!form.date || !form.time) return toast.error('Please choose a date and time');
    sendMessage({
      from: idOf(user), to: idOf(ex), kind: 'appointment',
      text: `Appointment request for ${form.date} at ${form.time}${mainExpo ? ' at ' + mainExpo.title : ''}${form.note ? ' — ' + form.note : ''}`,
      meta: { ...form, expoId: main?.expoId },
    });
    toast.success('Request sent', `${profile.companyName} will confirm by message.`);
    setAppt(false);
  };

  return (
    <div className="container page">
      <Link to="/exhibitors" className="back-link"><ArrowLeft size={16} /> All exhibitors</Link>

      <section className="card card-flush profile-head">
        <div className="profile-banner" style={{ '--h': 12 }} />
        <div className="profile-id">
          <Avatar user={ex} size={96} square />
          <div className="grow">
            <div className="row gap-sm wrap"><Badge tone="accent">{profile.industry}</Badge>{mainExpo && <Badge tone="blue"><MapPin size={12} /> Booth {main.boothNumber}</Badge>}</div>
            <h1>{profile.companyName}</h1>
            <p className="muted">{showcase?.tagline || profile.tagline || profile.description}</p>
          </div>
          <div className="row wrap gap-sm">
            <button className="btn btn-outline" onClick={bookAppt}><CalendarClock size={17} /> Book appointment</button>
            <button className="btn btn-primary" onClick={contact}><MessageSquare size={17} /> Message</button>
          </div>
        </div>
      </section>

      <div className="split mt">
        <div className="stack">
          <section className="card card-pad stack">
            <h2 className="h3">About</h2>
            <p className="prose">{profile.description || 'This exhibitor has not added a description yet.'}</p>
            {showcase?.offer && <div className="alert alert-warning"><Tag size={18} /> <div><strong>Show special:</strong> {showcase.offer}</div></div>}
          </section>
          <section className="card card-pad stack">
            <h2 className="h3">Products &amp; services</h2>
            {products.length ? (
              <div className="grid grid-3 product-grid">
                {products.map((p) => {
  const name = typeof p === 'string' ? p : p.name;

  return (
    <div key={typeof p === 'string' ? p : p._id || name} className="product">
      <span>{name?.slice(0, 1) || '?'}</span>
      <strong>{name}</strong>
      {typeof p !== 'string' && p.description && (
        <p className="small muted">{p.description}</p>
      )}
    </div>
  );
})}
              </div>
            ) : <p className="muted">Nothing listed yet.</p>}
          </section>
          {main && mainExpo && (
            <section className="card card-pad stack">
             <div className="row between wrap"><h2 className="h3">Find them on the floor</h2><Link className="link" to={`/expos/${main.expoId}`}>{mainExpo.title}</Link></div>
<FloorPlan
  booths={floorBooths}
  layout={{ rows: 5, cols: 8 }}
  users={floorUsers}
  highlightIds={[main.id]}
  selectedId={main.id}
/>
              <p className="small muted"><MapPin size={14} /> Booth <strong>{main.label}</strong> · {main.zone} · {fmtRange(mainExpo.startDate, mainExpo.endDate)}</p>
            </section>
          )}
        </div>
        <aside className="stack">
          <section className="card card-pad stack">
            <h3>Contact</h3>
            <ul className="contact-list">
              {profile.website && <li><Globe size={17} /> <a href={profile.website} target="_blank" rel="noreferrer noopener" className="link">{profile.website.replace(/^https?:\/\//, '')}</a></li>}
              {profile.linkedin && <li><Globe size={17} /> <a href={profile.linkedin} target="_blank" rel="noreferrer noopener" className="link">LinkedIn profile</a></li>}
              {staff[0]?.email && <li><Mail size={17} /> {staff[0].email}</li>}
              {profile.contactPhone && <li><Phone size={17} /> {profile.contactPhone}</li>}
              
            </ul>
          </section>
          <section className="card card-pad stack">
            <h3><Users size={18} style={{ verticalAlign: '-3px' }} /> Booth team</h3>
            {staff.length ? staff.map((s) => (
              <div key={s.id || s.name} className="row"><Avatar name={s.name} size={38} /><div><strong>{s.name}</strong><p className="small muted">{s.role}</p></div></div>
            )) : <p className="muted small">No staff listed.</p>}
            {showcase?.hours && <p className="small muted">Booth hours: {showcase.hours}</p>}
          </section>
          {booths.length > 1 && (
            <section className="card card-pad stack-sm">
              <h3>Exhibiting at</h3>
              {booths.map((b) => (
  <Link key={b.id} className="small link" to={`/exhibitors/${id}?expo=${b.expoId}`}>
    {b.expo?.title || 'Expo'} · {b.label}
  </Link>
))}
            </section>
          )}
        </aside>
      </div>

      <Modal open={appt} onClose={() => setAppt(false)} title={`Book a meeting with ${profile.companyName}`} subtitle="Your request is sent as a message. They'll confirm or suggest another time."
        footer={<><button className="btn btn-ghost" onClick={() => setAppt(false)}>Cancel</button><button className="btn btn-primary" onClick={sendAppt}>Send request</button></>}>
        <div className="form-grid">
          <Field label="Date" required>{(i) => <input id={i} className="input" type="date" min={addDays(0)} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />}</Field>
          <Field label="Time" required>{(i) => <input id={i} className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />}</Field>
          <Field label="What would you like to discuss?" className="full">{(i) => <textarea id={i} className="textarea" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="e.g. Pricing for the cloud ERP, partnership options…" />}</Field>
        </div>
      </Modal>
    </div>
  );
}
