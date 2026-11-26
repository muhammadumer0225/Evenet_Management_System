import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Building2, CheckCircle2, ClipboardList, Eye, EyeOff, KeyRound, Lock, Mail, MailCheck, Phone, Store, Ticket, User } from 'lucide-react';
import { Field, Logo, Spinner } from '../components/ui';
import { ThemeToggle } from '../components/Layouts';
import { checkResetToken, login, register, requestPasswordReset, resetPassword } from '../lib/api';
import { cx, isEmail, passwordStrength } from '../lib/utils';


function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth-side" aria-hidden="true">
        <Link to="/"><Logo light /></Link>
        <div className="auth-art">
          {Array.from({ length: 40 }, (_, i) => <i key={i} style={{ animationDelay: `${(i * 137) % 2400}ms` }} className={`a${(i * 7) % 5}`} />)}
        </div>
        <div className="auth-quote">
          <p>“We moved 120 exhibitors, 3 halls and 9,000 attendees onto EventSphere. Booth allocation went from two weeks to two days.”</p>
          <span>— Operations Lead, TechNova Expo</span>
        </div>
      </aside>
      <section className="auth-main">
        <div className="auth-top">
          <Link to="/" className="back-link"><ArrowLeft size={16} /> Back to site</Link>
          <ThemeToggle />
        </div>
        <div className="auth-box">
          <Link to="/" className="auth-logo"><Logo /></Link>
          <h1>{title}</h1>
          <p className="muted">{subtitle}</p>
          {children}
          {footer && <div className="auth-foot">{footer}</div>}
        </div>
      </section>
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete, placeholder = '••••••••' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-icon">
      <Lock size={18} />
      <input id={id} className="input" type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={placeholder} />
      <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function Strength({ value }) {
  const { score, label } = passwordStrength(value);
  return (
    <div className="strength" aria-live="polite">
      {[1, 2, 3, 4].map((n) => <i key={n} className={score >= n ? `on-${score}` : ''} />)}
      <span>{label}</span>
    </div>
  );
}

export function Login() {
  const nav = useNavigate();
  const loc = useLocation();
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (email, password) => {
    setErr('');
    if (!isEmail(email) || !password) return setErr('Enter your email and password.');
    setBusy(true);
    try {
      await login(email, password);
      nav(loc.state?.from || '/dashboard', { replace: true });
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your EventSphere account."
      footer={<>New to EventSphere? <Link to="/register" className="link">Create an account</Link></>}
    >
      <form className="stack" onSubmit={(e) => { e.preventDefault(); go(f.email, f.password); }} noValidate>
        {err && <div className="alert alert-error" role="alert"><AlertCircle size={18} /> {err}</div>}
        <Field label="Email" required>
          {(i) => (
            <div className="input-icon"><Mail size={18} /><input id={i} className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="you@company.com" /></div>
          )}
        </Field>
        <Field label="Password" required>
          {(i) => <PasswordInput id={i} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" />}
        </Field>
        <div className="row between">
          <label className="check"><input type="checkbox" defaultChecked /> Keep me signed in</label>
          <Link to="/forgot-password" className="link small">Forgot password?</Link>
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <Spinner /> : 'Sign in'}</button>
      </form>
      
    </AuthShell>
  );
}

/* ---------------- Register ---------------- */
const ROLES = [
  ['attendee', 'Attendee', 'Visit expos & build an agenda', Ticket],
  ['exhibitor', 'Exhibitor', 'Showcase products & book booths', Store],
  ['admin', 'Organizer', 'Create & manage expos', ClipboardList],
];

export function Register() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const initial = ROLES.some((r) => r[0] === sp.get('role')) ? sp.get('role') : 'attendee';
  const [f, setF] = useState({ role: initial, name: '', email: '', phone: '', company: '', orgCode: '', password: '', confirm: '', consent: false });
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (!f.name.trim()) e.name = 'Enter your full name';
    if (!isEmail(f.email)) e.email = 'Enter a valid email';
    if (f.role === 'exhibitor' && !f.company.trim()) e.company = 'Enter your company name';
    if (f.role === 'admin' && !f.orgCode.trim()) e.orgCode = 'Organizer invitation code is required';
    if (f.password.length < 8) e.password = 'Use at least 8 characters';
    if (f.confirm !== f.password) e.confirm = 'Passwords do not match';
    if (!f.consent) e.consent = 'You must accept the Privacy Policy';
    setErrs(e);
    return !Object.keys(e).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!validate()) return;
    setBusy(true);
    try {
      await register(f);
      nav('/dashboard', { replace: true });
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join as an attendee, exhibitor or organizer — it takes less than a minute."
      footer={<>Already have an account? <Link to="/login" className="link">Sign in</Link></>}
    >
      <form className="stack" onSubmit={submit} noValidate>
        {err && <div className="alert alert-error" role="alert"><AlertCircle size={18} /> {err}</div>}
        <fieldset className="role-pick" aria-label="Choose your role">
          {ROLES.map(([k, l, d, Icon]) => (
            <label key={k} className={cx('role-opt', f.role === k && 'active')}>
              <input type="radio" name="role" checked={f.role === k} onChange={() => setF({ ...f, role: k })} />
              <Icon size={22} /><strong>{l}</strong><small>{d}</small>
            </label>
          ))}
        </fieldset>
        <div className="form-grid">
          <Field label="Full name" required error={errs.name} className="full">
            {(i) => <div className="input-icon"><User size={18} /><input id={i} className="input" value={f.name} onChange={set('name')} autoComplete="name" /></div>}
          </Field>
          <Field label="Email" required error={errs.email}>
            {(i) => <div className="input-icon"><Mail size={18} /><input id={i} className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" /></div>}
          </Field>
          <Field label="Phone">
            {(i) => <div className="input-icon"><Phone size={18} /><input id={i} className="input" type="tel" value={f.phone} onChange={set('phone')} autoComplete="tel" /></div>}
          </Field>
          {f.role === 'exhibitor' && (
            <Field label="Company name" required error={errs.company} className="full">
              {(i) => <div className="input-icon"><Building2 size={18} /><input id={i} className="input" value={f.company} onChange={set('company')} autoComplete="organization" /></div>}
            </Field>
          )}
          {f.role === 'admin' && (
            <Field label="Organizer invitation code" required error={errs.orgCode} hint="Enter the invitation code provided by the organizer" className="full">
              {(i) => <div className="input-icon"><KeyRound size={18} /><input id={i} className="input mono" value={f.orgCode} onChange={set('orgCode')} placeholder="Enter invitation code" /></div>}
            </Field>
          )}
          <Field label="Password" required error={errs.password}>
            {(i) => (<><PasswordInput id={i} value={f.password} onChange={set('password')} autoComplete="new-password" /><Strength value={f.password} /></>)}
          </Field>
          <Field label="Confirm password" required error={errs.confirm}>
            {(i) => <PasswordInput id={i} value={f.confirm} onChange={set('confirm')} autoComplete="new-password" />}
          </Field>
        </div>
        <div className={cx('field', errs.consent && 'has-error')}>
          <label className="check"><input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} /> <span>I agree to the <Link to="/privacy" className="link" target="_blank">Privacy Policy</Link> and consent to my data being processed to run the events I take part in.</span></label>
          {errs.consent && <p className="field-error">{errs.consent}</p>}
        </div>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <Spinner /> : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}

/* ---------------- Forgot ---------------- */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await requestPasswordReset(email);
      setSent(r);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <AuthShell title="Check your inbox" subtitle={`If an account exists for ${email}, we've sent a link to reset your password. It expires in 15 minutes.`} footer={<Link to="/login" className="link">← Back to sign in</Link>}>
        <div className="alert alert-success"><MailCheck size={20} /> Reset email sent.</div>
        {sent.token && (
          <div className="demo-note">
            <strong>Demo mode</strong>
            <p className="small muted">No real email is sent in this frontend demo. Use the link below instead:</p>
            <Link to={`/reset-password?token=${sent.token}`} className="btn btn-dark btn-block">Open reset link</Link>
          </div>
        )}
      </AuthShell>
    );

  return (
    <AuthShell title="Forgot your password?" subtitle="Enter your email and we'll send you a reset link." footer={<Link to="/login" className="link">← Back to sign in</Link>}>
      <form className="stack" onSubmit={submit} noValidate>
        {err && <div className="alert alert-error" role="alert"><AlertCircle size={18} /> {err}</div>}
        <Field label="Email" required>
          {(i) => <div className="input-icon"><Mail size={18} /><input id={i} className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" /></div>}
        </Field>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <Spinner /> : 'Send reset link'}</button>
      </form>
    </AuthShell>
  );
}

/* ---------------- Reset ---------------- */
export function ResetPassword() {
  const [sp] = useSearchParams();
  const token = sp.get('token') || '';
  const nav = useNavigate();
 const valid = Boolean(token);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!valid && !done)
    return (
      <AuthShell title="Link expired" subtitle="This password reset link is invalid or has expired." footer={<Link to="/login" className="link">← Back to sign in</Link>}>
        <Link to="/forgot-password" className="btn btn-primary btn-block">Request a new link</Link>
      </AuthShell>
    );
  if (done)
    return (
      <AuthShell title="Password updated" subtitle="You can now sign in with your new password.">
        <div className="alert alert-success"><CheckCircle2 size={20} /> Your password was changed.</div>
        <button className="btn btn-primary btn-lg btn-block" onClick={() => nav('/login')}>Continue to sign in</button>
      </AuthShell>
    );

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw !== pw2) return setErr('Passwords do not match.');
    setBusy(true);
    try {
      await resetPassword(token, pw);
      setDone(true);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Set a new password" subtitle="Choose a strong password you don't use elsewhere.">
      <form className="stack" onSubmit={submit} noValidate>
        {err && <div className="alert alert-error" role="alert"><AlertCircle size={18} /> {err}</div>}
        <Field label="New password" required>{(i) => (<><PasswordInput id={i} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><Strength value={pw} /></>)}</Field>
        <Field label="Confirm new password" required>{(i) => <PasswordInput id={i} value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />}</Field>
        <button className="btn btn-primary btn-lg btn-block" disabled={busy}>{busy ? <Spinner /> : 'Update password'}</button>
      </form>
    </AuthShell>
  );
}
