import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, AlertTriangle, LogIn, ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { Btn } from '../../components/ui';
import { AuthError, AuthField, AuthInfo, AuthShell, PasswordField } from './AuthShell';
import { checkEmail } from './validation';
import { cryptoAvailable } from '../../services/auth';

export default function LoginScreen() {
  const { signIn, demoAccess, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [form, setForm] = useState({ email: '', password: '', remember: false });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(null); // 'signin' | 'demo'
  const [hint, setHint] = useState(null);
  const alertRef = useRef(null);

  useEffect(() => {
    if (status === 'signed-in') navigate(from, { replace: true });
  }, [status, from, navigate]);

  useEffect(() => {
    if (formError) alertRef.current?.focus();
  }, [formError]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {
      email: checkEmail(form.email),
      password: form.password ? null : 'Enter the password for this demo account.',
    };
    setErrors(next);
    setFormError('');
    if (next.email || next.password) return;
    setBusy('signin');
    try {
      await signIn({ email: form.email, password: form.password, remember: form.remember });
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(err?.message || 'Sign-in failed in this browser.');
      setBusy(null);
    }
  };

  const enterDemo = async () => {
    setFormError('');
    setErrors({});
    setBusy('demo');
    try {
      await demoAccess({ remember: true });
      navigate(from, { replace: true });
    } catch (err) {
      setFormError(err?.message || 'The demo workspace could not be opened.');
      setBusy(null);
    }
  };

  return (
    <AuthShell
      eyebrow="Case access · local demo"
      title="Sign in to the investigation workspace"
      description="BuildScope AI keeps every case in this browser. Sign in to open your own workspace, or step straight into the worked demo case."
      footer={(
        <p className="small">
          No account yet? <Link to="/register" state={{ from }}>Create a demo account</Link>
          {' '}— it takes a name, an email, and a password you will not reuse anywhere real.
        </p>
      )}
      aside={(
        <div className="auth-aside">
          <h2>Why there is a sign-in screen at all</h2>
          <p className="small muted">
            BuildScope is a frontend prototype standing in front of a backend that does not exist yet.
            The authentication adapter is local and demo-grade: it separates workspaces per account and
            gives the product a real entry point, so the backend and FishAPI can be dropped in later
            without redesigning these screens.
          </p>
          <p className="small muted" style={{ marginBottom: 0 }}>
            It is <b>not</b> identity verification, it does <b>not</b> send email, and it cannot recover a
            forgotten password for you.
          </p>
        </div>
      )}
    >
      <div className="auth-demo-block">
        <div>
          <div className="eyebrow plain">Demo account · no password</div>
          <h2 style={{ fontSize: 17, margin: '4px 0 4px' }}>Field Analyst <span className="badge demo">DEMO</span></h2>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Opens the Kabadiwala Connect investigation with 24 saved records, labelled demo fixtures and all.
          </p>
        </div>
        <Btn variant="primary" onClick={enterDemo} disabled={Boolean(busy)} aria-busy={busy === 'demo'}>
          {busy === 'demo' ? 'Opening workspace…' : <><Sparkles size={14} aria-hidden="true" /> Enter demo workspace</>}
        </Btn>
      </div>

      <div className="auth-divider"><span>or use a local account</span></div>

      {formError && (
        <div ref={alertRef} tabIndex={-1} className="auth-alert">
          <AuthError>{formError}</AuthError>
        </div>
      )}

      {!cryptoAvailable() && (
        <div className="mb12">
          <AuthInfo>
            This browser context has no Web Crypto, so demo passwords are kept with a weaker local digest.
            Nothing is sent anywhere either way.
          </AuthInfo>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <AuthField label="Email address" error={errors.email} hint="Any address you own. It is stored in this browser only.">
          {(props) => (
            <input
              {...props}
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
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
          error={errors.password}
          autoComplete="current-password"
        />

        <div className="auth-row">
          <label className="auth-check">
            <input type="checkbox" checked={form.remember} onChange={(e) => set({ remember: e.target.checked })} />
            <span>Keep me signed in on this device for 30 days</span>
          </label>
          <Link to="/forgot" state={{ from }} className="small">Forgot password?</Link>
        </div>

        <Btn variant="primary" className="block lg" disabled={Boolean(busy)} aria-busy={busy === 'signin'} type="submit">
          {busy === 'signin' ? 'Signing in…' : <><LogIn size={15} aria-hidden="true" /> Sign in</>}
        </Btn>
      </form>

      <button type="button" className="auth-hint-toggle" onClick={() => setHint(hint ? null : 'reset')}>
        <AlertTriangle size={12} aria-hidden="true" /> What happens to what I type?
      </button>
      {hint === 'reset' && (
        <div className="auth-hint-body">
          <ul>
            <li>Email, name, and a salted password digest are written to <span className="mono">localStorage</span> on this device.</li>
            <li>Your password itself is never stored in plain text, and it never leaves the page.</li>
            <li>A “kept signed in” session is a plain local record. Anything else running on this origin could read it.</li>
            <li>Clearing site data removes the account, the session, and every local case.</li>
          </ul>
        </div>
      )}

      <p className="auth-disclaimer">
        <ShieldAlert size={12} aria-hidden="true" /> Demo authentication. No email is sent, no identity is
        verified, and no password can be recovered by email. <Link to="/register" state={{ from }}>Register a second demo account</Link> to
        see that each account keeps its own workspace.
      </p>
    </AuthShell>
  );
}
