import { useCallback, useEffect, useState } from 'react';
import { Clock, Mic2, Pencil, Plus, RefreshCw, Trash2, ScanLine, UserCheck } from 'lucide-react';
import { useConfirm, useToast } from '../../context/UIContext';
import { PlanLegend } from '../../components/FloorPlan';
import FloorPlanEditor from '../../components/FloorPlanEditor';
import { Avatar, Badge, EmptyState, Field, Modal, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import {
  getExpos,
  getSpeakers,
  getExpoSessions,
  createSessionApi,
  updateSessionApi,
  deleteSessionApi,
  getBooths,
  createBooth,
  updateBoothAPI,
  setBoothAvailabilityAPI,
  deleteBooth,
  getAllApplications,
  assignBoothToApplicationApi,
  checkInAttendeeApi,
  recordBoothVisitApi,
} from '../../lib/api';
import { boothsOf, expoStats, sessionSeats, userById } from '../../lib/selectors';
import { ROOMS, SESSION_TYPES } from '../../lib/seed';
import { fmtDate, fmtTime, money, zonedDateTimeToISO } from '../../lib/utils';
import { normalizeExpo, normalizeSession } from '../../lib/normalizers';
import { CalendarX, LayoutGrid, Map, Store, Users } from 'lucide-react';
import TicketScanner from '../../components/TicketScanner';
import { useExpoRealtimeVersion } from '../../hooks/useExpoRealtimeVersion';


const toFrontendBooth = (booth) => {
  const position = booth.position || {};

  return {
    ...booth,
    id: booth._id,
    label: booth.boothNumber,
  exhibitorId: booth.exhibitor?._id || booth.exhibitor || null,
owner: booth.exhibitor || null,
    row: Math.max(0, Math.floor(Number(position.y || 0) / 20)),
    col: Math.max(0, Math.floor(Number(position.x || 0) / 12.5)),
    zone: booth.zone || 'Main Hall',
    status: booth.status === 'occupied' ? 'booked' : booth.status,
    visits: 0,
  };
};


const toFrontendAdminExpo = (expo) => ({
  ...expo,
  id: expo._id,
  layout: {
    rows: 5,
    cols: 8,
  },
  floorPlan: expo.floorPlan || {},
  status: expo.status === 'published' ? 'upcoming' : expo.status,
  startDate: String(expo.startDate).slice(0, 10),
  endDate: String(expo.endDate).slice(0, 10),
});



function ExpoPicker({ value, onChange, expos }) {
  return <select className="select" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Choose expo">{expos.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>;
}

export function AdminCheckIn() {
  const toast = useToast();
  const realtimeVersion = useExpoRealtimeVersion();
  const [registrationId, setRegistrationId] = useState('');
  const [expoId, setExpoId] = useState('');
  const [expos, setExpos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let active = true;
    getExpos().then((items) => {
      if (active) setExpos(items.map(toFrontendAdminExpo));
    }).catch((error) => toast.error('Could not load expos', error.message));
    return () => { active = false; };
  }, [realtimeVersion]);

  const submitCheckIn = async (value = registrationId) => {
    const lookup = String(value || '').trim();
    if (!lookup || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const payload = /^[a-f0-9]{24}$/i.test(lookup)
        ? { registrationId: lookup, expoId: expoId || undefined }
        : { ticketCode: lookup, expoId: expoId || undefined };
      const response = await checkInAttendeeApi(payload);
      setResult(response.registration);
      setRegistrationId(lookup);
      toast.success('Attendee checked in', response.message);
    } catch (error) {
      toast.error('Check-in failed', error.message);
      setResult({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Attendee check-in" subtitle="Verify an active Expo registration and mark the attendee as checked in once." />
      <section className="card card-pad" style={{ maxWidth: 720 }}>
        <label className="field-label" htmlFor="checkin-expo">Expo (optional)</label>
        <select id="checkin-expo" className="select" value={expoId} onChange={(event) => setExpoId(event.target.value)}>
          <option value="">All expos</option>
          {expos.map((expo) => <option key={expo.id} value={expo.id}>{expo.title}</option>)}
        </select>
        <label className="field-label" htmlFor="checkin-code" style={{ marginTop: 16 }}>Registration ID or ticket code</label>
        <form className="row gap-sm wrap" onSubmit={(event) => { event.preventDefault(); submitCheckIn(); }}>
          <input id="checkin-code" className="input" style={{ flex: '1 1 280px' }} value={registrationId} onChange={(event) => setRegistrationId(event.target.value)} placeholder="Mongo registration ID or ES-XXXXXXXXXX" autoComplete="off" />
          <button className="btn btn-primary" type="submit" disabled={loading || !registrationId.trim()}>
            <UserCheck size={16} /> {loading ? 'Checking…' : 'Check in'}
          </button>
        </form>
        <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setScannerOpen(true)}>
          <ScanLine size={16} /> Scan QR code
        </button>
        {result && !result.error && (
          <div className="alert alert-success" role="status" style={{ marginTop: 16 }}>
            <strong>{result.attendee?.name || 'Attendee'} checked in successfully</strong>
            <div>{result.expo?.title} · {result.ticketTier?.toUpperCase()} · {result.ticketCode}</div>
            <div className="small">Checked in at {new Date(result.checkedInAt).toLocaleString()}</div>
          </div>
        )}
        {result?.error && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>{result.error}</div>}
      </section>
      <TicketScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={(value) => { setRegistrationId(value); void submitCheckIn(value); }} />
    </>
  );
}

export function AdminBoothVisits() {
  const toast = useToast();
  const [expos, setExpos] = useState([]);
  const [expoId, setExpoId] = useState('');
  const [booths, setBooths] = useState([]);
  const [boothId, setBoothId] = useState('');
  const [ticketValue, setTicketValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [boothsLoading, setBoothsLoading] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [result, setResult] = useState(null);
  const realtimeVersion = useExpoRealtimeVersion(expoId);

  useEffect(() => {
    let active = true;
    getExpos().then((items) => {
      if (!active) return;
      const formatted = items.map(toFrontendAdminExpo);
      setExpos(formatted);
      setExpoId((current) => current || formatted[0]?.id || '');
    }).catch((error) => toast.error('Could not load expos', error.message));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    if (!expoId) { setBooths([]); setBoothId(''); return undefined; }
    setBoothsLoading(true);
    getBooths(expoId).then((items) => {
      if (!active) return;
      setBooths(items || []);
      setBoothId((current) => items?.some((booth) => String(booth._id) === String(current)) ? current : String(items?.[0]?._id || ''));
    }).catch((error) => {
      if (active) toast.error('Could not load booths', error.message);
    }).finally(() => { if (active) setBoothsLoading(false); });
    return () => { active = false; };
  }, [expoId, realtimeVersion]);

  const submitVisit = async (value = ticketValue, source = 'manual_entry') => {
    const lookup = String(value || '').trim();
    if (!lookup || !boothId || loading) return;
    setLoading(true);
    setResult(null);
    try {
      const payload = /^[a-f0-9]{24}$/i.test(lookup) ? { registrationId: lookup } : { ticketCode: lookup };
      const response = await recordBoothVisitApi(boothId, { ...payload, source });
      setResult(response.visit);
      setTicketValue(lookup);
      toast.success('Booth visit recorded', response.message);
    } catch (error) {
      setResult({ error: error.message });
      toast.error('Visit not recorded', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Booth visitor check-in" subtitle="Record a verified attendee's visit to a specific booth. The attendee must already be checked in to the Expo." />
      <section className="card card-pad" style={{ maxWidth: 760 }}>
        <div className="alert alert-info" role="note" style={{ marginBottom: 18 }}>
          <strong>How to record a booth visit</strong>
          <ol style={{ margin: '8px 0 0', paddingLeft: 20 }}>
            <li>First, check the attendee in from <strong>Attendee check-in</strong>.</li>
            <li>Select the same Expo and the booth the attendee visited.</li>
            <li>Enter the attendee's Registration ID or ticket code, then choose <strong>Record visit</strong>.</li>
          </ol>
          <p className="small" style={{ margin: '8px 0 0' }}>A visit is saved only once per attendee, Expo and booth.</p>
        </div>
        <label className="field-label" htmlFor="visit-expo">Expo</label>
        <select id="visit-expo" className="select" value={expoId} onChange={(event) => { setExpoId(event.target.value); setResult(null); }}>
          <option value="">Choose an Expo</option>
          {expos.map((expo) => <option key={expo.id} value={expo.id}>{expo.title}</option>)}
        </select>
        <label className="field-label" htmlFor="visit-booth" style={{ marginTop: 16 }}>Booth</label>
        <select id="visit-booth" className="select" value={boothId} onChange={(event) => { setBoothId(event.target.value); setResult(null); }} disabled={!expoId || boothsLoading || !booths.length}>
          <option value="">{boothsLoading ? 'Loading booths…' : 'Choose a booth'}</option>
          {booths.map((booth) => <option key={booth._id} value={booth._id}>{booth.boothNumber} · {booth.zone || 'Main Hall'}</option>)}
        </select>
        <label className="field-label" htmlFor="visit-ticket" style={{ marginTop: 16 }}>Attendee registration ID or ticket code</label>
        <form className="row gap-sm wrap" onSubmit={(event) => { event.preventDefault(); submitVisit(); }}>
          <input id="visit-ticket" className="input" style={{ flex: '1 1 280px' }} value={ticketValue} onChange={(event) => setTicketValue(event.target.value)} placeholder="Mongo registration ID or ES-XXXXXXXXXX" autoComplete="off" />
          <button className="btn btn-primary" type="submit" disabled={loading || !boothId || !ticketValue.trim()}>{loading ? 'Recording…' : 'Record visit'}</button>
        </form>
        <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => setScannerOpen(true)} disabled={!boothId || loading}>
          <ScanLine size={16} /> Scan attendee ticket
        </button>
        {result && !result.error && (
          <div className="alert alert-success" role="status" style={{ marginTop: 16 }}>
            <strong>{result.attendee?.name || 'Attendee'} · Booth {result.booth?.boothNumber}</strong>
            <div>{result.expo?.title}</div>
            <div className="small">Visit recorded at {new Date(result.visitedAt).toLocaleString()}</div>
          </div>
        )}
        {result?.error && <div className="alert alert-error" role="alert" style={{ marginTop: 16 }}>{result.error}</div>}
        {!boothsLoading && expoId && !booths.length && <p className="small muted" style={{ marginTop: 12 }}>No booths are available for this Expo yet.</p>}
      </section>
      <TicketScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={(value) => { setTicketValue(value); void submitVisit(value, 'ticket_scan'); }} />
    </>
  );
}

export function AdminBooths() {
 
const toast = useToast();
const confirm = useConfirm();

const closeCreateForm = useCallback(() => {
  setShowCreateForm(false);
}, []);

const [expos, setExpos] = useState([]);

const [expoId, setExpoId] = useState('');

const [sel, setSel] = useState(null);


const [booths, setBooths] = useState([]);
const [approvedApplications, setApprovedApplications] = useState([]);
const [selectedApplicationId, setSelectedApplicationId] = useState('');
const [applicationsLoading, setApplicationsLoading] = useState(false);
const [loading, setLoading] = useState(false);

const [showCreateForm, setShowCreateForm] = useState(false);

const [showEditForm, setShowEditForm] = useState(false);

const [editBooth, setEditBooth] = useState({
  boothNumber: '',
  zone: 'Zone 2 · Standard',
  size: '10x10 ft',
  price: '',
});

const [newBooth, setNewBooth] = useState({
  boothNumber: '',
  zone: 'Zone 2 · Standard',
  size: '10x10 ft',
  price: '',
});

const expo = expos.find((e) => e.id === expoId);
const realtimeVersion = useExpoRealtimeVersion(expoId);

useEffect(() => {
  const loadExpos = async () => {
    try {
      const data = await getExpos();
      const formatted = data.map(toFrontendAdminExpo);

      console.table(
  formatted.map((e) => ({
    title: e.title,
    id: e.id,
  }))
);

      setExpos(formatted);

      const selected =
        formatted.find((e) => e.status === 'ongoing') ||
        formatted.find((e) => e.status === 'published') ||
        formatted[0];

      if (selected) {
        setExpoId(selected.id);
      }
    } catch (error) {
      toast.error('Could not load expos', error.message);
    }
  };

  loadExpos();
}, []);

const loadBooths = async () => {
  if (!expoId) return;

  try {
    setLoading(true);

    const data = await getBooths(expoId);



    setBooths(data.map(toFrontendBooth));
  } catch (error) {
    toast.error('Could not load booths', error.message);
  } finally {
    setLoading(false);
  }
};

useEffect(() => {
  loadBooths();
}, [expoId, realtimeVersion]);

const loadApprovedApplications = async () => {
  if (!expoId) return;

  try {
    setApplicationsLoading(true);

    const data = await getAllApplications({
      status: 'approved',
      expoId,
      limit: 100,
    });

    setApprovedApplications(data.applications || []);
  } catch (error) {
    toast.error('Could not load approved applications', error.message);
  } finally {
    setApplicationsLoading(false);
  }
};

useEffect(() => {
  loadApprovedApplications();
}, [expoId, realtimeVersion]);

const booth = booths.find((b) => b.id === sel);

const owner = booth?.owner || null;

const approved = approvedApplications.filter(
  (application) => !application.booth
);

const st = {
  total: booths.length,
  booked: booths.filter((b) => b.status === 'booked').length,
  reserved: booths.filter((b) => b.status === 'reserved').length,
  available: booths.filter((b) => b.status === 'available').length,
};


  
const act = async (fn, msg) => {
  try {
    await fn();
    await loadBooths();

    if (msg) {
      toast.success(msg);
    }
  } catch (error) {
    toast.error('Action failed', error.message);
  }
};

const handleCreateBooth = async () => {
  try {
    const boothNumber = newBooth.boothNumber.trim();

    if (!boothNumber || newBooth.price === '') {
      toast.error('Missing fields', 'Booth number and price are required.');
      return;
    }

    await createBooth({
      expo: expoId,
      boothNumber,
      zone: newBooth.zone,
      size: newBooth.size,
      price: Number(newBooth.price),
    });

    setShowCreateForm(false);

    setNewBooth({
      boothNumber: '',
      zone: 'Zone 2 · Standard',
      size: '10x10 ft',
      price: '',
    });

    await loadBooths();

    toast.success('Booth created successfully');

  } catch (error) {
    toast.error('Could not create booth', error.message);
  }
};

const handleUpdateBooth = async () => {
  try {
    const boothNumber = editBooth.boothNumber.trim();

    if (!boothNumber || editBooth.price === '') {
      toast.error('Missing fields', 'Booth number and price are required.');
      return;
    }

    const price = Number(editBooth.price);

    if (!Number.isFinite(price) || price < 0) {
      toast.error('Invalid price', 'Price must be zero or greater.');
      return;
    }

    await updateBoothAPI(booth.id, {
      boothNumber,
      zone: editBooth.zone,
      size: editBooth.size,
      price,
    });

    setShowEditForm(false);
    await loadBooths();
    toast.success('Booth updated successfully');
  } catch (error) {
    toast.error('Could not update booth', error.message);
  }
};

const handleSaveBoothPosition = async (boothId, position) => {
  const booth = booths.find((item) => item.id === boothId);
  if (!booth) throw new Error('Booth not found. Refresh the floor plan and try again.');
  try {
    await updateBoothAPI(boothId, {
      boothNumber: booth.boothNumber || booth.label,
      zone: booth.zone || 'Main Hall',
      size: booth.size,
      price: Number(booth.price || 0),
      status: booth.status === 'booked' ? 'occupied' : booth.status,
      exhibitor: booth.exhibitorId || null,
      position,
    });
    await loadBooths();
    toast.success('Booth position saved');
  } catch (error) {
    await loadBooths();
    toast.error('Could not save booth position', error.message);
    throw error;
  }
};

if (!expo) {
  return <div className="card card-pad">Loading expo data...</div>;
}


  return (
    <>
      <PageHeader
  title="Floor plan & booths"
  subtitle="Allocate booth spaces, confirm reservations and adjust pricing in real time."
  actions={
    <>
      <ExpoPicker
        value={expoId}
        onChange={(v) => {
          setExpoId(v);
          setSel(null);
        }}
        expos={expos}
      />

      <button
        className="btn btn-primary"
        onClick={() => setShowCreateForm(true)}
      >
        <Plus size={17} /> Add Booth
      </button>
    </>
  }
/>

<Modal
  open={showCreateForm}
 onClose={closeCreateForm}
  title="Add New Booth"
  subtitle={expo?.title}
  footer={
    <>
      <button
        className="btn btn-ghost"
        onClick={() => setShowCreateForm(false)}
      >
        Cancel
      </button>

      <button
        className="btn btn-primary"
        onClick={handleCreateBooth}
      >
        Create Booth
      </button>
    </>
  }
>
  <div className="form-grid">
    <Field label="Booth Number" required className="full">
      {(i) => (
        <input
          id={i}
          className="input"
          placeholder="Example: A-01"
          value={newBooth.boothNumber}
          onChange={(e) =>
            setNewBooth({
              ...newBooth,
              boothNumber: e.target.value,
            })
          }
        />
      )}
    </Field>

    <Field label="Expo Zone" required>
      {(i) => (
        <select id={i} className="select" value={newBooth.zone} onChange={(e) => setNewBooth({ ...newBooth, zone: e.target.value })}>
          <option>Zone 1 · Premier</option>
          <option>Zone 2 · Standard</option>
          <option>Zone 3 · Startup</option>
          <option>Main Hall</option>
        </select>
      )}
    </Field>

    <Field label="Booth Size">
      {(i) => (
        <select
          id={i}
          className="select"
          value={newBooth.size}
          onChange={(e) =>
            setNewBooth({
              ...newBooth,
              size: e.target.value,
            })
          }
        >
          <option value="10x10 ft">10x10 ft</option>
          <option value="10x20 ft">10x20 ft</option>
          <option value="20x20 ft">20x20 ft</option>
        </select>
      )}
    </Field>

    <Field label="Price (PKR)" required>
      {(i) => (
        <input
          id={i}
          className="input"
          type="number"
          min="0"
          placeholder="500"
          value={newBooth.price}
          onChange={(e) =>
            setNewBooth({
              ...newBooth,
              price: e.target.value,
            })
          }
        />
      )}
    </Field>
  </div>
</Modal>

<Modal
  open={showEditForm}
  onClose={() => setShowEditForm(false)}
  title="Edit Booth"
  subtitle="Update booth information"
  footer={
    <>
      <button
        className="btn btn-ghost"
        onClick={() => setShowEditForm(false)}
      >
        Cancel
      </button>

      <button
        className="btn btn-primary"
        onClick={handleUpdateBooth}
      >
        Save Changes
      </button>
    </>
  }
>
  <div className="form-grid">
    <Field label="Booth Number" required className="full">
      {(i) => (
        <input
          id={i}
          className="input"
          value={editBooth.boothNumber}
          onChange={(e) =>
            setEditBooth({
              ...editBooth,
              boothNumber: e.target.value,
            })
          }
        />
      )}
    </Field>

    <Field label="Expo Zone" required>
      {(i) => (
        <select id={i} className="select" value={editBooth.zone} onChange={(e) => setEditBooth({ ...editBooth, zone: e.target.value })}>
          <option>Zone 1 · Premier</option>
          <option>Zone 2 · Standard</option>
          <option>Zone 3 · Startup</option>
          <option>Main Hall</option>
        </select>
      )}
    </Field>

    <Field label="Booth Size">
      {(i) => (
        <select
          id={i}
          className="select"
          value={editBooth.size}
          onChange={(e) =>
            setEditBooth({
              ...editBooth,
              size: e.target.value,
            })
          }
        >
          <option value="10x10 ft">10x10 ft</option>
          <option value="10x20 ft">10x20 ft</option>
          <option value="20x20 ft">20x20 ft</option>
        </select>
      )}
    </Field>

    <Field label="Price (PKR)" required>
      {(i) => (
        <input
          id={i}
          className="input"
          type="number"
          min="0"
          value={editBooth.price}
          onChange={(e) =>
            setEditBooth({
              ...editBooth,
              price: e.target.value,
            })
          }
        />
      )}
    </Field>
  </div>
</Modal>



      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard icon={LayoutGrid} label="Total booths" value={st.total} />
        <StatCard icon={Store} label="Confirmed" value={st.booked} tone="blue" />
        <StatCard icon={Map} label="Reserved (to confirm)" value={st.reserved} tone="gold" />
        <StatCard icon={Users} label="Available" value={st.available} tone="green" />
      </div>
      <div className="split">
        <div className="card card-pad">
          <FloorPlanEditor
            booths={booths}
            selectedId={sel}
            backgroundImage={expo.floorPlan?.backgroundImage || ''}
            onSelect={(b) => {
              setSel(b.id);
              setSelectedApplicationId('');
            }}
            onSavePosition={handleSaveBoothPosition}
          />
          <PlanLegend items={['available', 'reserved', 'booked', 'blocked']} />
        </div>
        <aside className="card card-pad stack">
          {booth ? (
            <>
<div className="row between">
  <div>
    <span className="eyebrow">{booth.zone}</span>
    <h3>Booth {booth.label}</h3>
  </div>
  <StatusBadge status={booth.status} />
</div>

<button
  className="btn btn-outline btn-sm"
  onClick={() => {
    setEditBooth({
      boothNumber: booth.label,
      zone: booth.zone || 'Main Hall',
      size: booth.size,
      price: String(booth.price),
    });
    setShowEditForm(true);
  }}
>
  <Pencil size={15} /> Edit Booth
</button>
              {owner && <div className="row"><Avatar user={owner} size={44} square /><div><strong>{owner.company}</strong><p className="small muted">{owner.name}</p></div></div>}
              <div className="form-grid">
                <Field label="Size">{(i) => <select id={i} className="select" value={booth.size} onChange={(e) => act(() => updateBoothAPI(booth.id, { size: e.target.value }))}>{['S', 'M', 'L'].map((s) => <option key={s}>{s}</option>)}</select>}</Field>
                <Field label="Price (PKR)">{(i) => <input id={i} className="input" type="number" min="0" defaultValue={booth.price} key={booth.id + booth.price} onBlur={(e) =>
  Number(e.target.value) !== booth.price &&
  act(
    () => updateBoothAPI(booth.id, { price: Number(e.target.value) }),
    'Price updated'
  )
} />}</Field>
              </div>
              <Field label="Allocate to exhibitor" hint="Only exhibitors with an approved application.">{(i) => (
  <select
    id={i}
    className="select"
    value={selectedApplicationId}
    disabled={applicationsLoading || !approved.length || booth.status !== 'available'}
    onChange={(e) => setSelectedApplicationId(e.target.value)}
  >
    <option value="">— Select approved application —</option>

    {approved.map((application) => (
      <option key={application._id} value={application._id}>
        {application.exhibitorProfile?.companyName ||
          application.exhibitor?.name ||
          'Exhibitor'} — {application.preferredBoothSize}
      </option>
    ))}
  </select>
)}</Field>

{booth.status === 'available' && (
  <button
    className="btn btn-primary btn-sm"
    disabled={!selectedApplicationId || applicationsLoading}
    onClick={() =>
      act(
        async () => {
          await assignBoothToApplicationApi(
            booth.id,
            selectedApplicationId
          );

          setSelectedApplicationId('');
          await loadApprovedApplications();
        },
        'Booth assigned successfully'
      )
    }
  >
    Assign Booth
  </button>
)}
              <div className="row wrap gap-sm">
                {booth.status === 'reserved' && <button className="btn btn-primary btn-sm" onClick={() =>
  act(
    () => updateBoothAPI(booth.id, { status: 'occupied' }),
    'Booth confirmed'
  )
}>Confirm reservation</button>}
                {(booth.exhibitorId) && <button className="btn btn-outline btn-sm" onClick={async () => (await confirm({ title: `Release booth ${booth.label}?`, message: 'The exhibitor will be notified.', confirmText: 'Release', danger: true })) && act(
  () => updateBoothAPI(booth.id, { status: 'available', exhibitor: null }),
  'Booth released'
)}>Release</button>}
{booth.status === 'available' && (
  <button
    className="btn btn-outline btn-sm"
    onClick={() =>
      act(
        () => setBoothAvailabilityAPI(booth.id, 'blocked'),
        'Booth marked unavailable'
      )
    }
  >
    Mark Unavailable
  </button>
)}
                {booth.status === 'blocked' && (
  <button
    className="btn btn-outline btn-sm"
    onClick={() =>
      act(
        () => setBoothAvailabilityAPI(booth.id, 'available'),
        'Booth restored to available'
      )
    }
  >
    Restore Availability
  </button>
)}

<button
  className="btn btn-outline btn-sm"
  style={{ color: 'var(--red)' }}
  onClick={async () => {
    const approved = await confirm({
      title: `Delete booth ${booth.label}?`,
      message: 'This action cannot be undone. The booth will be permanently deleted.',
      confirmText: 'Delete',
      danger: true,
    });

    if (approved) {
      await act(
        () => deleteBooth(booth.id),
        'Booth deleted'
      );

      setSel(null);
    }
  }}
>
  <Trash2 size={15} /> Delete Booth
</button>
              </div>
              <p className="xs faint">{booth.visits || 0} visits recorded</p>
            </>
          ) : <EmptyState icon={Map} title="Select a booth" text="Click any booth on the plan to allocate, price or release it." />}
        </aside>
      </div>
      
    </>
  );
}

const blank = (expoId, date) => ({
  expoId,
  title: '',
  description: '',
  speakerId: '',
  room: ROOMS[0],
  date,
  start: '10:00',
  end: '11:00',
  type: 'Talk',
  capacity: 100,
});

export function AdminSchedule() {
  const toast = useToast();
  const confirm = useConfirm();
  const [expos, setExpos] = useState([]);
  const [speakers, setSpeakers] = useState([]);
  const [expoId, setExpoId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  const expo = expos.find((item) => item.id === expoId);
  const realtimeVersion = useExpoRealtimeVersion(expoId);
  const list = sessions.slice().sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const days = list.reduce((map, session) => ((map[session.date] = map[session.date] || []).push(session), map), {});

  useEffect(() => {
    let active = true;
    Promise.all([getExpos(), getSpeakers()])
      .then(([expoData, speakerData]) => {
        if (!active) return;
        const normalizedExpos = expoData.map(normalizeExpo);
        setExpos(normalizedExpos);
        setSpeakers(speakerData || []);
        const initial = normalizedExpos.find((item) => item.status === 'live') || normalizedExpos.find((item) => item.status === 'upcoming') || normalizedExpos[0];
        if (initial) setExpoId(initial.id);
      })
      .catch((error) => toast.error('Could not load schedule setup', error.message))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const loadSessions = async () => {
    if (!expoId) { setSessions([]); return; }
    try {
      setLoading(true);
      const data = await getExpoSessions(expoId, true);
      setSessions(data.map((session) => normalizeSession({
        ...session,
        expo: { ...(typeof session.expo === 'object' ? session.expo : {}), timezone: expo?.timezone || 'Asia/Karachi' },
      })).filter((session) => session.status !== 'cancelled'));
    } catch (error) {
      toast.error('Could not load sessions', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadSessions(); }, [expoId, realtimeVersion]);

  const set = (key) => (event) => setEdit((current) => ({ ...current, [key]: event.target.value }));

  const save = async () => {
    if (!edit || saving) return;
    setSaving(true);
    setErr('');
    try {
      if (!edit.title.trim() || !edit.description.trim()) throw new Error('Session title and description are required.');
      if (!edit.date || !edit.start || !edit.end || edit.end <= edit.start) throw new Error('Choose a valid date and make sure the end time is after the start time.');
      if (edit.date < expo.startDate || edit.date > expo.endDate) throw new Error('Session date must be within the Expo dates.');
      const conflicting = sessions.find((session) => {
        if (String(session.id) === String(edit.id || '') || session.date !== edit.date) return false;
        const overlaps = edit.start < session.end && edit.end > session.start;
        if (!overlaps) return false;
        const sameRoom = session.room?.trim().toLowerCase() === edit.room.trim().toLowerCase();
        const sameSpeaker = Boolean(edit.speakerId) && (session.speakers || []).some((speaker) => String(speaker?._id || speaker) === String(edit.speakerId));
        return sameRoom || sameSpeaker;
      });
      if (conflicting) {
        const reason = conflicting.room?.trim().toLowerCase() === edit.room.trim().toLowerCase() ? `Room ${edit.room} is already booked` : 'The selected speaker already has another session';
        throw new Error(`${reason} during ${conflicting.start}–${conflicting.end}.`);
      }
      const timezone = expo.timezone || 'Asia/Karachi';
      const startTime = zonedDateTimeToISO(edit.date, edit.start, timezone);
      const endTime = zonedDateTimeToISO(edit.date, edit.end, timezone);
      const payload = {
        expo: expoId,
        title: edit.title.trim(),
        description: edit.description.trim(),
        category: edit.type,
        speakers: edit.speakerId ? [edit.speakerId] : [],
        room: edit.room,
        startTime,
        endTime,
        capacity: Number(edit.capacity),
        status: 'published',
      };
      if (edit.id) await updateSessionApi(edit.id, payload);
      else await createSessionApi(payload);
      toast.success(edit.id ? 'Session updated' : 'Session created', 'Your changes have been saved to the database.');
      setEdit(null);
      await loadSessions();
    } catch (error) {
      setErr(error.message || 'Unable to save session.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (session) => setEdit({
    id: session.id,
    expoId,
    title: session.title,
    description: session.description || '',
    speakerId: session.speakers?.[0]?._id || '',
    room: session.room,
    date: session.date,
    start: session.start,
    end: session.end,
    type: session.type,
    capacity: session.capacity,
  });

  const handleDelete = async (session) => {
    const approved = await confirm({
      title: 'Cancel this session?',
      message: 'Attendees will be notified. Registration history will be preserved.',
      danger: true,
      confirmText: 'Cancel session',
    });
    if (!approved) return;
    try {
      await deleteSessionApi(session.id);
      toast.success('Session cancelled', 'Registered attendees have been notified.');
      await loadSessions();
    } catch (error) {
      toast.error('Could not cancel session', error.message);
    }
  };

  if (!expoId || !expo) return <div className="card card-pad">{loading ? 'Loading Expo data…' : 'No Expos available for schedule management.'}</div>;

  return (
    <>
      <PageHeader title="Schedule management" subtitle="Create and manage persistent sessions. Registered attendees receive notifications when schedules change or sessions are cancelled."
        actions={<><ExpoPicker value={expoId} onChange={setExpoId} expos={expos} /><button className="btn btn-primary" onClick={() => { setEdit(blank(expoId, expo.startDate)); setErr(''); }}><Plus size={17} /> Add session</button></>} />
      {loading && <p className="muted">Loading sessions…</p>}
      {list.length ? (
        <div className="stack-lg">
          {Object.entries(days).map(([date, items], index) => (
            <section key={date}>
              <h2 className="day-head"><span>Day {index + 1}</span> {fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
              <div className="card card-flush"><div className="table-wrap"><table className="table">
                <thead><tr><th>Time</th><th>Session</th><th>Speaker</th><th>Room</th><th>Seats</th><th /></tr></thead>
                <tbody>{items.map((session) => {
                  const taken = session.registeredCount || 0;
                  return <tr key={session.id}>
                    <td className="nowrap mono small">{fmtTime(session.start)}–{fmtTime(session.end)}</td>
                    <td><strong>{session.title}</strong><br /><Badge tone="neutral">{session.type}</Badge></td>
                    <td><Mic2 size={13} /> {session.speaker}<br /><small className="faint">{session.speakerRole}</small></td>
                    <td>{session.room}</td>
                    <td className="nowrap small">{taken}/{session.capacity}</td>
                    <td className="right nowrap"><button className="icon-btn" aria-label="Edit session" onClick={() => openEdit(session)}><Pencil size={17} /></button><button className="icon-btn" aria-label="Cancel session" onClick={() => handleDelete(session)}><Trash2 size={17} /></button></td>
                  </tr>;
                })}</tbody>
              </table></div></div>
            </section>
          ))}
        </div>
      ) : !loading ? <div className="card"><EmptyState icon={CalendarX} title="No sessions yet" text="Add the first session to start building the programme." action={<button className="btn btn-primary" onClick={() => setEdit(blank(expoId, expo.startDate))}>Add session</button>} /></div> : null}
      <Modal open={!!edit} onClose={() => !saving && setEdit(null)} size="lg" title={edit?.id ? 'Edit session' : 'Add session'} subtitle={expo?.title}
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)} disabled={saving}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : edit?.id ? 'Save changes' : 'Add session'}</button></>}>
        {edit && <div className="form-grid">
          {err && <div className="alert alert-error full" role="alert">{err}</div>}
          <Field label="Title" required className="full">{(id) => <input id={id} className="input" value={edit.title} onChange={set('title')} />}</Field>
          <Field label="Speaker">{(id) => <select id={id} className="select" value={edit.speakerId} onChange={set('speakerId')}><option value="">No speaker assigned</option>{speakers.map((speaker) => <option key={speaker._id} value={speaker._id}>{speaker.name} {speaker.designation ? `· ${speaker.designation}` : ''}</option>)}</select>}</Field>
          <Field label="Type">{(id) => <select id={id} className="select" value={edit.type} onChange={set('type')}>{SESSION_TYPES.map((type) => <option key={type}>{type}</option>)}</select>}</Field>
          <Field label="Location / room">{(id) => <select id={id} className="select" value={edit.room} onChange={set('room')}>{ROOMS.map((room) => <option key={room}>{room}</option>)}</select>}</Field>
          <Field label="Capacity">{(id) => <input id={id} className="input" type="number" min="1" value={edit.capacity} onChange={set('capacity')} />}</Field>
          <Field label="Date" required>{(id) => <input id={id} className="input" type="date" min={expo.startDate} max={expo.endDate} value={edit.date} onChange={set('date')} />}</Field>
          <Field label="Start" required>{(id) => <input id={id} className="input" type="time" value={edit.start} onChange={set('start')} />}</Field>
          <Field label="End" required>{(id) => <input id={id} className="input" type="time" value={edit.end} onChange={set('end')} />}</Field>
          <Field label="Description" required className="full">{(id) => <textarea id={id} className="textarea" value={edit.description} onChange={set('description')} />}</Field>
        </div>}
      </Modal>
    </>
  );
}
