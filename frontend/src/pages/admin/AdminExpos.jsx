import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ClipboardCheck, Eye, FileText, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../context/UIContext';
import { ExpoCard } from '../../components/Cards';
import { Avatar, Badge, EmptyState, Field, Modal, PageHeader, SearchBox, StatusBadge, Tabs } from '../../components/ui';
import {
  decideApplication,
  getExpos,
  createExpo,
  updateExpo,
  removeExpo,
  getAllApplications,
approveExhibitorApplication,
rejectExhibitorApplication,
  uploadImage,
  getExpoStats,
} from '../../lib/api';
import { boothsOf, expoById, expoStats } from '../../lib/selectors';
import { CATEGORIES } from '../../lib/seed';
import { addDays, fmtDate, fmtRange, money, timeAgo } from '../../lib/utils';
import { useExpoRealtimeVersion } from '../../hooks/useExpoRealtimeVersion';

const toFrontendExpo = (expo) => {
  const venue = expo.location?.venue || '';
  const city = expo.location?.city || '';

  const statusMap = {
    draft: 'draft',
    published: 'upcoming',
    ongoing: 'live',
    completed: 'completed',
  };

  return {
    ...expo,
    id: expo._id,
    location: venue,
    address: expo.location?.address || '',
    city,
    country: expo.location?.country || 'Pakistan',
    registrationDeadline: expo.registrationDeadline ? String(expo.registrationDeadline).slice(0, 10) : '',
    status: statusMap[expo.status] || expo.status,
    startDate: String(expo.startDate).slice(0, 10),
    endDate: String(expo.endDate).slice(0, 10),
    ticketPrice: expo.ticketPrice ?? 0,
    tags: expo.tags ?? [],
    floorPlan: { width: 1000, height: 700, backgroundImage: '', ...(expo.floorPlan || {}) },
  };
};

const toBackendExpo = (expo) => {
  const statusMap = {
    draft: 'draft',
    upcoming: 'published',
    live: 'ongoing',
    completed: 'completed',
  };

  return {
    title: expo.title,
    theme: expo.theme,
    category: expo.category,
    description: expo.description,
    banner: expo.banner || '',
    floorPlan: {
      width: Number(expo.floorPlan?.width || 1000),
      height: Number(expo.floorPlan?.height || 700),
      backgroundImage: String(expo.floorPlan?.backgroundImage || '').trim(),
    },
    startDate: expo.startDate,
    endDate: expo.endDate,
    startTime: expo.startTime || '09:00',
    endTime: expo.endTime || '18:00',
    timezone: (expo.timezone || 'Asia/Karachi').trim(),
    location: {
      venue: String(expo.location || '').trim(),
      address: String(expo.address || '').trim(),
      city: String(expo.city || '').trim(),
      country: String(expo.country || 'Pakistan').trim(),
    },
    registrationDeadline: expo.registrationDeadline || null,
    capacity: Number(expo.capacity),
    ticketPrice: Number(expo.ticketPrice ?? 0),
    currency: expo.currency || 'PKR',
    tags: Array.isArray(expo.tags) ? expo.tags : String(expo.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
    status: statusMap[expo.status] || 'draft',
  };
};

const blank = () => ({ title: '', theme: '', category: 'Technology', status: 'draft', startDate: addDays(30), endDate: addDays(32), startTime: '09:00', endTime: '18:00', timezone: 'Asia/Karachi', location: '', address: '', city: '', country: 'Pakistan', registrationDeadline: '', description: '', banner: '', floorPlan: { width: 1000, height: 700, backgroundImage: '' }, capacity: 1000, ticketPrice: 0, currency: 'PKR', tags: '' });

export function AdminExpos() {
  const { user, db } = useAuth();
  const realtimeVersion = useExpoRealtimeVersion();

    const [expos, setExpos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expoStatsById, setExpoStatsById] = useState({});

  const loadExpos = async () => {
    try {
      const data = await getExpos();
      const normalized = data.map(toFrontendExpo);
      setExpos(normalized);
      const statsResults = await Promise.allSettled(normalized.map((expo) => getExpoStats(expo.id)));
      setExpoStatsById(Object.fromEntries(normalized.map((expo, index) => [
        expo.id,
        statsResults[index].status === 'fulfilled' ? statsResults[index].value : null,
      ])));
    } catch (error) {
      toast.error('Could not load expos', error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpos();
  }, [realtimeVersion]);

  const toast = useToast();
  const confirm = useConfirm();
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [bannerUploading, setBannerUploading] = useState(false);
  const list = expos
  .filter((e) => !q || e.title.toLowerCase().includes(q.toLowerCase()))
  .sort((a, b) => b.startDate.localeCompare(a.startDate));
  const set = useCallback((key) => (event) => {
    const { value } = event.target;
    setEdit((current) => ({ ...current, [key]: value }));
  }, []);


  const handleBannerUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !edit) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErr('Choose a JPG, PNG or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr('Expo cover image must be 5 MB or smaller.');
      return;
    }

    setBannerUploading(true);
    setErr('');
    try {
      const imageUrl = await uploadImage(file);
      setEdit((current) => current ? { ...current, banner: imageUrl } : current);
      toast.success('Expo cover uploaded', 'Save the Expo to publish this cover image.');
    } catch (error) {
      setErr(error.message || 'Unable to upload the Expo cover image.');
    } finally {
      setBannerUploading(false);
    }
  };

  const save = async () => {
    if (bannerUploading) return;
    try {
      const payload = toBackendExpo(edit);

      if (!Number.isInteger(payload.ticketPrice) || payload.ticketPrice < 0) {
        setErr('Ticket price must be a non-negative whole number.');
        return;
      }
      if (
        !Number.isInteger(payload.floorPlan.width) || payload.floorPlan.width < 1 ||
        !Number.isInteger(payload.floorPlan.height) || payload.floorPlan.height < 1
      ) {
        setErr('Floor-plan width and height must be positive whole numbers.');
        return;
      }
      if (payload.floorPlan.backgroundImage) {
        try {
          const backgroundUrl = new URL(payload.floorPlan.backgroundImage);
          if (!['http:', 'https:'].includes(backgroundUrl.protocol)) throw new Error('Invalid protocol');
        } catch {
          setErr('Floor-plan background must be a valid HTTP or HTTPS URL.');
          return;
        }
      }

      if (edit.id) {
        await updateExpo(edit.id, payload);
        toast.success('Expo updated', edit.title);
      } else {
        await createExpo(payload);
        toast.success('Expo created', edit.title);
      }

      await loadExpos();
      setEdit(null);
      setErr('');
    } catch (e) {
      setErr(e.message);
    }
  };


  const del = async (e) => {
    if (
      await confirm({
        title: `Delete “${e.title}”?`,
        message: 'This removes its booths, sessions, applications and registrations permanently.',
        danger: true,
        confirmText: 'Delete expo',
      })
    ) {
      try {
        await removeExpo(e.id);
        await loadExpos();
        toast.success('Expo deleted');
      } catch (error) {
        toast.error('Could not delete expo', error.message);
      }
    }
  };


  return (
    <>
      <PageHeader title="Expos" subtitle="Create, edit and publish expo events." actions={<button className="btn btn-primary" onClick={() => { setEdit(blank()); setErr(''); }}><Plus size={17} /> New expo</button>} />
      <div className="toolbar"><SearchBox value={q} onChange={setQ} placeholder="Search expos…" /></div>
      {loading ? (
  <p className="muted">Loading expos...</p>
) : (
  <div className="grid grid-auto">
        {list.map((e) => {
          const s = expoStatsById[e.id] || { registrations: 0, pendingApplications: 0, exhibitors: 0, available: 0, occupancy: 0 };
          return (
            <ExpoCard key={e.id} expo={e} db={db} footer={
              <div className="row between">
                <span className="xs muted">{s.registrations} reg · {s.pendingApplications ?? '—'} pending apps · {money(e.ticketPrice)}</span>
                <div className="row gap-sm">
                  <button className="icon-btn" aria-label={`Edit ${e.title}`} onClick={() => { setEdit({ ...e, tags: (e.tags || []).join(', ') }); setErr(''); }}><Pencil size={17} /></button>
                  <button className="icon-btn" aria-label={`Delete ${e.title}`} onClick={() => del(e)}><Trash2 size={17} /></button>
                </div>
              </div>} />
          );
        })}
      </div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} size="lg" title={edit?.id ? 'Edit expo' : 'Create expo'} subtitle="Details shown on the public expo page."
        footer={<><button className="btn btn-ghost" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn-primary" onClick={save} disabled={bannerUploading}>{edit?.id ? 'Save changes' : 'Create expo'}</button></>}>
        {edit && (
          <div className="form-grid">
            {err && <div className="alert alert-error full" role="alert">{err}</div>}
            <Field label="Title" required className="full">{(i) => <input id={i} className="input" value={edit.title} onChange={set('title')} placeholder="e.g. TechNova Expo 2027" />}</Field>
            <Field label="Theme" className="full">{(i) => <input id={i} className="input" value={edit.theme} onChange={set('theme')} />}</Field>
            <Field label="Category">{(i) => <select id={i} className="select" value={edit.category} onChange={set('category')}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>}</Field>
            <Field label="Status" hint="Drafts are hidden from the public.">{(i) => <select id={i} className="select" value={edit.status} onChange={set('status')}>{['draft', 'upcoming', 'live', 'completed'].map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}</select>}</Field>
            <Field label="Start date" required>{(i) => <input id={i} className="input" type="date" value={edit.startDate} onChange={set('startDate')} />}</Field>
            <Field label="End date" required>{(i) => <input id={i} className="input" type="date" value={edit.endDate} onChange={set('endDate')} />}</Field>
            <Field label="Daily opening time" required hint="Local time at the Expo venue.">{(i) => <input id={i} className="input" type="time" value={edit.startTime || '09:00'} onChange={set('startTime')} />}</Field>
            <Field label="Daily closing time" required hint="Must be after opening time.">{(i) => <input id={i} className="input" type="time" value={edit.endTime || '18:00'} onChange={set('endTime')} />}</Field>
            <Field label="Expo timezone" required hint="Use an IANA timezone, e.g. Asia/Karachi." className="full">{(i) => <><input id={i} className="input" list="expo-timezones" value={edit.timezone || 'Asia/Karachi'} onChange={set('timezone')} placeholder="Asia/Karachi" /><datalist id="expo-timezones"><option value="Asia/Karachi" /><option value="Asia/Dubai" /><option value="Asia/Kolkata" /><option value="Europe/London" /><option value="Europe/Paris" /><option value="America/New_York" /><option value="America/Los_Angeles" /><option value="UTC" /></datalist></>}</Field>
            <div className="full"><h3>Floor-plan settings</h3><p className="muted small">These settings are saved with the Expo and used by the booth floor-plan view.</p></div>
            <Field label="Floor-plan width" hint="Canvas width in pixels">{(i) => <input id={i} className="input" type="number" min="1" value={edit.floorPlan?.width ?? 1000} onChange={(event) => setEdit((current) => ({ ...current, floorPlan: { ...(current.floorPlan || {}), width: event.target.value } }))} />}</Field>
            <Field label="Floor-plan height" hint="Canvas height in pixels">{(i) => <input id={i} className="input" type="number" min="1" value={edit.floorPlan?.height ?? 700} onChange={(event) => setEdit((current) => ({ ...current, floorPlan: { ...(current.floorPlan || {}), height: event.target.value } }))} />}</Field>
            <Field label="Floor-plan background image URL" hint="Optional hosted image URL" className="full">{(i) => <input id={i} className="input" type="url" value={edit.floorPlan?.backgroundImage || ''} onChange={(event) => setEdit((current) => ({ ...current, floorPlan: { ...(current.floorPlan || {}), backgroundImage: event.target.value } }))} placeholder="https://example.com/floor-plan.png" />}</Field>
            {edit.floorPlan?.backgroundImage && <div className="full"><img src={edit.floorPlan.backgroundImage} alt="Floor-plan background preview" style={{ maxWidth: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 8 }} /></div>}
            <Field label="Expo cover image" hint="Optional JPG, PNG or WebP image · maximum 5 MB" className="full">
              {(i) => <div className="stack-sm">
                <input id={i} className="input" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleBannerUpload} disabled={bannerUploading} />
                {bannerUploading && <p className="muted small">Uploading cover image…</p>}
                {edit.banner && <div className="row gap-md wrap" style={{ alignItems: 'center' }}>
                  <img src={edit.banner} alt="Expo cover preview" style={{ width: 180, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--line)' }} />
                  <button type="button" className="btn btn-sm btn-outline" onClick={() => setEdit((current) => ({ ...current, banner: '' }))} disabled={bannerUploading}>Remove image</button>
                </div>}
              </div>}
            </Field>
            <Field label="Venue name" required>{(i) => <input id={i} className="input" value={edit.location} onChange={set('location')} placeholder="Karachi Expo Centre" />}</Field>
            <Field label="City" required>{(i) => <input id={i} className="input" value={edit.city || ''} onChange={set('city')} placeholder="Karachi" />}</Field>
            <Field label="Street / venue address" className="full">{(i) => <input id={i} className="input" value={edit.address || ''} onChange={set('address')} placeholder="University Road" />}</Field>
            <Field label="Country" required>{(i) => <input id={i} className="input" value={edit.country || 'Pakistan'} onChange={set('country')} />}</Field>
            <Field label="Registration deadline" hint="Must be on or before the Expo start date.">{(i) => <input id={i} className="input" type="date" max={edit.startDate} value={edit.registrationDeadline || ''} onChange={set('registrationDeadline')} />}</Field>
            <Field label="Capacity">{(i) => <input id={i} className="input" type="number" min="0" value={edit.capacity} onChange={set('capacity')} />}</Field>
            <Field label="Base ticket price (PKR)">{(i) => <input id={i} className="input" type="number" min="0" value={edit.ticketPrice} onChange={set('ticketPrice')} />}</Field>
            <Field label="Tags" hint="Comma separated" className="full">{(i) => <input id={i} className="input" value={edit.tags} onChange={set('tags')} />}</Field>
            <Field label="Description" className="full">{(i) => <textarea id={i} className="textarea" value={edit.description} onChange={set('description')} />}</Field>
          </div>
        )}
      </Modal>
    </>
  );
}


export function AdminApplications() {
  const toast = useToast();

  const [tab, setTab] = useState('pending');
  const [expo, setExpo] = useState('');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(null);
  const [remarks, setRemarks] = useState('');

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadApplications = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await getAllApplications({ limit: 100 });

        if (active) {
          setApplications(data.applications || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load applications.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadApplications();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const expoOptions = [
    ...new Map(
      applications
        .filter((a) => a.expo)
        .map((a) => [a.expo._id, a.expo])
    ).values(),
  ];

  const counts = (status) =>
    applications.filter((a) => a.status === status).length;

  const list = applications.filter((a) => {
    const company = a.exhibitorProfile?.companyName || '';
    const industry = a.exhibitorProfile?.industry || '';
    const exhibitorName = a.exhibitor?.name || '';
    const exhibitorEmail = a.exhibitor?.email || '';

    const matchesTab = tab === 'all' || a.status === tab;
    const matchesExpo = !expo || a.expo?._id === expo;

    const searchText =
      `${company} ${industry} ${exhibitorName} ${exhibitorEmail}`.toLowerCase();

    const matchesSearch =
      !q || searchText.includes(q.toLowerCase());

    return matchesTab && matchesExpo && matchesSearch;
  }).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const app = applications.find((a) => a._id === sel);

  const decide = async (status) => {
    if (!app || actionLoading) return;

    if (status === 'rejected' && !remarks.trim()) {
      toast.error('Rejection remarks are required.');
      return;
    }

    try {
      setActionLoading(true);

      if (status === 'approved') {
        await approveExhibitorApplication(app._id);
      } else {
        await rejectExhibitorApplication(app._id, remarks.trim());
      }

      toast.success(
        `Application ${status}`,
        `${app.exhibitorProfile?.companyName || 'Company'} has been notified.`
      );

      setSel(null);
      setRemarks('');
      setReloadKey((key) => key + 1);
    } catch (err) {
      toast.error(err.message || `Unable to ${status} application.`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Exhibitor applications"
        subtitle="Review company details and submitted documents."
      />

      <div className="card card-flush">
        <div style={{ padding: '0 14px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'pending', label: 'Pending', count: counts('pending') },
              { key: 'approved', label: 'Approved', count: counts('approved') },
              { key: 'rejected', label: 'Rejected', count: counts('rejected') },
              { key: 'all', label: 'All', count: applications.length },
            ]}
          />
        </div>

        <div className="toolbar" style={{ padding: '14px 18px 0' }}>
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search company or exhibitor..."
          />

          <select
            className="select"
            value={expo}
            onChange={(e) => setExpo(e.target.value)}
            aria-label="Filter by expo"
          >
            <option value="">All expos</option>
            {expoOptions.map((e) => (
              <option key={e._id} value={e._id}>
                {e.title}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading applications...</p>
          </div>
        ) : error ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Unable to load applications"
            text={error}
          />
        ) : list.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Expo</th>
                  <th>Booth Size</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {list.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <div className="cell-user">
                        <Avatar
                          user={{
                            name: a.exhibitorProfile?.companyName || 'Company',
                            avatar: a.exhibitorProfile?.logo,
                          }}
                          size={38}
                          square
                        />
                        <div>
                          <strong>
                            {a.exhibitorProfile?.companyName || 'Unknown company'}
                          </strong>
                          <small>
                            {a.exhibitorProfile?.industry || '—'}
                          </small>
                        </div>
                      </div>
                    </td>

                    <td>{a.expo?.title || '—'}</td>
                    <td className="mono">
                      {a.preferredBoothSize || '—'}
                    </td>
                    <td className="muted">
                      {a.createdAt
                        ? timeAgo(a.createdAt)
                        : '—'}
                    </td>
                    <td>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="right">
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => {
                          setSel(a._id);
                          setRemarks('');
                        }}
                      >
                        <Eye size={15} /> Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={ClipboardCheck}
            title="Nothing in this view"
            text="No applications match the current filters."
          />
        )}
      </div>

      <Modal
        open={!!app}
        onClose={() => {
          if (!actionLoading) {
            setSel(null);
            setRemarks('');
          }
        }}
        size="lg"
        title={app?.exhibitorProfile?.companyName || 'Application'}
        subtitle={app?.expo?.title || ''}
        footer={
          app?.status === 'pending' ? (
            <>
              <button
                className="btn btn-soft-danger"
                disabled={actionLoading}
                onClick={() => decide('rejected')}
              >
                <X size={16} />
                {actionLoading ? 'Please wait...' : 'Reject'}
              </button>

              <button
                className="btn btn-primary"
                disabled={actionLoading}
                onClick={() => decide('approved')}
              >
                <Check size={16} />
                {actionLoading ? 'Please wait...' : 'Approve'}
              </button>
            </>
          ) : null
        }
      >
        {app && (
          <div className="stack">
            <div className="row gap-sm">
              <StatusBadge status={app.status} />
              <Badge>
                {app.exhibitorProfile?.industry || 'Industry not specified'}
              </Badge>
              <Badge>
                Preferred size {app.preferredBoothSize}
              </Badge>
            </div>

            <dl className="facts two">
              <div>
                <dt>Contact person</dt>
                <dd>{app.exhibitor?.name || '—'}</dd>
              </div>

              <div>
                <dt>Email</dt>
                <dd>{app.exhibitor?.email || '—'}</dd>
              </div>

              <div>
                <dt>Phone</dt>
                <dd>{app.exhibitorProfile?.contactPhone || '—'}</dd>
              </div>

              <div>
                <dt>Submitted</dt>
                <dd>
                  {app.createdAt
                    ? fmtDate(String(app.createdAt).slice(0, 10))
                    : '—'}
                </dd>
              </div>
            </dl>

            <div>
              <span className="label">Documents</span>

              {app.documents?.length ? (
                <ul className="docs">
                  {app.documents.map((doc, index) => (
                    <li key={`${doc.name}-${index}`}>
                      <FileText size={16} />
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {doc.name}
                      </a>
                      <em>{doc.fileType}</em>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No documents submitted.</p>
              )}
            </div>

            {app.status === 'pending' && (
              <div>
                <Field label="Remarks (required when rejecting)">
                  {(id) => (
                    <input
                      id={id}
                      className="input"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter admin remarks..."
                    />
                  )}
                </Field>
              </div>
            )}

            {app.remarks && (
              <div className="alert alert-warning">
                Admin remarks: {app.remarks}
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

