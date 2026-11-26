import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, FileText, Handshake, IdCard, LayoutGrid, Map, MessageSquare, Paperclip, Plus, Save, Store, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../context/UIContext';
import FloorPlan, { PlanLegend } from '../../components/FloorPlan';
import { Avatar, Badge, EmptyState, Field, Modal, PageHeader, StatCard, StatusBadge } from '../../components/ui';
import { CATEGORIES } from "../../lib/seed";

import {
  apiRequest,
  getPublishedExpos,
  getMyExhibitorProfile,
  getMyApplications,
  createExhibitorProfile,
  updateMyExhibitorProfile,
  getBooths,
  reserveBoothApi,
  releaseBoothApi,
  getMyShowcase,
  saveShowcase,
  sendMessage,
  withdrawApplication,
  uploadImage,
  uploadApplicationDocuments
} from '../../lib/api';

import { useExpoRealtimeVersion } from '../../hooks/useExpoRealtimeVersion';
import { fmtRange, money, uid } from '../../lib/utils';
import { findNeighborBooths } from '../../lib/exhibitorNeighbors';

/* ---------- Find expos + apply ---------- */

export function FindExpos() {
  const { user } = useAuth();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();

  const applyId = sp.get('apply');
  const realtimeVersion = useExpoRealtimeVersion();

  const [expos, setExpos] = useState([]);
  const [applications, setApplications] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedExpo, setSelectedExpo] = useState(null);
  const [boothSize, setBoothSize] = useState('M');
  const [submitting, setSubmitting] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
const [uploadingDocuments, setUploadingDocuments] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadExpos() {
      try {
        setLoading(true);
        setError('');

        const [expoResult, applicationResult, profileResult] = await Promise.allSettled([
          getPublishedExpos(),
          getMyApplications(),
          getMyExhibitorProfile(),
        ]);

        if (!active) return;
        if (expoResult.status === 'rejected') throw expoResult.reason;
        setExpos(expoResult.value || []);
        setApplications(applicationResult.status === 'fulfilled' ? applicationResult.value || [] : []);
        setCompanyProfile(profileResult.status === 'fulfilled' ? profileResult.value : null);
        setProfileLoadFailed(profileResult.status === 'rejected');
        if (applicationResult.status === 'rejected' || profileResult.status === 'rejected') {
          setError('Some exhibitor information could not be loaded. You can still browse expos; refresh before applying.');
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load expos.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadExpos();

    return () => {
      active = false;
    };
  }, [realtimeVersion, user?.id]);

  useEffect(() => {
    if (!applyId || !expos.length) return;

    const found = expos.find(
      (expo) => String(expo._id || expo.id) === String(applyId)
    );

    if (found) {
      const existingApplication = applications.find((application) =>
        String(application.expo?._id || application.expo?.id || application.expo) === String(applyId)
      );
      if (existingApplication) {
        setSelectedExpo(null);
        setError(`You have already submitted an application for ${found.title || found.name || 'this Expo'}. Check My applications for its status.`);
        setSp({});
      } else {
        setSelectedExpo(found);
      }
    }
  }, [applyId, expos, applications, setSp]);

  const closeApplication = () => {
    setSelectedExpo(null);
    setSp({});
    setError('');
    setSelectedDocuments([]);
  };


const submitApplication = async (e) => {
  e.preventDefault();

  if (!selectedExpo) return;
  if (profileLoadFailed) {
    setError('We could not verify your company profile. Open Company profile or refresh this page, then try again.');
    return;
  }
  if (!companyProfile?._id) {
    setError('Create your company profile before submitting an exhibitor application.');
    return;
  }

  try {
    setSubmitting(true);
    setError('');

    let uploadedDocuments = [];

    if (selectedDocuments.length > 0) {
      setUploadingDocuments(true);
      uploadedDocuments = await uploadApplicationDocuments(selectedDocuments);
      setUploadingDocuments(false);
    }

    const expoId = selectedExpo._id || selectedExpo.id;

    const response = await apiRequest(
      `/api/expos/${expoId}/applications`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredBoothSize: boothSize,
          documents: uploadedDocuments,
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'Application failed.');
    }

    toast.success(
      'Application submitted',
      'Your expo application has been submitted successfully.'
    );
    if (result.application) setApplications((current) => [...current, result.application]);
    else {
      const refreshed = await getMyApplications();
      setApplications(refreshed || []);
    }

    setSelectedDocuments([]);
    closeApplication();
  } catch (err) {
    setError(err.message || 'Unable to submit application.');
  } finally {
    setSubmitting(false);
    setUploadingDocuments(false);
  }
};


  if (loading) {
    return (
      <div className="page-loading">
        <p>Loading available expos...</p>
      </div>
    );
  }

  return (
    <section className="page-section">
      <PageHeader
        title="Find Expos"
        subtitle="Explore published expos and apply for a booth."
      />

      {error && !selectedExpo && (
        <div className="alert alert-error">{error}</div>
      )}

      {profileLoadFailed && expos.length > 0 && (
        <div className="alert alert-error" role="alert">
          We could not verify your company profile. <Link to="/dashboard/profile">Open Company profile</Link> or refresh this page.
        </div>
      )}

      {!profileLoadFailed && !companyProfile && expos.length > 0 && (
        <div className="alert alert-info" role="status" style={{ marginBottom: 18 }}>
          <div>
            <strong>Complete your company profile first.</strong> An exhibitor profile is required before an application can be submitted.
            {' '}<Link to="/dashboard/profile">Create company profile</Link>.
          </div>
        </div>
      )}

      {!expos.length ? (
        <EmptyState
          title="No expos available"
          description="There are currently no published expos available."
        />
      ) : (
        <div className="expo-grid">
          {expos.map((expo) => {
            const id = expo._id || expo.id;
            const title = expo.title || expo.name || 'Untitled Expo';
            const existingApplication = applications.find((application) =>
              String(application.expo?._id || application.expo?.id || application.expo) === String(id)
            );

            return (
              <article className="card expo-card" key={id}>
                <div className="expo-card-body">
                  <h3>{title}</h3>

                  <p>{expo.description || 'Explore this upcoming expo.'}</p>

                  <p>
                    <strong>Date:</strong>{' '}
                    {expo.startDate
                      ? fmtRange(expo.startDate, expo.endDate)
                      : 'Date not available'}
                  </p>

                  <p>
                    <strong>Location:</strong>{' '}
                    {typeof expo.location === 'string'
                      ? expo.location
                      : expo.location?.venue || expo.location?.address || 'Not specified'}
                  </p>

                  <div className="row wrap gap-sm">
                    <Link className="btn btn-outline" to={`/expos/${id}`}>View expo</Link>
                    {existingApplication ? (
                      <Link className="btn btn-primary" to="/dashboard/applications">
                        Application: {existingApplication.status || 'Submitted'}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setSelectedExpo(expo);
                          setError('');
                        }}
                      >
                        <Store size={16} /> Apply for Booth
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedExpo && (
       <Modal
  open={!!selectedExpo}
  title={`Apply for ${selectedExpo.title || selectedExpo.name || 'Expo'}`}
  onClose={closeApplication}
>
          <form onSubmit={submitApplication}>
            <Field label="Preferred booth size">
              <select
                value={boothSize}
                onChange={(e) => setBoothSize(e.target.value)}
                required
              >
                <option value="S">Small</option>
                <option value="M">Medium</option>
                <option value="L">Large</option>
              </select>
            </Field>


<Field label="Supporting documents (optional)">
  <input
    type="file"
    accept=".pdf,.jpg,.jpeg,.png,.webp"
    multiple
    onChange={(e) => {
      const files = Array.from(e.target.files);

      if (files.length > 5) {
        setError('You can upload a maximum of 5 documents.');
        e.target.value = '';
        return;
      }

      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
      ];

      const invalidFile = files.find(
        (file) =>
          !allowedTypes.includes(file.type) ||
          file.size > 5 * 1024 * 1024
      );

      if (invalidFile) {
        setError('Use PDF, JPG, PNG or WEBP files. Maximum size is 5 MB per file.');
        e.target.value = '';
        return;
      }

      setError('');
      setSelectedDocuments(files);
    }}
  />

  {selectedDocuments.length > 0 && (
    <div>
      {selectedDocuments.map((file, index) => (
        <p key={`${file.name}-${index}`}>
          <FileText size={14} /> {file.name}
        </p>
      ))}
    </div>
  )}
</Field>


            {profileLoadFailed ? (
              <div className="alert alert-error" role="alert">Company profile could not be checked. Please refresh or open <Link to="/dashboard/profile" onClick={closeApplication}>Company profile</Link>.</div>
            ) : !companyProfile && (
              <div className="alert alert-warning" role="alert">
                Your company profile is missing. <Link to="/dashboard/profile" onClick={closeApplication}>Create your company profile</Link> before applying.
              </div>
            )}

            {error && (
              <div className="alert alert-error">{error}</div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeApplication}
                disabled={submitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting || profileLoadFailed || !companyProfile?._id}
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}


/* ---------- My applications ---------- */


export function MyApplications() {
  const realtimeVersion = useExpoRealtimeVersion();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedApplication, setSelectedApplication] = useState(null);

  useEffect(() => {
    let active = true;

    async function loadApplications() {
      try {
        setLoading(true);
        setError('');

        const data = await getMyApplications();

        if (active) setApps(data);
      } catch (err) {
        if (active) {
          setError(err.message || 'Unable to load applications.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadApplications();

    return () => {
      active = false;
    };
  }, [realtimeVersion]);

  if (loading) {
    return <div className="page-loading">Loading applications...</div>;
  }

  return (
    <>
      <PageHeader
        title="My applications"
        subtitle="Track the status of every expo you've applied to."
        actions={
          <Link className="btn btn-primary" to="/dashboard/expos">
            <Plus size={16} /> New application
          </Link>
        }
      />

      {error && <div className="alert alert-error">{error}</div>}

      {apps.length > 0 ? (
        <div className="stack">
          {apps.map((a) => {
            const expo = a.expo;

            return (
              <div key={a._id} className="card card-pad app-row">
                <div className="grow">
                  <div className="row gap-sm wrap">
                    <h3>{expo?.title || 'Expo unavailable'}</h3>
                    <StatusBadge status={a.status} />
                  </div>

                  <p className="small muted">
                    {expo?.startDate && expo?.endDate
                      ? fmtRange(expo.startDate, expo.endDate)
                      : 'Dates unavailable'}
                    {' · '}
                    {typeof expo?.location === 'string'
                      ? expo.location
                      : expo?.location?.venue ||
                        expo?.location?.address ||
                        'Location unavailable'}
                  </p>

                  <p className="small muted">
                    Preferred booth size: {a.preferredBoothSize || 'Not specified'}
                  </p>
                </div>

        <div className="app-booth">
  <span className="muted xs">Booth</span>

  {a.booth ? (
    <>
      <strong>{a.booth.boothNumber}</strong>
      <span className="muted small">Size: {a.booth.size}</span>
    </>
  ) : (
    <span className="muted small">Not assigned yet</span>
  )}
  <button type="button" className="btn btn-outline btn-sm" onClick={() => setSelectedApplication(a)}>View details</button>
</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={Store}
            title="No applications yet"
            text="Find an expo and submit your first application."
            action={
              <Link className="btn btn-primary" to="/dashboard/expos">
                Find expos
              </Link>
            }
          />
        </div>
      )}
      <Modal
        open={Boolean(selectedApplication)}
        onClose={() => setSelectedApplication(null)}
        title={selectedApplication?.expo?.title || 'Application details'}
        subtitle="Your submitted exhibitor application"
        size="md"
      >
        {selectedApplication && (
          <div className="stack">
            <div className="row between"><span className="muted small">Application status</span><StatusBadge status={selectedApplication.status} /></div>
            <div><span className="muted small">Submitted</span><p>{selectedApplication.createdAt ? new Date(selectedApplication.createdAt).toLocaleString() : 'Date unavailable'}</p></div>
            <div><span className="muted small">Expo dates</span><p>{selectedApplication.expo?.startDate && selectedApplication.expo?.endDate ? fmtRange(selectedApplication.expo.startDate, selectedApplication.expo.endDate) : 'Dates unavailable'}</p></div>
            <div><span className="muted small">Venue</span><p>{typeof selectedApplication.expo?.location === 'string' ? selectedApplication.expo.location : [selectedApplication.expo?.location?.venue, selectedApplication.expo?.location?.address, selectedApplication.expo?.location?.city].filter(Boolean).join(', ') || 'Location unavailable'}</p></div>
            <div><span className="muted small">Preferred booth size</span><p>{selectedApplication.preferredBoothSize || 'Not specified'}</p></div>
            <div><span className="muted small">Assigned booth</span><p>{selectedApplication.booth ? `${selectedApplication.booth.boothNumber} · ${selectedApplication.booth.size || 'Size not specified'} · ${selectedApplication.booth.status === 'occupied' ? 'Confirmed' : selectedApplication.booth.status === 'reserved' ? 'Reserved — awaiting confirmation' : selectedApplication.booth.status || 'Status unavailable'}` : 'Not assigned yet'}</p></div>
            {selectedApplication.remarks && <div className="alert alert-info"><strong>Organizer remarks</strong><p style={{ margin: '6px 0 0' }}>{selectedApplication.remarks}</p></div>}
            <div><span className="muted small">Submitted documents</span>{selectedApplication.documents?.length ? <ul className="list">{selectedApplication.documents.map((document, index) => <li key={`${document.fileUrl || document.name}-${index}`}><FileText size={16} /><span>{document.name || 'Application document'}</span></li>)}</ul> : <p>No documents attached.</p>}</div>
          </div>
        )}
      </Modal>
    </>
  );
}



/* ---------- Book a booth ---------- */

export function BookBooth() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [applications, setApplications] = useState([]);
  const [booths, setBooths] = useState([]);
  const [expoId, setExpoId] = useState('');
  const [sel, setSel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boothsLoading, setBoothsLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const realtimeVersion = useExpoRealtimeVersion(expoId);

  // Load exhibitor's approved applications
  useEffect(() => {
    const loadApplications = async () => {
      try {
        setLoading(true);
        setError('');

        const data = await getMyApplications();

        const approved = data.filter(
          (application) =>
            application.status === 'approved' &&
            application.expo &&
            application.expo._id
        );

        setApplications(approved);

        if (approved.length > 0) {
          setExpoId(String(approved[0].expo._id));
        }
      } catch (err) {
        setError(err.message || 'Unable to load applications.');
      } finally {
        setLoading(false);
      }
    };

    loadApplications();
  }, [realtimeVersion]);

  // Load booths whenever selected expo changes
  useEffect(() => {
    if (!expoId) {
      setBooths([]);
      return;
    }

    const loadBooths = async () => {
      try {
        setBoothsLoading(true);
        setError('');
        setSel(null);

        const data = await getBooths(expoId);
        setBooths(data || []);
      } catch (err) {
        setError(err.message || 'Unable to load booths.');
        setBooths([]);
      } finally {
        setBoothsLoading(false);
      }
    };

    loadBooths();
  }, [expoId, realtimeVersion]);

  const application = applications.find(
    (a) => String(a.expo._id) === String(expoId)
  );

  const expo = application?.expo;

  // Convert backend booth data into FloorPlan component format
  const rows = 5;
  const cols = 8;

  const floorBooths = booths.map((b, index) => {
    const x = b.position?.x ?? ((index % cols) / cols) * 100;
    const y = b.position?.y ?? (Math.floor(index / cols) / rows) * 100;

    const exhibitorId =
      b.exhibitor?._id || b.exhibitor || null;

    return {
      id: String(b._id),
      label: b.boothNumber,
      zone: 'Expo floor',
      size: b.size,
      price: b.price,
      status: b.status === 'occupied' ? 'booked' : b.status,
      position: b.position || undefined,
      row: Math.min(rows - 1, Math.floor(y / 100 * rows)),
      col: Math.min(cols - 1, Math.floor(x / 100 * cols)),
      exhibitorId: exhibitorId ? String(exhibitorId) : null,
    };
  });


  const floorUsers = booths
    .filter((b) => b.exhibitor && typeof b.exhibitor === 'object')
    .map((b) => ({
      id: String(b.exhibitor._id),
      name: b.exhibitor.name,
      company: b.exhibitor.company || '',
    }));

const currentUserId = String(user?._id || user?.id || '');

const mine = floorBooths.find(
  (b) => b.exhibitorId === currentUserId
);

const boothStatusCounts = {
  total: floorBooths.length,
  available: floorBooths.filter((b) => b.status === 'available').length,
  reserved: floorBooths.filter((b) => b.status === 'reserved').length,
  confirmed: floorBooths.filter((b) => b.status === 'booked').length,
};

  const booth = floorBooths.find(
    (b) => b.id === sel
  );

  // Reserve booth through backend
  const handleReserve = async () => {
    if (!booth) return;

    try {
      setBusy(true);

      await reserveBoothApi(booth.id);

      toast.success(`Booth ${booth.label} reserved`);

      setSel(null);

      const updated = await getBooths(expoId);
      setBooths(updated || []);
    } catch (err) {
      toast.error('Could not complete', err.message);
    } finally {
      setBusy(false);
    }
  };


// Release your own booth through backend
const handleRelease = async () => {
  if (!mine) return;

  const confirmed = await confirm({
    title: `Release booth ${mine.label}?`,
    message: 'It becomes available to other exhibitors.',
    danger: true,
    confirmText: 'Release',
  });

  if (!confirmed) return;

  try {
    setBusy(true);

    await releaseBoothApi(mine.id);

    toast.success('Booth released successfully');

    setSel(null);

    const updated = await getBooths(expoId);
    setBooths(updated || []);
  } catch (err) {
    toast.error('Could not complete', err.message);
  } finally {
    setBusy(false);
  }
};

  if (loading) {
    return (
      <>
        <PageHeader title="Book a booth" />
        <div className="card card-pad">
          <p>Loading your approved applications...</p>
        </div>
      </>
    );
  }

  if (error && applications.length === 0) {
    return (
      <>
        <PageHeader title="Book a booth" />
        <div className="card card-pad">
          <p className="hint">{error}</p>
        </div>
      </>
    );
  }

  if (!applications.length) {
    return (
      <>
        <PageHeader title="Book a booth" />
        <div className="card">
          <EmptyState
            icon={Map}
            title="No approved applications"
            text="Once an organizer approves your application you can pick a booth here."
            action={
              <Link className="btn btn-primary" to="/dashboard/expos">
                Find expos
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Book a booth"
        subtitle="Choose an available booth on the live floor plan. Taken booths update instantly."
        actions={
          <select
            className="select"
            value={expoId}
            onChange={(e) => {
              setExpoId(e.target.value);
              setSel(null);
            }}
            aria-label="Choose expo"
          >
            {applications.map((a) => (
              <option key={a._id} value={a.expo._id}>
                {a.expo.title}
              </option>
            ))}
          </select>
        }
      />

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      <div className="grid grid-4" style={{ marginBottom: 18 }}>
        <StatCard icon={LayoutGrid} label="Total booths" value={boothStatusCounts.total} />
        <StatCard icon={Store} label="Available" value={boothStatusCounts.available} tone="green" />
        <StatCard icon={Map} label="Reserved · awaiting confirmation" value={boothStatusCounts.reserved} tone="gold" />
        <StatCard icon={Handshake} label="Confirmed" value={boothStatusCounts.confirmed} tone="blue" />
      </div>

      {!boothsLoading && booths.length === 0 && (
        <div className="alert alert-info" role="status">
          No booths have been added to this Expo yet. Ask the organizer to add booth inventory before booking.
        </div>
      )}

      <div className="split">
        <div className="card card-pad">
          {boothsLoading ? (
            <p>Loading floor plan...</p>
          ) : (
            <>
              <FloorPlan
                booths={floorBooths}
                layout={{ rows: 5, cols: 8 }}
                users={floorUsers}
                userId={currentUserId}
                mode="select"
                selectedId={sel}
                onSelect={(b) => setSel(String(b.id))}
              />

              <PlanLegend
                items={[
                  'available',
                  'reserved',
                  'booked',
                  'blocked',
                  'mine',
                  'selected',
                ]}
              />
            </>
          )}
        </div>

        <aside className="card card-pad stack">
          {mine && (
            <div className="alert alert-success">
              <Store size={18} />
              <div>
                <strong>Your booth: {mine.label}</strong>
                <br />
                <span className="small">
                  {mine.status === 'reserved'
                    ? 'Awaiting organizer confirmation.'
                    : 'Confirmed.'}
                </span>


              </div>
            </div>
          )}

          {booth && booth.status === 'available' ? (
            <>
              <span className="eyebrow">{booth.zone}</span>

              <h3>Booth {booth.label}</h3>

              <dl className="facts">
                <div>
                  <dt>Size</dt>
                  <dd>{booth.size}</dd>
                </div>

                <div>
                  <dt>Price</dt>
                  <dd>
                    <strong>{money(booth.price)}</strong>
                  </dd>
                </div>

                <div>
                  <dt>Preferred size</dt>
                  <dd>
                    {application?.preferredBoothSize || 'Not specified'}
                  </dd>
                </div>
              </dl>

              <button
                className="btn btn-primary btn-lg"
                disabled={!!mine || busy}
                onClick={handleReserve}
              >
                {busy ? 'Processing...' : `Reserve booth ${booth.label}`}
              </button>

              {mine && (
                <p className="hint">
                  Release your current booth first to choose another.
                </p>
              )}
            </>
          ) : booth && booth.exhibitorId === currentUserId ? (
            <>
              <h3>Booth {booth.label}</h3>

              {booth.status === 'reserved' ? (
                <button
                  className="btn btn-outline"
                  disabled={busy}
                  onClick={handleRelease}
                >
                  {busy ? 'Processing...' : 'Release booth'}
                </button>
              ) : (
                <p className="hint">
                  Your booth is confirmed.
                </p>
              )}

              <Link
                to="/dashboard/showcase"
                className="btn btn-primary"
              >
                Set up showcase
              </Link>
            </>
          ) : (
            <EmptyState
              icon={Map}
              title={mine ? 'Your booth is highlighted' : 'Pick a booth'}
              text="Green booths are available. Reserved booths are awaiting organizer confirmation; confirmed booths are no longer selectable. Select an available booth to see its price and size."
            />
          )}
        </aside>
      </div>
    </>
  );
}



/* ---------- Booth showcase ---------- */
export function Showcase() {
  const { user } = useAuth();
  const toast = useToast();

  const [mine, setMine] = useState([]);
  const [id, setId] = useState('');
  const [f, setF] = useState(null);
  const [prod, setProd] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    const loadShowcase = async () => {
      try {
        setLoading(true);

        const booths = await getMyShowcase();

        if (!active) return;

        setMine(booths);

        if (booths.length) {
          setId(booths[0]._id);
        }
      } catch (error) {
        if (active) {
          toast.error(error.message || 'Unable to load booth showcase.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadShowcase();

    return () => {
      active = false;
    };
  }, []);

  const booth = mine.find((b) => b._id === id) || mine[0];

  useEffect(() => {
    if (!booth) {
      setF(null);
      return;
    }

    setF({
      tagline: booth.showcase?.tagline || user.tagline || '',
      offer: booth.showcase?.offer || '',
      hours: booth.showcase?.hours || '09:00 – 18:00',
      products: [...(booth.showcase?.products || [])],
      staff: (booth.showcase?.staff || []).map((person) => ({
        ...person,
        id: uid('st'),
      })),
    });
  }, [booth?._id]);

  const addProd = () => {
    if (prod.trim()) {
      setF((prev) => ({
        ...prev,
        products: [...prev.products, prod.trim()],
      }));
      setProd('');
    }
  };

  const setStaff = (i, k, v) => {
    setF((prev) => ({
      ...prev,
      staff: prev.staff.map((s, j) =>
        j === i ? { ...s, [k]: v } : s
      ),
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      await saveShowcase(booth._id, f);

      toast.success('Showcase saved successfully');
    } catch (error) {
      toast.error(error.message || 'Unable to save showcase.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Booth showcase" />
        <div className="card card-pad">
          <p className="muted">Loading your booth showcase...</p>
        </div>
      </>
    );
  }

  if (!mine.length) {
    return (
      <>
        <PageHeader title="Booth showcase" />
        <div className="card">
          <EmptyState
            icon={Store}
            title="No confirmed booth yet"
            text="Once your booth is confirmed you can manage what you showcase and who staffs it."
            action={
              <Link className="btn btn-primary" to="/dashboard/booth">
                Book a booth
              </Link>
            }
          />
        </div>
      </>
    );
  }

  if (!f || !booth) return null;

  const expo = booth.expo;
  const expoId = expo?._id;
  const expoTitle = expo?.title || expo?.name || 'Expo';
  const boothLabel = booth.boothNumber;

  return (
    <>
      <PageHeader
        title="Booth showcase"
        subtitle="What visitors see on your booth page: products, offers and the team they can meet."
        actions={
          <>
            {mine.length > 1 && (
              <select
                className="select"
                value={booth._id}
                onChange={(e) => setId(e.target.value)}
              >
                {mine.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.expo?.title || b.expo?.name || 'Expo'} · {b.boothNumber}
                  </option>
                ))}
              </select>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      />

      <div className="split">
        <div className="stack">
          <div className="card card-pad stack">
            <h3>Booth {boothLabel} · {expoTitle}</h3>

            <Field label="Tagline">
              {(i) => (
                <input
                  id={i}
                  className="input"
                  value={f.tagline}
                  onChange={(e) =>
                    setF({ ...f, tagline: e.target.value })
                  }
                />
              )}
            </Field>

            <div className="form-grid">
              <Field label="Show special / offer">
                {(i) => (
                  <input
                    id={i}
                    className="input"
                    value={f.offer}
                    onChange={(e) =>
                      setF({ ...f, offer: e.target.value })
                    }
                    placeholder="e.g. 15% off demos booked on site"
                  />
                )}
              </Field>

              <Field label="Booth hours">
                {(i) => (
                  <input
                    id={i}
                    className="input"
                    value={f.hours}
                    onChange={(e) =>
                      setF({ ...f, hours: e.target.value })
                    }
                  />
                )}
              </Field>
            </div>
          </div>

          <div className="card card-pad stack">
            <h3>Products &amp; services showcased</h3>

            <div className="chip-row">
              {f.products.map((p, i) => (
                <span key={p + i} className="chip">
                  {p}
                  <button
                    className="icon-btn"
                    style={{ width: 20, height: 20 }}
                    aria-label={`Remove ${p}`}
                    onClick={() =>
                      setF({
                        ...f,
                        products: f.products.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}

              {!f.products.length && (
                <span className="muted small">Nothing added yet.</span>
              )}
            </div>

            <div className="row">
              <input
                className="input"
                value={prod}
                onChange={(e) => setProd(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && (e.preventDefault(), addProd())
                }
                placeholder="Add a product or service"
                aria-label="New product"
              />

              <button className="btn btn-outline" onClick={addProd}>
                <Plus size={16} /> Add
              </button>
            </div>
          </div>

          <div className="card card-pad stack">
            <div className="row between">
              <h3>Booth staff</h3>

              <button
                className="btn btn-outline btn-sm"
                onClick={() =>
                  setF({
                    ...f,
                    staff: [
                      ...f.staff,
                      { id: uid('st'), name: '', role: '', email: '' },
                    ],
                  })
                }
              >
                <Plus size={15} /> Add person
              </button>
            </div>

            {f.staff.map((s, i) => (
              <div key={s.id} className="form-grid staff-row">
                <input
                  className="input"
                  placeholder="Name"
                  aria-label="Staff name"
                  value={s.name}
                  onChange={(e) => setStaff(i, 'name', e.target.value)}
                />

                <input
                  className="input"
                  placeholder="Role"
                  aria-label="Staff role"
                  value={s.role}
                  onChange={(e) => setStaff(i, 'role', e.target.value)}
                />

                <div className="row">
                  <input
                    className="input"
                    placeholder="Email"
                    aria-label="Staff email"
                    value={s.email}
                    onChange={(e) => setStaff(i, 'email', e.target.value)}
                  />

                  <button
                    className="icon-btn"
                    aria-label="Remove staff"
                    onClick={() =>
                      setF({
                        ...f,
                        staff: f.staff.filter((_, j) => j !== i),
                      })
                    }
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="card card-pad stack">
          <span className="eyebrow">Visitor preview</span>

          <div className="row">
            <Avatar user={user} size={52} square />
            <div>
              <h3>{user.company}</h3>
              <Badge tone="blue">Booth {boothLabel}</Badge>
            </div>
          </div>

          <p className="muted small">
            {f.tagline || 'Your tagline appears here.'}
          </p>

          {f.offer && (
            <div className="alert alert-warning">{f.offer}</div>
          )}

          <div className="chip-row">
            {f.products.map((p, i) => (
              <span key={p + i} className="tag">{p}</span>
            ))}
          </div>

          <p className="xs faint">
            {booth.visits || 0} visits · hours {f.hours}
          </p>

          <Link
            className="btn btn-outline"
            to={`/exhibitors/${user.id}?expo=${expoId}`}
          >
            Open public page
          </Link>
        </aside>
      </div>
    </>
  );
}


/* ---------- Neighbours ---------- */
export function Neighbors() {
  const { user } = useAuth();
  const toast = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState('');
  const realtimeVersion = useExpoRealtimeVersion();

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const ownBooths = await getMyShowcase();
        const results = await Promise.all(ownBooths.map(async (ownBooth) => {
          const expo = ownBooth.expo || {};
          const expoId = String(expo._id || expo.id || expo);
          if (!expoId || expoId === '[object Object]') return { booth: ownBooth, expo, neighbors: [] };
          const allBooths = await getBooths(expoId);
          const neighbors = findNeighborBooths(ownBooth, allBooths, user.id);
          return { booth: ownBooth, expo, neighbors };
        }));
        if (active) setGroups(results);
      } catch (loadError) {
        if (active) setError(loadError.message || 'Unable to load neighbouring exhibitors.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [user.id, realtimeVersion]);

  const shareContact = async (neighbor) => {
    const id = String(neighbor?._id || neighbor?.id || '');
    if (!id || sharing) return;
    setSharing(id);
    try {
      await sendMessage({
        to: id,
        kind: 'contact',
        text: `Contact card from ${user.company || user.name}`,
        meta: { name: user.name, company: user.company || '', email: user.email || '', phone: user.phone || '' },
      });
      toast.success('Contact shared', neighbor.company || neighbor.name);
    } catch (sendError) {
      toast.error('Could not share contact', sendError.message);
    } finally {
      setSharing('');
    }
  };

  if (loading) return <div className="page-loading">Loading your booth neighbours…</div>;
  if (error) return <><PageHeader title="Neighbours" subtitle="Discover exhibitors with booths close to yours." /><div className="alert alert-error" role="alert">{error}</div></>;
  if (!groups.length) return (<><PageHeader title="Neighbours" subtitle="Discover exhibitors with booths close to yours." /><div className="card"><EmptyState icon={Handshake} title="No confirmed booth yet" text="Once an organizer confirms your booth, neighbouring exhibitors in the same Expo will appear here." action={<Link className="btn btn-primary" to="/dashboard/booth">Book a booth</Link>} /></div></>);

  return (
    <>
      <PageHeader title="Neighbouring exhibitors" subtitle="Connect with companies whose booths are next to yours in the Expo floor plan." />
      <div className="stack-lg">{groups.map(({ booth, expo, neighbors }) => (
        <section key={booth._id || booth.id}>
          <h2 className="day-head"><span>Booth {booth.boothNumber}</span> {expo.title || 'Expo'}</h2>
          {neighbors.length ? <div className="grid grid-auto">{neighbors.map(({ exhibitor, ...boothInfo }) => {
            const neighbor = exhibitor || boothInfo.exhibitor;
            const neighborId = String(neighbor?._id || neighbor?.id || '');
            return <div key={boothInfo._id || boothInfo.id} className="card card-pad stack-sm">
              <div className="row"><Avatar user={neighbor} size={48} square /><div className="grow"><strong>{neighbor?.company || neighbor?.name || 'Exhibitor'}</strong><p className="small muted">Booth {boothInfo.boothNumber} · {boothInfo.zone || 'Main Hall'}</p></div></div>
              <p className="small muted">{boothInfo.showcase?.tagline || 'Connect with this exhibitor and explore potential collaboration.'}</p>
              <div className="row gap-sm wrap"><Link className="btn btn-primary btn-sm" to={`/dashboard/messages?to=${neighborId}`}><MessageSquare size={15} /> Message</Link>
                <button className="btn btn-outline btn-sm" onClick={() => void shareContact(neighbor)} disabled={!neighborId || sharing === neighborId}><IdCard size={15} /> {sharing === neighborId ? 'Sharing…' : 'Share contact'}</button></div>
            </div>;
          })}</div> : <div className="card"><EmptyState title="No neighbours yet" text="No other exhibitor booths are allocated beside this booth yet." /></div>}
        </section>
      ))}</div>
    </>
  );
}

/* ---------- Company profile ---------- */

export function CompanyProfile() {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [f, setF] = useState({
    company: '',
    category: '',
    tagline: '',
    description: '',
    website: '',
    phone: '',
    linkedin: '',
    logo: null,
    products: [],
  });

  const [profile, setProfile] = useState(null);
  const [prod, setProd] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setLoading(true);
        setLoadError('');
        const data = await getMyExhibitorProfile();

        if (!active) return;

        setProfile(data);

        if (data) {
          setF({
            company: data.companyName || '',
            category: data.industry || '',
            tagline: data.tagline || '',
            description: data.description || '',
            website: data.website || '',
            phone: data.contactPhone || '',
            linkedin: data.linkedin || '',
            logo: data.logo || null,
            products: (data.productsServices || []).map((p) =>
              typeof p === 'string' ? p : p.name
            ),
          });
        } else {
          setF((old) => ({
            ...old,
            company: user.company || '',
            category: user.category || '',
            description: user.description || '',
            website: user.website || '',
            phone: user.phone || '',
            logo: user.logo || null,
            products: user.products || [],
          }));
        }
      } catch (error) {
        if (active) setLoadError(error.message || 'Profile loading failed.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [user.id, reloadVersion]);

  const set = (key) => (e) => {
    setF((old) => ({
      ...old,
      [key]: e.target.value,
    }));
  };

const onLogo = async (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

    const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (!allowedTypes.includes(file.type)) {
    toast.error('Invalid image', 'Only JPG, PNG and WEBP images are allowed.');
    e.target.value = '';
    return;
  }

  if (file.size > 300 * 1024) {
    toast.error('Logo too large', 'Please use an image under 300 KB.');
    e.target.value = '';
    return;
  }

  try {
    setLogoUploading(true);

    const imageUrl = await uploadImage(file);

    setF((old) => ({
      ...old,
      logo: imageUrl,
    }));

    toast.success('Logo uploaded successfully');
  } catch (error) {
    toast.error('Logo upload failed', error.message);
  } finally {
    setLogoUploading(false);
    e.target.value = '';
  }
};
  const save = async () => {
    if (!f.company.trim()) {
      return toast.error('Company name is required');
    }

    if (!f.category.trim()) {
      return toast.error('Industry is required');
    }

    const payload = {
      companyName: f.company.trim(),
      industry: f.category.trim(),
      tagline: f.tagline.trim(),
      description: f.description,
      linkedin: f.linkedin.trim(),
      website: f.website,
      contactPhone: f.phone,
      logo: f.logo,
      productsServices: f.products.map((name) => ({
        name,
        description: '',
        image: '',
      })),
    };

    try {
      setSaving(true);

      let savedProfile;

      if (profile?._id) {
        savedProfile = await updateMyExhibitorProfile(payload);
      } else {
        savedProfile = await createExhibitorProfile(payload);
      }

      setProfile(savedProfile);

      toast.success('Company profile saved successfully');
    } catch (error) {
      toast.error('Unable to save profile', error.message);
    } finally {
      setSaving(false);
    }
  };

  const addProd = () => {
    const value = prod.trim();

    if (!value) return;

    if (f.products.includes(value)) {
      return toast.error('This product already exists');
    }

    setF((old) => ({
      ...old,
      products: [...old.products, value],
    }));

    setProd('');
  };

  if (loading) {
    return <div className="page-loading">Loading company profile...</div>;
  }

  if (loadError) {
    return <><PageHeader title="Company profile" subtitle="Your public exhibitor listing." /><div className="alert alert-error" role="alert"><p>{loadError}</p><button type="button" className="btn btn-outline" onClick={() => setReloadVersion((value) => value + 1)}>Try again</button></div></>;
  }

  return (
    <>
      <PageHeader
        title="Company profile"
        subtitle="Your public exhibitor listing."
        actions={
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={saving || logoUploading}
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        }
      />

      <div className="split">
        <div className="stack">
          <div className="card card-pad stack">
            <h3>Branding</h3>

            <div className="row gap-lg">
              <Avatar
                user={{ ...user, logo: f.logo, company: f.company }}
                size={88}
                square
              />

              <div className="stack-sm">
                <div className="row gap-sm">
<button
  type="button"
  className="btn btn-outline btn-sm"
  onClick={() => fileRef.current?.click()}
  disabled={logoUploading}
>
  <Paperclip size={15} />
  {logoUploading ? 'Uploading...' : 'Upload logo'}
</button>

                  {f.logo && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() =>
                        setF((old) => ({ ...old, logo: null }))
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>

                <input
                  ref={fileRef}
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={onLogo}
                />

                <p className="hint">
                  PNG or JPG, square works best, under 300 KB.
                </p>
              </div>
            </div>
          </div>

          <div className="card card-pad">
            <h3 style={{ marginBottom: 14 }}>Company details</h3>

            <div className="form-grid">
              <Field label="Company name" required>
                {(i) => (
                  <input
                    id={i}
                    className="input"
                    value={f.company}
                    onChange={set('company')}
                  />
                )}
              </Field>

              <Field label="Industry" required>
                {(i) => (
                  <select
                    id={i}
                    className="select"
                    value={f.category}
                    onChange={set('category')}
                  >
                    <option value="">Select industry</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              <Field label="Tagline" className="full">
                {(i) => (
                  <input
                    id={i}
                    className="input"
                    value={f.tagline}
                    onChange={set('tagline')}
                    placeholder="One line that sells you"
                  />
                )}
              </Field>

              <Field label="Description" className="full">
                {(i) => (
                  <textarea
                    id={i}
                    className="textarea"
                    rows={5}
                    value={f.description}
                    onChange={set('description')}
                  />
                )}
              </Field>

              <Field label="Website">
                {(i) => (
                  <input
                    id={i}
                    className="input"
                    value={f.website}
                    onChange={set('website')}
                  />
                )}
              </Field>

              <Field label="Phone">
                {(i) => (
                  <input
                    id={i}
                    className="input"
                    value={f.phone}
                    onChange={set('phone')}
                  />
                )}
              </Field>

              <Field label="LinkedIn" className="full">
                {(i) => (
                  <input
                    id={i}
                    className="input"
                    value={f.linkedin}
                    onChange={set('linkedin')}
                  />
                )}
              </Field>
            </div>

            <p className="hint">Your tagline and LinkedIn profile are saved with your public company details.</p>
          </div>
        </div>

        <aside className="card card-pad stack">
          <h3>Products &amp; services</h3>

          <div className="chip-row">
            {f.products.map((p, i) => (
              <span key={p + i} className="chip">
                {p}

                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 20, height: 20 }}
                  aria-label={`Remove ${p}`}
                  onClick={() =>
                    setF((old) => ({
                      ...old,
                      products: old.products.filter(
                        (_, j) => j !== i
                      ),
                    }))
                  }
                >
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>

          <div className="row">
            <input
              className="input"
              value={prod}
              onChange={(e) => setProd(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' && (e.preventDefault(), addProd())
              }
              placeholder="Add product"
              aria-label="New product"
            />

            <button
              type="button"
              className="btn btn-outline"
              onClick={addProd}
            >
              <Plus size={16} />
            </button>
          </div>

          <p className="hint">
            <Building2 size={13} style={{ verticalAlign: '-2px' }} />
            {' '}Visitors search the directory using these keywords.
          </p>
        </aside>
      </div>
    </>
  );
}

