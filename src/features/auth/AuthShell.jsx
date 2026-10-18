import React, { useId, useState } from 'react';
import { Eye, EyeOff, AlertTriangle, Check, ShieldAlert, Lock, WifiOff } from 'lucide-react';
import { Notice } from '../../components/ui';
import { PASSWORD_RULES, passwordStrength } from './validation';

const PANEL_POINTS = [
  ['01', 'No server, no secrets', 'Accounts and projects live in this browser only. No request leaves the page.'],
  ['02', 'Digest, never plaintext', 'Passwords are stored as a salted PBKDF2 digest. The plaintext is not kept.'],
  ['03', 'Not production security', 'A local demo session can be read by anything running on this origin.'],
];

export function AuthShell({ eyebrow, title, description, children, footer, aside }) {
  return (
    <div className="auth">
      <section className="auth-panel" aria-hidden="true">
        <div className="auth-brand">
          <span className="brand-mark">BS</span>
          <span>
            <span className="brand-name">BuildScope<span style={{ color: 'var(--orange)' }}>_</span>AI</span>
            <span className="brand-sub">Field investigation unit</span>
          </span>
        </div>

        <p className="auth-panel-lead">
          Investigate before you build: what already exists, what you can realistically deliver, and what
          evidence will prove it works.
        </p>

        <ol className="auth-protocol">
          {PANEL_POINTS.map(([n, t, d]) => (
            <li key={n}>
              <span className="mono">{n}</span>
              <span>
                <b>{t}</b>
                <em>{d}</em>
              </span>
            </li>
          ))}
        </ol>

        {aside && <div className="auth-panel-aside">{aside}</div>}

        <div className="auth-panel-foot">
          <span><WifiOff size={11} /> NO NETWORK CALLS</span>
          <span><Lock size={11} /> LOCAL DEMO SESSION</span>
          <span><ShieldAlert size={11} /> DEMO DATA IS LABELLED</span>
        </div>
      </section>

      <section className="auth-forms" aria-labelledby="auth-title">
        <div className="auth-card">
          {eyebrow && <div className="eyebrow">{eyebrow}</div>}
          <h1 id="auth-title">{title}</h1>
          {description && <p className="auth-desc">{description}</p>}
          {children}
          {footer && <div className="auth-card-foot">{footer}</div>}
        </div>
      </section>
    </div>
  );
}

// `children` is a render function that receives the id and aria wiring, so the
// label, the hint, and the error text always describe the real form control.
export function AuthField({ label, hint, error, children, id: idProp, mono }) {
  const auto = useId();
  const id = idProp || auto;
  const describedBy = error ? `${id}-err` : (hint ? `${id}-hint` : undefined);
  const props = {
    id,
    'aria-describedby': describedBy,
    'aria-invalid': error ? 'true' : undefined,
  };
  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={id}>{label}{mono && <span className="mono auth-mono-tag">{mono}</span>}</label>
      {typeof children === 'function' ? children(props) : children}
      {hint && !error && <span className="hint" id={`${id}-hint`}>{hint}</span>}
      {error && <span className="auth-error" id={`${id}-err`}><AlertTriangle size={12} aria-hidden="true" /> {error}</span>}
    </div>
  );
}

export function PasswordField({ label, value, onChange, error, hint, autoComplete = 'current-password', showMeter = false }) {
  const [visible, setVisible] = useState(false);
  return (
    <AuthField label={label} error={error} hint={hint}>
      {(props) => (
        <>
          <div className="auth-input-wrap">
            <input
              {...props}
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              autoComplete={autoComplete}
            />
            <button
              type="button"
              className="auth-eye"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            </button>
          </div>
          {showMeter && value ? <PasswordMeter value={value} /> : null}
        </>
      )}
    </AuthField>
  );
}

function PasswordMeter({ value }) {
  const strength = passwordStrength(value);
  return (
    <div className="auth-meter" aria-live="polite">
      <span className="mono">STRENGTH</span>
      <span className={`auth-meter-bar ${strength.key}`} aria-hidden="true">
        {PASSWORD_RULES.map((r) => <i key={r.key} className={r.test(value) ? 'on' : ''} />)}
      </span>
      <span className="xs muted">{strength.label}</span>
    </div>
  );
}

export function RuleList({ password, confirm }) {
  const rules = [
    ...PASSWORD_RULES.map((r) => ({ key: r.key, label: r.label, ok: r.test(password) })),
    { key: 'match', label: 'Both passwords match', ok: Boolean(confirm) && confirm === password },
  ];
  return (
    <ul className="auth-rules">
      {rules.map((r) => (
        <li key={r.key} className={r.ok ? 'ok' : ''}>
          <span className="auth-rule-box" aria-hidden="true">{r.ok ? <Check size={10} /> : ''}</span>
          {r.label}
          <span className="sr-only">{r.ok ? ' — met' : ' — not met yet'}</span>
        </li>
      ))}
    </ul>
  );
}

export function AuthError({ children }) {
  if (!children) return null;
  return <Notice tone="danger">{children}</Notice>;
}

export function AuthInfo({ children }) {
  if (!children) return null;
  return <Notice>{children}</Notice>;
}

export function AuthSuccess({ children }) {
  if (!children) return null;
  return (
    <div className="notice ok" role="status">
      <Check size={15} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
