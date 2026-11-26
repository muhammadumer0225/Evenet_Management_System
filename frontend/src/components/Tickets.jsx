import { useState } from 'react';
import { CalendarDays, Check, MapPin, Printer } from 'lucide-react';
import { Logo, Modal } from './ui';
import { useToast } from '../context/UIContext';
import {
  registerForExpoApi,
  getMyExpoRegistrationsApi,
  completeDemoPaymentApi,
} from '../lib/api';
import { TICKETS } from '../lib/selectors';
import TicketQRCode from './TicketQRCode';
import { cx, fmtRange, money } from '../lib/utils';


export function RegisterModal({
  expo,
  user,
  open,
  onClose,
  initialTier = 'Standard',
}) {
  const toast = useToast();
const [tier, setTier] = useState(
  TICKETS.find(
    (ticket) =>
      ticket.name.toLowerCase() === initialTier.toLowerCase()
  )?.name || 'Standard'
);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!expo) return null;



const submit = async () => {
  if (isSubmitting) return;

  setIsSubmitting(true);

  try {
    let registration;
    let alreadyPaid = false;

    // First, try creating a new registration
    try {
      const result = await registerForExpoApi(expo.id, tier);

      registration =
        result.registration ||
        result.data?.registration ||
        result;

    } catch (registerError) {
      // Registration may already exist
      const registrations = await getMyExpoRegistrationsApi();

      registration = registrations.find((item) => {
        const registeredExpoId =
          typeof item.expo === 'object'
            ? item.expo._id || item.expo.id
            : item.expo;

        return (
          String(registeredExpoId) === String(expo.id) &&
          item.ticketTier?.toLowerCase() === tier.toLowerCase()
        );
      });

      if (!registration) {
        throw registerError;
      }

      // Already paid and registered
      if (
        registration.status === 'registered' &&
        (tier === 'Standard' || registration.paymentStatus === 'paid')
      ) {
        alreadyPaid = true;
      } else if (
        registration.status !== 'pending_payment' ||
        registration.paymentStatus !== 'pending'
      ) {
        throw registerError;
      }
    }

    // Complete payment only if not already paid
    if (tier !== 'Standard' && !alreadyPaid) {
      const registrationId = registration._id || registration.id;

      if (!registrationId) {
        throw new Error('Registration ID was not returned by the server.');
      }

      await completeDemoPaymentApi(registrationId);
    }

    toast.success(
      alreadyPaid ? 'Already registered' : 'Registration confirmed',
      alreadyPaid
        ? `Your ${tier} pass for ${expo.title} is already active.`
        : `Your ${tier} pass for ${expo.title} is ready.`
    );

    onClose(true);

  } catch (e) {
    console.error('REGISTRATION ERROR:', e);
    toast.error('Could not register', e.message);

  } finally {
    setIsSubmitting(false);
  }
};



const t = TICKETS.find(
  (ticket) => ticket.name.toLowerCase() === tier.toLowerCase()
);

const price = expo.ticketPrice * (t?.mult ?? 1);

  return (
    <Modal
      open={open}
      onClose={() => onClose(false)}
      title={`Register for ${expo.title}`}
      subtitle={`${fmtRange(expo.startDate, expo.endDate)} · ${expo.location}`}
      size="lg"
      footer={
        <>
          <button
            className="btn btn-ghost"
            onClick={() => onClose(false)}
            disabled={isSubmitting}
          >
            Cancel
          </button>

          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Processing...'
              : `Confirm ${tier} · ${price === 0 ? 'Free' : money(price)}`}
          </button>
        </>
      }
    >
      <fieldset className="tier-grid" aria-label="Choose a ticket">
        {TICKETS.map((x) => (
          <label
            key={x.name}
            className={cx('tier', tier === x.name && 'active')}
          >
            <input
              type="radio"
              name="tier"
              checked={tier === x.name}
              onChange={() => setTier(x.name)}
              disabled={isSubmitting}
            />
            <strong>{x.name}</strong>
            <span className="tier-price">
              {money(expo.ticketPrice * x.mult)}
            </span>
            <ul>
              {x.perks.map((p) => (
                <li key={p}><Check size={14} /> {p}</li>
              ))}
            </ul>
          </label>
        ))}
      </fieldset>

      <p className="hint mt">
        Payment is simulated in this demo — no card is charged.
      </p>
    </Modal>
  );
}


export function PassModal({ reg, expo, user, open, onClose }) {
  if (!reg || !expo) return null;

  const registrationId = reg._id || reg.id;
  const ticketCode = reg.ticketCode || '';

  const ticketTier = (
    reg.ticket || reg.ticketTier || 'Standard'
  ).toUpperCase();

  const location =
    typeof expo.location === 'object' && expo.location !== null
      ? [
          expo.location.venue,
          expo.location.address,
          expo.location.city,
          expo.location.country,
        ].filter(Boolean).join(', ')
      : expo.location || 'Location not specified';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your digital pass"
      size="sm"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-dark" onClick={() => window.print()}>
            <Printer size={16} /> Print pass
          </button>
        </>
      }
    >
      <div className="pass" style={{ '--h': expo.hue || 215 }}>
        <div className="pass-top">
          <Logo light />
          <span className="pass-tier">{ticketTier}</span>
        </div>

        <h3>{expo.title}</h3>

        <ul>
          <li>
            <CalendarDays size={15} />
            {fmtRange(
              expo.startDate || expo.start,
              expo.endDate || expo.end
            )}
          </li>
          <li>
            <MapPin size={15} />
            {location}
          </li>
        </ul>

        <div className="pass-cut" />

        <div className="pass-bottom">
          <div>
            <small>Attendee</small>
            <strong>{user?.name || 'Attendee'}</strong>
            <small className="mono">Registration: {registrationId}</small>
            <small className="mono">Ticket code: {ticketCode || 'Not available — contact the organizer'}</small>
          </div>

          {ticketCode ? <TicketQRCode value={ticketCode} size={144} /> : <p className="small muted">Ticket QR is not available yet. Please ask the organizer to run the ticket-code migration.</p>}
        </div>
      </div>
    </Modal>
  );
}

