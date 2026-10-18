import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { X, AlertTriangle, ExternalLink as ExternalIcon, Info, Inbox } from 'lucide-react';
import { safeHref } from '../lib/format';

export function Btn({ to, variant = '', size = '', className = '', children, ...rest }) {
  const cls = ['btn', variant, size, className].filter(Boolean).join(' ');
  if (to) return <Link to={to} className={cls} {...rest}>{children}</Link>;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

export function Badge({ tone = '', children, title, className = '' }) {
  return <span className={`badge ${tone} ${className}`} title={title}>{children}</span>;
}

export function StatusBadge({ meta, className = '' }) {
  if (!meta) return null;
  return <Badge tone={meta.cls || ''} className={className}>{meta.label}</Badge>;
}

export function PageHead({ eyebrow, title, description, actions }) {
  return (
    <header className="page-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, eyebrow, actions, children, className = '', flush = false, id }) {
  return (
    <section className={`card ${flush ? 'flush' : ''} ${className}`} id={id}>
      {(title || actions) && (
        <header className="card-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            {title && <h3>{title}</h3>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : 'card-body'}>{children}</div>
    </section>
  );
}

export function DemoBanner({ title = 'DEMO DATA — NOT LIVE SEARCHED', children, variant = 'demo' }) {
  return (
    <div className={`demo-banner ${variant}`} role="note">
      <AlertTriangle size={15} aria-hidden="true" />
      <div><b>{title}</b>{children ? <> — {children}</> : null}</div>
    </div>
  );
}

export function Notice({ tone = '', icon: Icon = Info, children }) {
  const I = tone === 'warn' || tone === 'danger' ? AlertTriangle : Icon;
  return (
    <div className={`notice ${tone}`} role={tone === 'danger' ? 'alert' : 'note'}>
      <I size={15} aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ title, children, action, icon = Inbox }) {
  const Icon = icon;
  return (
    <div className="empty">
      <span className="e-icon"><Icon size={22} aria-hidden="true" /></span>
      <h4>{title}</h4>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Field({ label, hint, required, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}{required && <span className="req" aria-hidden="true">*</span>}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Track({ done, total, tone = '', thin = false, label }) {
  const segments = Math.max(total, 1);
  return (
    <div className="track-wrap">
      <div className={`track ${thin ? 'thin' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={label || `Progress ${done} of ${total}`}>
        {Array.from({ length: segments }).map((_, i) => (
          <span key={i} className={i < done ? `on ${tone}` : ''} />
        ))}
      </div>
      <span className="track-val">{done}/{total}</span>
    </div>
  );
}

export function SegTabs({ value, onChange, options, label = 'View' }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)} type="button">
          {o.label}{o.count != null ? <span className="count"> {o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ label, value, sub }) {
  return (
    <div className="kpi">
      <div className="k-label">{label}</div>
      <div className="k-val">{value}</div>
      {sub && <div className="k-sub">{sub}</div>}
    </div>
  );
}

export function ExternalLink({ href, children, emptyLabel = 'No live link' }) {
  const safe = safeHref(href);
  if (!safe) return <span className="muted small">{emptyLabel}</span>;
  return (
    <a href={safe} target="_blank" rel="noopener noreferrer nofollow" className="link-out">
      {children || safe} <ExternalIcon size={11} aria-hidden="true" />
    </a>
  );
}

export function Modal({ open, onClose, title, eyebrow, children, footer, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const el = ref.current?.querySelector('input, textarea, select, button');
      if (el) el.focus();
    }, 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h3>{title}</h3>
          </div>
          <Btn variant="quiet" onClick={onClose} aria-label="Close dialog"><X size={16} /></Btn>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Confirm({ open, onClose, onConfirm, title, children, confirmLabel = 'Confirm', danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={(
      <>
        <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        <Btn variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn>
      </>
    )}>
      {children}
    </Modal>
  );
}

export function Toasts({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className="toast" role="status">
          <span className="xp">{t.tone === 'achievement' ? 'ACHIEVEMENT' : t.tone === 'xp' ? 'XP' : 'LOG'}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button type="button" className="btn quiet xs" onClick={() => onDismiss(t.id)} aria-label="Dismiss">×</button>
        </div>
      ))}
    </div>
  );
}

export function SectionRule({ children }) {
  return <div className="section-rule"><span>{children}</span></div>;
}

export function Hint({ children }) {
  return <div className="notice" style={{ fontSize: 12 }}><Info size={14} aria-hidden="true" /><div>{children}</div></div>;
}

export function MissingCase({ kind = 'case' }) {
  const navigate = useNavigate();
  return (
    <div className="card">
      <EmptyState
        icon={Inbox}
        title={kind === 'case' ? 'This case file could not be found' : 'Nothing selected'}
        action={<div className="row" style={{ justifyContent: 'center' }}>
          <Btn variant="primary" to="/projects">Go to My Projects</Btn>
          <Btn variant="ghost" onClick={() => navigate('/projects/new')}>Start a new case</Btn>
        </div>}
      >
        The case may have been deleted from this browser, or the link may belong to a different local workspace.
      </EmptyState>
    </div>
  );
}
