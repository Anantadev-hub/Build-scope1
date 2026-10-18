import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { Btn } from '../../components/ui';
import { AuthError, AuthField, AuthShell, PasswordField, RuleList } from './AuthShell';
import { checkConfirm, checkEmail, checkName, checkPassword, checkTerms } from './validation';

export default function RegisterScreen() {
  const { register, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [touched, setTouched] = useState({});
  const alertRef = useRef(null);

  useEffect(() => {
    if (status === 'signed-in') navigate(from, { replace: true });
  }, [status, from, navigate]);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const blur = (field) => setTouched((t) => ({ ...t, [field]: true }));

  // Inline validation appears once a field has been visited, never while typing a blank value.
  const fieldErrors = {
    name: touched.name ? checkName(form.name) : null,
    email: touched.email ? checkEmail(form.email) : null,
    password: touched.password ? checkPassword(form.password) : null,
    confirm: touched.confirm ? checkConfirm(form.password, form.confirm) : null,
    terms: touched.terms ? checkTerms(form.terms) : null,
  };
  const show = (key) => errors[key] || fieldErrors[key];

  const submit = async (e) => {
    e.preventDefault();
    const next = {
      name: checkName(form.name),
      email: checkEmail(form.email),
      password: checkPassword(form.password),
      confirm: checkConfirm(form.password, form.confirm),
      terms: checkTerms(form.terms),
    };
    setErrors(next);
    setTouched({ name: true, email: true, password: true, confirm: true, terms: true });
    setFormError('');
    if (Object.values(next).some(Boolean)) return;

    setBusy(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password, remember: true });
      navigate(from === '/login' ? '/' : from, { replace: true });
    } catch (err) {
      setFormError(err?.message || 'The demo account could not be created in this browser.');
      setBusy(false);
    }
  };

  return (
    <AuthShell
      eyebrow="New workspace · local demo"
      title="Create a demo account"
      description="One local account per workspace. Nothing is emailed and nothing is verified — this exists so the product has a real entry point."
      footer={(
        <p className="small">
          Already have one? <Link to="/login" state={{ from }}>Sign in</Link> instead.
        </p>
      )}
      aside={(
        <div className="auth-aside">
          <h2>What this account does</h2>
          <ul className="small muted">
            <li>Keeps its own projects, evidence, and progress, separate from other accounts in this browser.</li>
            <li>Signing out and back in returns you to your own workspace, never to someone else's.</li>
            <li>Stores a salted PBKDF2 digest of the password — never the password itself.</li>
            <li>Cannot be recovered by email, because there is no mail service in this build.</li>
          </ul>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Before a real launch, authentication must move to the server, with httpOnly session cookies and
            server-side hashing. The screens are ready for that swap; this adapter is not.
          </p>
        </div>
      )}
    >
      {formError && (
        <div ref={alertRef} tabIndex={-1} className="auth-alert">
          <AuthError>{formError}</AuthError>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <AuthField
          label="Full name"
          error={show('name')}
          hint="Shown in the top bar and on the Buildability Passport."
        >
          {(props) => (
            <input
              {...props}
              type="text"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              onBlur={() => blur('name')}
              autoComplete="name"
              placeholder="Ada Okonkwo"
              aria-required="true"
            />
          )}
        </AuthField>

        <AuthField
          label="Email address"
          error={show('email')}
          hint="Used only as the local account key. No mail is sent to it."
        >
          {(props) => (
            <input
              {...props}
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
              onBlur={() => blur('email')}
              autoComplete="email"
              placeholder="analyst@example.com"
              aria-required="true"
            />
          )}
        </AuthField>

        <PasswordField
          label="Password"
          value={form.password}
          onChange={(v) => set({ password: v })}
          error={show('password')}
          autoComplete="new-password"
          showMeter
        />
        <div className="auth-rules-wrap">
          <span className="mono xs muted">REQUIREMENTS</span>
          <RuleList password={form.password} confirm={form.confirm} />
        </div>

        <PasswordField
          label="Confirm password"
          value={form.confirm}
          onChange={(v) => set({ confirm: v })}
          error={show('confirm')}
          autoComplete="new-password"
        />

        <div className={`auth-terms ${show('terms') ? 'has-error' : ''}`}>
          <label className="auth-check">
            <input
              type="checkbox"
              checked={form.terms}
              onChange={(e) => { set({ terms: e.target.checked }); blur('terms'); }}
              aria-required="true"
            />
            <span>
              I understand this is a local demo workspace: my account, password digest, and projects are stored
              in this browser, nothing is emailed, and clearing site data removes everything.
            </span>
          </label>
          {show('terms') && <span className="auth-error">{show('terms')}</span>}
        </div>

        <Btn variant="primary" className="block lg" disabled={busy} aria-busy={busy} type="submit">
          {busy ? 'Creating demo account…' : <><UserPlus size={15} aria-hidden="true" /> Create demo account</>}
        </Btn>
      </form>
    </AuthShell>
  );
}
