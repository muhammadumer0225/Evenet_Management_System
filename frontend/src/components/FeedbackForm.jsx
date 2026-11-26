import { useEffect, useState } from 'react';
import { Bug, CheckCircle2, HelpCircle, Lightbulb, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/UIContext';
import { submitFeedback, getMyExpoRegistrationsApi } from '../lib/api';
import { cx } from '../lib/utils';
import { Field, Spinner, Stars } from './ui';

const TYPES = [
  ['suggestion', 'Suggestion', Lightbulb],
  ['issue', 'Report an issue', Bug],
  ['question', 'Question', HelpCircle],
];

export default function FeedbackForm({ onSent }) {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ type: 'suggestion', name: user?.name || '', email: user?.email || '', subject: '', message: '', rating: 0, expo: '' });
  const [expos, setExpos] = useState([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    let active = true;
    getMyExpoRegistrationsApi().then((registrations) => {
      if (!active) return;
      const unique = new Map();
      registrations
        .filter((registration) => registration.status === 'registered' && ['free', 'paid'].includes(registration.paymentStatus))
        .forEach((registration) => {
          const expo = registration.expo;
          const id = expo?._id || expo?.id;
          if (id) unique.set(String(id), { id: String(id), title: expo.title });
        });
      setExpos([...unique.values()]);
    }).catch(() => { if (active) setExpos([]); });
    return () => { active = false; };
  }, [user?.id]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await submitFeedback(f);
      setDone(true);
      onSent?.();
    } catch (err) {
      toast.error('Could not send', err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done)
    return (
      <div className="empty">
        <span className="empty-icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}><CheckCircle2 size={28} /></span>
        <h3>Thank you — we've got it!</h3>
        <p className="muted">Our team reviews every message. {user ? 'You can track the status under your feedback history.' : 'We will reply by email if needed.'}</p>
        <button className="btn btn-outline" onClick={() => { setDone(false); setF({ ...f, subject: '', message: '', rating: 0 }); }}>Send another</button>
      </div>
    );

  return (
    <form onSubmit={submit} className="stack" noValidate>
      <div className="type-picker" role="radiogroup" aria-label="Type of message">
        {TYPES.map(([k, label, Icon]) => (
          <button type="button" key={k} role="radio" aria-checked={f.type === k} className={cx('type-opt', f.type === k && 'active')} onClick={() => setF({ ...f, type: k })}>
            <Icon size={18} /> {label}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <Field label="Your name" required>{(i) => <input id={i} className="input" value={f.name} onChange={set('name')} autoComplete="name" />}</Field>
        <Field label="Email" required>{(i) => <input id={i} className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" />}</Field>
        <Field label="Related Expo (optional)" className="full">{(id) => <select id={id} className="select" value={f.expo} onChange={set('expo')}><option value="">General feedback</option>{expos.map((expo) => <option key={expo.id} value={expo.id}>{expo.title}</option>)}</select>}</Field>
        <Field label="Subject" required className="full">{(i) => <input id={i} className="input" value={f.subject} onChange={set('subject')} placeholder="In a few words…" />}</Field>
        <Field label="Message" required className="full">{(i) => <textarea id={i} className="textarea" value={f.message} onChange={set('message')} placeholder={f.type === 'issue' ? 'What happened? What did you expect? Which device/browser?' : 'Tell us more…'} />}</Field>
        <Field label="How is your experience so far?" className="full">{() => <Stars value={f.rating} onChange={(n) => setF({ ...f, rating: n })} size={26} />}</Field>
      </div>
      <div><button className="btn btn-primary btn-lg" disabled={busy}>{busy ? <Spinner /> : <Send size={17} />} Send message</button></div>
    </form>
  );
}
