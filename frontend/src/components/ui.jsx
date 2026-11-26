import { useEffect, useId, useRef, useState } from 'react';
import { Search, Star, X } from 'lucide-react';
import { cx, hueOf, initials } from '../lib/utils';

/* ---------- Logo ---------- */
export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <g fill="#fff">
        <rect x="14" y="14" width="16" height="16" rx="4" />
        <rect x="34" y="14" width="16" height="16" rx="4" opacity=".55" />
        <rect x="14" y="34" width="16" height="16" rx="4" opacity=".55" />
        <rect x="34" y="34" width="16" height="16" rx="4" />
      </g>
    </svg>
  );
}
export function Logo({ light }) {
  return (
    <span className={cx('logo', light && 'logo-light')}>
      <LogoMark />
      <span className="logo-text">
        Event<b>Sphere</b>
      </span>
    </span>
  );
}

/* ---------- Badge / status ---------- */
export function Badge({ tone = 'neutral', dot, children, className }) {
  return (
    <span className={cx('badge', `badge-${tone}`, className)}>
      {dot && <i className="badge-dot" />}
      {children}
    </span>
  );
}

const STATUS_MAP = {
  live: ['red', 'Live now', true],
  upcoming: ['blue', 'Upcoming'],
  completed: ['neutral', 'Completed'],
  draft: ['gold', 'Draft'],
  pending: ['gold', 'Pending review'],
  approved: ['green', 'Approved'],
  rejected: ['red', 'Rejected'],
  available: ['green', 'Available'],
  reserved: ['gold', 'Reserved'],
  booked: ['blue', 'Confirmed'],
  blocked: ['neutral', 'Blocked'],
  active: ['green', 'Active'],
  suspended: ['red', 'Suspended'],
  open: ['gold', 'Open'],
  in_progress: ['blue', 'In progress'],
  resolved: ['green', 'Resolved'],
};
export function StatusBadge({ status }) {
  const [tone, label, dot] = STATUS_MAP[status] || ['neutral', status];
  return (
    <Badge tone={tone} dot={dot}>
      {label}
    </Badge>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ user, name, hue, src, size = 36, square }) {
  const n = name || user?.company || user?.name || '';
  const h = hue ?? user?.hue ?? hueOf(n);
  const img = src || user?.profileImage || user?.logo;
  return (
    <span
      className={cx('avatar', square && 'avatar-sq')}
      style={{ width: size, height: size, fontSize: size * 0.38, background: img ? 'var(--surface-2)' : `hsl(${h} 55% 42%)` }}
      aria-hidden="true"
    >
      {img ? <img src={img} alt="" /> : initials(n)}
    </span>
  );
}

/* ---------- Modal ---------- */

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    const prev = document.activeElement;

    const onKey = (e) => {
      if (e.key === 'Escape') onCloseRef.current?.();

      if (e.key === 'Tab' && ref.current) {
        const f = ref.current.querySelectorAll(
          'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'
        );

        if (!f.length) return;

        const first = f[0];
        const last = f[f.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      prev?.focus?.();
    };
 }, [open]);

  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(() => {
      const el = ref.current?.querySelector(
        '[data-autofocus],input:not([type=hidden]),textarea,select'
      );
      (el || ref.current)?.focus?.();
    }, 30);

    return () => clearTimeout(timer);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx('modal', `modal-${size}`)} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <header className="modal-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="muted small">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}


/* ---------- Form bits ---------- */
export function Field({ label, hint, error, required, children, className }) {
  const id = useId();
  return (
    <div className={cx('field', error && 'has-error', className)}>
      {label && (
        <label htmlFor={id} className="label">
          {label} {required && <span className="req" aria-hidden="true">*</span>}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Search…', className }) {
  return (
    <div className={cx('searchbox', className)}>
      <Search size={18} aria-hidden="true" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {value && (
        <button className="icon-btn" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Stars({ value = 0, onChange, size = 20 }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="stars" role={onChange ? 'radiogroup' : 'img'} aria-label={`Rating: ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          disabled={!onChange}
          className={cx('star', (hover || value) >= n && 'on')}
          onMouseEnter={() => onChange && setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange?.(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star size={size} fill={(hover || value) >= n ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label, description }) {
  return (
    <label className="switch-row">
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <i className="switch" aria-hidden="true" />
    </label>
  );
}

/* ---------- Layout bits ---------- */
export function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && (
        <span className="empty-icon">
          <Icon size={26} />
        </span>
      )}
      <h3>{title}</h3>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, hint, tone = 'accent', to }) {
  return (
    <div className={cx('stat', `stat-${tone}`)}>
      <span className="stat-icon">{Icon && <Icon size={20} />}</span>
      <div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        {hint && <p className="stat-hint">{hint}</p>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('tabs', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.key} role="tab" aria-selected={value === t.key} className={cx('tab', value === t.key && 'active')} onClick={() => onChange(t.key)}>
          {t.icon && <t.icon size={16} />}
          {t.label}
          {t.count != null && <span className="tab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value = 0, tone = 'accent', label }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <i className={`progress-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

/* ---------- Expo cover art (generated, no external images) ---------- */
export function ExpoCover({ expo, className, children }) {
  const h = expo.hue ?? 12;
  const id = useId().replace(/:/g, '');
  return (
    <div
      className={cx('cover', className)}
      style={{ '--h': h, background: `linear-gradient(135deg, hsl(${h} 78% 52%) 0%, hsl(${(h + 48) % 360} 70% 34%) 100%)` }}
    >
      {expo.banner && <img className="cover-image" src={expo.banner} alt="" aria-hidden="true" />}
      <svg className="cover-art" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <pattern id={`p${id}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <rect x="2" y="2" width="14" height="14" rx="3" fill="#fff" opacity=".10" />
          </pattern>
        </defs>
        <rect width="200" height="120" fill={`url(#p${id})`} />
        <circle cx="168" cy="22" r="46" fill="#fff" opacity=".10" />
        <circle cx="190" cy="100" r="30" fill="#000" opacity=".10" />
      </svg>
      {children}
    </div>
  );
}

/* ---------- Count-up number ---------- */
export function CountUp({ to, duration = 1200, suffix = '' }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setV(to);
      return undefined;
    }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration]);
  return (
    <>
      {v.toLocaleString()}
      {suffix}
    </>
  );
}
