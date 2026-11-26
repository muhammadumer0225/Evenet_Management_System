import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarPlus, QrCode, Ticket, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useConfirm, useToast } from '../../context/UIContext';
import { ExpoCard, SessionCard } from '../../components/Cards';
import { PassModal, RegisterModal } from '../../components/Tickets';
import { Badge, EmptyState, PageHeader, Tabs } from '../../components/ui';
import { cancelExpoRegistrationApi, getMyExpoRegistrationsApi, getPublishedExpos, verifyMyRegistrationApi, getMySessionRegistrationsApi, getPublishedSessions, cancelSessionRegistrationApi, removeSessionBookmarkApi } from '../../lib/api';
import { normalizeSession } from '../../lib/normalizers';
import { downloadFile, fmtDate, fmtTime, icsFor, sessionEnd, sessionStart } from '../../lib/utils';


export function MyExpos() {
  const { user, db } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [regExpo, setRegExpo] = useState(null);
  const [passFor, setPassFor] = useState(null);
  const [expos, setExpos] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
const [regTier, setRegTier] = useState('Standard');
  const [registrationLookup, setRegistrationLookup] = useState('');
  const [verification, setVerification] = useState(null);
  const [verifying, setVerifying] = useState(false);

  async function handleVerifyRegistration(event) {
    event.preventDefault();
    if (!registrationLookup.trim() || verifying) return;
    setVerifying(true);
    setVerification(null);
    try {
      const result = await verifyMyRegistrationApi(registrationLookup);
      setVerification(result);
    } catch (error) {
      setVerification({ success: false, registered: false, message: error.message });
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadData() {
      try {
        setLoading(true);
        setLoadError('');

        const [expoData, registrationData] = await Promise.all([
          getPublishedExpos(),
          getMyExpoRegistrationsApi(),
        ]);

        if (!active) return;

        setExpos(
          expoData.map((expo) => ({
            ...expo,
            id: expo._id || expo.id,
            start: expo.startDate || expo.start,
            end: expo.endDate || expo.end,
            location:
              typeof expo.location === 'object'
                ? [
                    expo.location.venue,
                    expo.location.city,
                    expo.location.country,
                  ].filter(Boolean).join(', ')
                : expo.location,
          }))
        );

        setRegistrations(registrationData || []);
      } catch (error) {
        console.error('Failed to load attendee expos:', error);
        if (active) setLoadError(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const activeRegistrations = registrations.filter(
    (r) =>
      r.status === 'registered' &&
      ['free', 'paid'].includes(r.paymentStatus)
  );

  const pendingRegistrations = registrations.filter(
    (r) =>
      r.status === 'pending_payment' ||
      r.paymentStatus === 'pending'
  );

const registeredExpoIds = registrations
  .filter(
    (r) =>
      r.status === 'registered' ||
      r.status === 'pending_payment' ||
      r.paymentStatus === 'pending'
  )
  .map((r) => r.expo?._id || r.expo?.id);

  const open = expos.filter(
    (expo) =>
      ['published', 'ongoing'].includes(expo.status) &&
      !registeredExpoIds.includes(expo.id)
  );

  const selectedRegistration = registrations.find(
    (r) => r._id === passFor
  );

  const selectedExpo = selectedRegistration?.expo
    ? {
        ...selectedRegistration.expo,
        id:
          selectedRegistration.expo._id ||
          selectedRegistration.expo.id,
        start:
          selectedRegistration.expo.startDate ||
          selectedRegistration.expo.start,
        end:
          selectedRegistration.expo.endDate ||
          selectedRegistration.expo.end,
        location:
          typeof selectedRegistration.expo.location === 'object'
            ? [
                selectedRegistration.expo.location.venue,
                selectedRegistration.expo.location.city,
                selectedRegistration.expo.location.country,
              ].filter(Boolean).join(', ')
            : selectedRegistration.expo.location,
      }
    : null;

  const passRegistration = selectedRegistration
    ? {
        ...selectedRegistration,
        id: selectedRegistration._id,
        ticket: selectedRegistration.ticketTier?.toUpperCase(),
      }
    : null;

  async function handleCancel(registration) {
    const confirmed = await confirm({
      title: 'Cancel registration?',
      message: registration.status === 'pending_payment'
        ? 'This pending registration will be cancelled. No payment has been completed, so no refund is due.'
        : ['premium', 'vip'].includes(registration.ticketTier?.toLowerCase())
          ? 'Your paid Premium/VIP demo ticket will be cancelled and a 70% demo refund recorded after the 30% deduction.'
          : 'Are you sure you want to cancel this free Expo registration?', 
      danger: true,
      confirmText: 'Cancel registration',
    });

    if (!confirmed) return;

    try {
      const result = await cancelExpoRegistrationApi(
        registration._id
      );

      toast.info(
        result.message || 'Registration cancelled successfully.'
      );

      setPassFor(null);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      toast.error(error.message || 'Unable to cancel registration.');
    }
  }

  return (
    <>
      <PageHeader
        title="Expos & tickets"
        subtitle="Register for expos and keep your digital passes handy."
      />

      <section className="card card-pad" style={{ marginBottom: 24 }}>
        <div className="row gap-sm" style={{ alignItems: 'center', marginBottom: 8 }}>
          <ShieldCheck size={19} />
          <h2 className="h3" style={{ margin: 0 }}>Verify your registration</h2>
        </div>
        <p className="muted small">Enter your EventSphere registration ID or ticket code to confirm that your pass is active.</p>
        <form className="row gap-sm wrap" onSubmit={handleVerifyRegistration}>
          <input
            className="input"
            style={{ flex: '1 1 260px' }}
            value={registrationLookup}
            onChange={(event) => setRegistrationLookup(event.target.value)}
            placeholder="Registration ID or ES ticket code"
            aria-label="Registration ID or ticket code"
            autoComplete="off"
          />
          <button className="btn btn-primary" type="submit" disabled={verifying || !registrationLookup.trim()}>
            {verifying ? 'Checking…' : 'Verify registration'}
          </button>
        </form>
        {verification && (() => {
          const registration = verification.registration;
          const checkedIn = Boolean(registration?.checkedInAt);
          const paymentComplete = ['free', 'paid'].includes(registration?.paymentStatus);
          const registrationActive = Boolean(verification.registered);
          const checkedInDate = registration?.checkedInAt
            ? new Date(registration.checkedInAt)
            : null;
          const checkedInLabel = checkedInDate && !Number.isNaN(checkedInDate.getTime())
            ? checkedInDate.toLocaleString()
            : null;

          let nextStep = 'Check the ID or ticket code and try again. If the issue continues, contact the event organizer.';
          if (registrationActive && checkedIn) {
            nextStep = 'You are already checked in. No further action is needed for Expo entry.';
          } else if (registrationActive) {
            nextStep = 'Your pass is active. Keep your digital QR pass ready and show it to event staff at the entrance. Staff will complete your check-in.';
          } else if (registration && !paymentComplete) {
            nextStep = 'Your registration is not active yet. Complete the pending payment from your pass, then verify again.';
          } else if (registration) {
            nextStep = 'This registration is not active. Contact the event organizer if you believe this is incorrect.';
          }

          return (
            <div className={`alert ${registrationActive ? 'alert-success' : registration ? 'alert-warning' : 'alert-error'}`} role="status" aria-live="polite" style={{ marginTop: 12 }}>
              <strong>{registrationActive ? 'Registration confirmed' : registration ? 'Registration found — action required' : 'Registration not confirmed'}</strong>
              <div>{verification.message}</div>
              {registration && (
                <div className="small" style={{ display: 'grid', gap: 5, marginTop: 10 }}>
                  <div><strong>Expo:</strong> {registration.expo?.title || 'Expo details unavailable'}</div>
                  <div><strong>Ticket:</strong> {registration.ticketTier?.toUpperCase() || 'Not specified'}</div>
                  <div><strong>Registration status:</strong> {registration.status?.replaceAll('_', ' ') || 'Unknown'}</div>
                  <div><strong>Payment status:</strong> {registration.paymentStatus || 'Unknown'}</div>
                  <div><strong>Check-in status:</strong> {checkedIn ? 'Already checked in' : registrationActive ? 'Not checked in yet' : 'Not eligible for check-in'}</div>
                  {checkedInLabel && <div><strong>Checked in at:</strong> {checkedInLabel}</div>}
                  {registration.ticketCode && <div><strong>Ticket code:</strong> <span className="mono">{registration.ticketCode}</span></div>}
                </div>
              )}
              <div className="small" style={{ marginTop: 10 }}><strong>Next step:</strong> {nextStep}</div>
            </div>
          );
        })()}
      </section>

      {loading ? (
        <div className="card">Loading your Expos and registrations...</div>
      ) : loadError ? (
        <div className="card">
          <p>{loadError}</p>
          <button
            className="btn btn-primary"
            onClick={() => setRefreshKey((key) => key + 1)}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <h2 className="h3" style={{ marginBottom: 12 }}>
            My passes
          </h2>

          {activeRegistrations.length ? (
            <div className="grid grid-auto" style={{ marginBottom: 32 }}>
              {activeRegistrations.map((registration) => {
                const expoDoc = registration.expo;

                if (!expoDoc) return null;

                const expo = {
                  ...expoDoc,
                  id: expoDoc._id || expoDoc.id,
                  start: expoDoc.startDate || expoDoc.start,
                  end: expoDoc.endDate || expoDoc.end,
                  location:
                    typeof expoDoc.location === 'object'
                      ? [
                          expoDoc.location.venue,
                          expoDoc.location.city,
                          expoDoc.location.country,
                        ].filter(Boolean).join(', ')
                      : expoDoc.location,
                };

                return (
                  <ExpoCard
                    key={registration._id}
                    expo={expo}
                    db={db}
                    footer={
  <div className="stack gap-sm">
    <Badge tone="green">
      {registration.ticketTier?.toUpperCase()} pass
    </Badge>

    <button
      className="btn btn-dark btn-sm"
      style={{ width: '100%', justifyContent: 'center' }}
      onClick={() => setPassFor(registration._id)}
    >
      <QrCode size={15} /> View pass
    </button>

    <button
      className="btn btn-ghost btn-sm"
      style={{ width: '100%', justifyContent: 'center' }}
      onClick={() => handleCancel(registration)}
    >
      Cancel registration
    </button>
  </div>
}
                  />
                );
              })}
            </div>
          ) : (
            <div className="card" style={{ marginBottom: 32 }}>
              <EmptyState
                icon={Ticket}
                title="No passes yet"
                text="Register for an expo below to get your digital pass."
              />
            </div>
          )}

          {pendingRegistrations.length > 0 && (
            <>
              <h2 className="h3" style={{ marginBottom: 12 }}>
                Pending payments
              </h2>

              <div className="grid grid-auto" style={{ marginBottom: 32 }}>
                {pendingRegistrations.map((registration) => {
                  const expoDoc = registration.expo;
                  if (!expoDoc) return null;

                  const expo = {
                    ...expoDoc,
                    id: expoDoc._id || expoDoc.id,
                    ticketPrice:
  Number(registration.ticketPrice || 0) /
  (registration.ticketTier?.toLowerCase() === 'premium'
    ? 2
    : registration.ticketTier?.toLowerCase() === 'vip'
      ? 4
      : 1),
                    start: expoDoc.startDate || expoDoc.start,
                    end: expoDoc.endDate || expoDoc.end,
                    location:
                      typeof expoDoc.location === 'object'
                        ? [
                            expoDoc.location.venue,
                            expoDoc.location.city,
                            expoDoc.location.country,
                          ].filter(Boolean).join(', ')
                        : expoDoc.location,
                  };

                  return (
                    <ExpoCard
                      key={registration._id}
                      expo={expo}
                      db={db}
                      footer={
                        <div className="stack gap-sm">
                          <Badge tone="warning">
                            Payment pending
                          </Badge>
                          <button
                            className="btn btn-primary btn-block"
                            onClick={() => {
                              setRegTier(registration.ticketTier?.toUpperCase() || 'Standard');
                              setRegExpo(expo);
                            }}
                          >
                            Continue registration
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={() => handleCancel(registration)}>
                            Cancel pending registration
                          </button>
                          <span className="text-muted">
                            Select your original ticket tier to retry payment.
                          </span>
                        </div>
                      }
                    />
                  );
                })}
              </div>
            </>
          )}

          <h2 className="h3" style={{ marginBottom: 12 }}>
            Open for registration
          </h2>

          {open.length ? (
            <div className="grid grid-auto">
              {open.map((expo) => (
                <ExpoCard
                  key={expo.id}
                  expo={expo}
                  db={db}
                  footer={
                    <button
                      className="btn btn-primary btn-block"
                      onClick={() => setRegExpo(expo)}
                    >
                      <Ticket size={16} /> Register
                    </button>
                  }
                />
              ))}
            </div>
          ) : (
            <div className="card">
              <EmptyState
                icon={Ticket}
                title="No open Expos"
                text="There are currently no Expos available for registration."
              />
            </div>
          )}
        </>
      )}

<RegisterModal
  key={`${regExpo?.id || 'closed'}-${regTier}`}
  expo={regExpo}
  user={user}
  initialTier={regTier}
  open={!!regExpo}
  onClose={(success) => {
    setRegExpo(null);
    if (success) setRefreshKey((key) => key + 1);
  }}
/>

      <PassModal
        reg={passRegistration}
        expo={selectedExpo}
        user={user}
        open={!!passFor && !!passRegistration}
        onClose={() => setPassFor(null)}
      />
    </>
  );
}


export function Agenda() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [tab, setTab] = useState('mine');
  const [registrations, setRegistrations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expoRegistrationIds, setExpoRegistrationIds] = useState([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      getMySessionRegistrationsApi({ userId: user?.id }),
      getMyExpoRegistrationsApi(),
      getPublishedSessions(),
    ]).then(([sessionRegistrations, expoRegistrations, publishedSessions]) => {
      if (!active) return;
      setRegistrations(sessionRegistrations || []);
      setSessions((publishedSessions || []).map(normalizeSession));
      setExpoRegistrationIds((expoRegistrations || [])
        .filter((registration) => registration.status === 'registered' && ['free', 'paid'].includes(registration.paymentStatus))
        .map((registration) => String(registration.expo?._id || registration.expo?.id || registration.expo)));
    }).catch((loadError) => {
      if (active) setError(loadError.message || 'Unable to load your agenda.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const refreshAgenda = async () => {
    const fresh = await getMySessionRegistrationsApi({ userId: user?.id });
    setRegistrations(fresh || []);
  };

  const removeFromAgenda = async (registration) => {
    const session = registration.session;
    const isRegistered = registration.type === 'register';
    const approved = await confirm({
      title: isRegistered ? 'Cancel session registration?' : 'Remove saved session?',
      message: isRegistered ? 'Your seat will be released for another attendee.' : 'This session will be removed from your saved agenda.',
      danger: isRegistered,
      confirmText: isRegistered ? 'Cancel registration' : 'Remove bookmark',
    });
    if (!approved) return;
    try {
      if (isRegistered) await cancelSessionRegistrationApi(registration._id || registration.id);
      else await removeSessionBookmarkApi(String(session?._id || session?.id || session));
      await refreshAgenda();
      toast.success(isRegistered ? 'Registration cancelled' : 'Bookmark removed');
    } catch (error) {
      toast.error('Could not update your agenda', error.message);
    }
  };

  const mine = registrations
    .filter((registration) => registration.status === 'registered' && ['register', 'bookmark'].includes(registration.type) && registration.session?.status === 'published')
    .map((registration) => normalizeSession(registration.session || {}))
    .filter((session) => session.id)
    .sort((a, b) => sessionStart(a) - sessionStart(b));
  const mineIds = new Set(mine.map((session) => session.id));
  const registered = registrations
    .filter((registration) => registration.status === 'registered' && registration.type === 'register' && registration.session?.status === 'published')
    .map((registration) => normalizeSession(registration.session || {}))
    .filter((session) => session.id);
  const clashes = registered.filter((a, i) => registered.some((b, j) => j !== i && sessionStart(a) < sessionEnd(b) && sessionEnd(a) > sessionStart(b)));
  const discover = sessions
    .filter((session) => expoRegistrationIds.includes(String(session.expoId)) && !mineIds.has(session.id) && sessionEnd(session) > new Date())
    .sort((a, b) => sessionStart(a) - sessionStart(b));
  const list = tab === 'mine' ? mine : discover;
  const days = list.reduce((map, session) => ((map[session.date] = map[session.date] || []).push(session), map), {});

  return (
    <>
      <PageHeader title="My agenda" subtitle="Your registered and bookmarked sessions, synced with your EventSphere account."
        actions={<button className="btn btn-outline" disabled={!mine.length} onClick={() => downloadFile('my-agenda.ics', mine.map((session) => icsFor(session, { id: session.expoId, title: session.expoTitle })).join('\r\n'), 'text/calendar')}><CalendarPlus size={16} /> Export all (.ics)</button>} />
      {loading && <p className="muted">Loading your agenda…</p>}
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {clashes.length > 0 && <div className="alert alert-warning" style={{ marginBottom: 16 }}><CalendarClock size={18} /><div><strong>Schedule clash:</strong> {[...new Set(clashes.map((session) => session.title))].join(' ↔ ')} overlap in time.</div></div>}
      <Tabs value={tab} onChange={setTab} tabs={[{ key: 'mine', label: 'My sessions', count: mine.length }, { key: 'discover', label: 'Discover more', count: discover.length }]} />
      <div className="mt-lg">{list.length ? <div className="stack-lg">{Object.entries(days).map(([date, items]) => (
        <section key={date}><h2 className="day-head">{fmtDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}</h2><div className="stack">{items.map((session) => {
          const record = registrations.find((item) => String(item.session?._id || item.session?.id || item.session) === String(session.id) && item.status === 'registered');
          return <div className="card card-pad" key={session.id}>
            <SessionCard session={session} showExpo expoOverride={{ id: session.expoId, title: session.expoTitle }} actions={false} />
            <div className="row between wrap mt-sm"><span className="muted small">{record?.type === 'register' ? 'Registered seat' : 'Saved bookmark'}</span><button className="btn btn-sm btn-outline" onClick={() => record && removeFromAgenda(record)}>{record?.type === 'register' ? 'Cancel registration' : 'Remove from agenda'}</button></div>
          </div>;
        })}</div></section>))}</div>
        : !loading && !error ? <div className="card"><EmptyState icon={CalendarClock} title={tab === 'mine' ? 'Nothing planned yet' : 'No more sessions'} text={tab === 'mine' ? 'Register for or bookmark sessions to build your plan.' : 'Register for an Expo to discover its sessions here.'} action={<Link to="/schedule" className="btn btn-primary">Browse full schedule</Link>} /></div> : null}</div>
    </>
  );
}
