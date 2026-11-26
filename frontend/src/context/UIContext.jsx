import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { Modal } from '../components/ui';

const UICtx = createContext(null);
export const useUI = () => useContext(UICtx);
export const useToast = () => useContext(UICtx).toast;
export const useConfirm = () => useContext(UICtx).confirm;

const ICONS = { success: CheckCircle2, error: XCircle, info: Info, warning: AlertTriangle };

export function UIProvider({ children }) {
  /* ---------- theme ---------- */
  const [theme, setTheme] = useState(() => document.documentElement.getAttribute('data-theme') || 'light');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('eventsphere.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  /* ---------- toasts ---------- */
  const [toasts, setToasts] = useState([]);
  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const push = useCallback(
    (type, title, text, opts = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-3), { id, type, title, text }]);
      setTimeout(() => remove(id), opts.duration || 4500);
    },
    [remove],
  );
  const toast = useMemo(
    () => ({
      success: (t, x, o) => push('success', t, x, o),
      error: (t, x, o) => push('error', t, x, o),
      info: (t, x, o) => push('info', t, x, o),
      warning: (t, x, o) => push('warning', t, x, o),
    }),
    [push],
  );

  /* ---------- confirm dialog ---------- */
  const [dlg, setDlg] = useState(null);
  const resolver = useRef(null);
  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setDlg(opts);
      }),
    [],
  );
  const close = (v) => {
    resolver.current?.(v);
    setDlg(null);
  };

  const value = useMemo(() => ({ toast, confirm, theme, toggleTheme }), [toast, confirm, theme, toggleTheme]);

  return (
    <UICtx.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type];
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={20} className="toast-icon" />
              <div className="toast-body">
                <strong>{t.title}</strong>
                {t.text && <span>{t.text}</span>}
              </div>
              <button className="icon-btn" onClick={() => remove(t.id)} aria-label="Dismiss">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <Modal
        open={!!dlg}
        onClose={() => close(false)}
        title={dlg?.title || 'Are you sure?'}
        size="sm"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => close(false)}>
              {dlg?.cancelText || 'Cancel'}
            </button>
            <button className={`btn ${dlg?.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
              {dlg?.confirmText || 'Confirm'}
            </button>
          </>
        }
      >
        <p className="muted">{dlg?.message}</p>
      </Modal>
    </UICtx.Provider>
  );
}
