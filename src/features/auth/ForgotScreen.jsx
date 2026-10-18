import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KeyRound, MailWarning, RefreshCw } from 'lucide-react';
import { useAuth } from '../../app/auth';
import { Btn } from '../../components/ui';
import { AuthField, AuthInfo, AuthShell, AuthSuccess, PasswordField } from './AuthShell';
import { checkConfirm, checkEmail, checkPassword } from './validation';

export default function ForgotScreen() {
  const { requestPasswordReset, resetPasswordLocal } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requested, setRequested] = useState(null);
  const [reset, setReset] = useState({ open: false, password: '', confirm: '', error: '', busy: false, done: false });

  const submit = async (e) => {
    e.preventDefault();
    const emailError = checkEmail(email);
    setError(emailError || '');
    if (emailError) return;
    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      setRequested(result);
    } catch (err) {
      setError(err?.message || 'The local reset request could not be recorded.');
    } finally {
      setBusy(false);
    }
  };

  const runLocalReset = async (e) => {
    e.preventDefault();
    const next = { password: checkPassword(reset.password), confirm: checkConfirm(reset.password, reset.confirm) };
    if (next.password || next.confirm) {
      setReset((r) => ({ ...r, error: next.password || next.confirm }));
      return;
    }
    setReset((r) => ({ ...r, busy: true, error: '' }));
    try {
      await resetPasswordLocal({ email, password: reset.password });
      setReset({ open: true, password: '', confirm: '', error: '', busy: false, done: true });
    } catch (err) {
      setReset((r) => ({ ...r, busy: false, error: err?.message || 'The local password could not be replaced.' }));
    }
  };

  return (
    <AuthShell
      eyebrow="Recovery · not available by email"
      title="Reset a local demo password"
      description="There is no mail service behind this build, so no reset link can be sent. Here is what that means, and the one thing that can actually be done locally."
      footer={(
        <p className="small">
          <Link to="/login" state={{ from }}>Back to sign in</Link>
          {' '}· <Link to="/register" state={{ from }}>Create a demo account</Link>
        </p>
      )}
      aside={(
        <div className="auth-aside">
          <h2>What a real build needs here</h2>
          <ul className="small muted">
            <li>POST /api/auth/password/request — always answers 202, so it cannot be used to discover which emails exist.</li>
            <li>A single-use, short-lived token emailed to the account address.</li>
            <li>POST /api/auth/password/reset — validates the token server-side, then re-hashes the new password.</li>
            <li>Session invalidation for every other device after a successful reset.</li>
          </ul>
          <p className="small muted" style={{ marginBottom: 0 }}>
            None of those steps exist in this prototype. The local reset below replaces the digest stored in
            this browser and nothing else.
          </p>
        </div>
      )}
    >
      {!requested && (
        <form onSubmit={submit} noValidate>
          <AuthField
            label="Account email"
            error={error}
            hint="Used only to look for a demo account in this browser."
          >
            {(props) => (
              <input
                {...props}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="analyst@example.com"
                aria-required="true"
              />
            )}
          </AuthField>
          <Btn variant="primary" className="block lg" disabled={busy} aria-busy={busy} type="submit">
            {busy ? 'Checking this browser…' : <><MailWarning size={15} aria-hidden="true" /> Request a reset</>}
          </Btn>
        </form>
      )}

      {requested && (
        <div className="auth-recovery">
          <AuthInfo>
            <b>{requested.message}</b>
            {requested.accountExists
              ? ' A demo account with that email exists in this browser, so you can replace its password locally below.'
              : ' No demo account with that email exists in this browser, so there is nothing to reset. Register an account first.'}
          </AuthInfo>

          {requested.accountExists && !reset.done && (
            <>
              <p className="small muted">
                Replacing the password locally is not email recovery. It skips verification entirely, which is
                exactly what a real build must never do.
              </p>
              {!reset.open
                ? (
                  <Btn variant="ghost" onClick={() => setReset((r) => ({ ...r, open: true }))}>
                    <RefreshCw size={14} aria-hidden="true" /> Use the local demo reset
                  </Btn>
                )
                : (
                  <form onSubmit={runLocalReset} noValidate>
                    <PasswordField
                      label="New password"
                      value={reset.password}
                      onChange={(v) => setReset((r) => ({ ...r, password: v }))}
                      autoComplete="new-password"
                      showMeter
                      error={reset.error}
                    />
                    <PasswordField
                      label="Confirm new password"
                      value={reset.confirm}
                      onChange={(v) => setReset((r) => ({ ...r, confirm: v }))}
                      autoComplete="new-password"
                    />
                    <Btn variant="primary" className="block lg" disabled={reset.busy} aria-busy={reset.busy} type="submit">
                      {reset.busy ? 'Replacing locally…' : <><KeyRound size={15} aria-hidden="true" /> Replace local password</>}
                    </Btn>
                  </form>
                )}
            </>
          )}

          {reset.done && (
            <>
              <AuthSuccess>The password digest in this browser has been replaced. No email was sent.</AuthSuccess>
              <Btn variant="primary" onClick={() => navigate('/login', { replace: true })}>Return to sign in</Btn>
            </>
          )}

          {!reset.done && (
            <button type="button" className="auth-hint-toggle" onClick={() => setRequested(null)}>
              Use a different email
            </button>
          )}
        </div>
      )}

    </AuthShell>
  );
}
