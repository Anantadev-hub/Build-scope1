import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth as defaultAuth, workspaceKeyFor } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children, adapter = defaultAuth }) {
  const [status, setStatus] = useState('checking'); // checking | signed-out | signed-in
  const [session, setSession] = useState(null);
  const [notice, setNotice] = useState(null);
  const pendingNotice = useRef(null);

  useEffect(() => {
    let alive = true;
    adapter.getSession()
      .then((s) => {
        if (!alive) return;
        setSession(s);
        setStatus(s ? 'signed-in' : 'signed-out');
      })
      .catch(() => {
        if (!alive) return;
        setSession(null);
        setStatus('signed-out');
      });
    return () => { alive = false; };
  }, [adapter]);

  const settle = useCallback((result) => {
    setSession(result.session);
    setStatus('signed-in');
    if (result.migrated) {
      pendingNotice.current = 'An existing local workspace from an earlier build was adopted into this demo account.';
    }
    return result;
  }, []);

  const value = useMemo(() => ({
    status,
    session,
    adapter,
    accountId: session?.accountId || null,
    workspaceKey: session ? workspaceKeyFor(session.accountId) : null,
    notice,
    takeNotice() {
      const n = notice;
      setNotice(null);
      return n;
    },
    // Called by the shell on mount so a one-time message survives the redirect.
    claimPending() {
      const n = pendingNotice.current;
      pendingNotice.current = null;
      return n;
    },
    async signIn(credentials) {
      return settle(await adapter.signIn(credentials));
    },
    async register(details) {
      return settle(await adapter.register(details));
    },
    async demoAccess(options) {
      return settle(await adapter.demoAccess(options));
    },
    async requestPasswordReset(email) {
      return adapter.requestPasswordReset(email);
    },
    async resetPasswordLocal(payload) {
      return adapter.resetPasswordLocal(payload);
    },
    async signOut() {
      await adapter.signOut();
      setSession(null);
      setStatus('signed-out');
    },
  }), [status, session, adapter, notice, settle]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// Route guard. Unauthenticated visits are sent to the login screen and the
// intended destination is kept so sign-in can continue where the user stopped.
export function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'checking') {
    return (
      <div className="auth-gate" role="status" aria-live="polite">
        <span className="mono xs">CHECKING LOCAL DEMO SESSION…</span>
      </div>
    );
  }
  if (status !== 'signed-in') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
}

// Inverse guard for the auth screens: a signed-in user should not sit on a form.
export function RedirectIfSignedIn({ children }) {
  const { status, session } = useAuth();
  const location = useLocation();
  const target = location.state?.from || '/';
  if (status === 'checking') {
    return (
      <div className="auth-gate" role="status" aria-live="polite">
        <span className="mono xs">CHECKING LOCAL DEMO SESSION…</span>
      </div>
    );
  }
  if (status === 'signed-in' && session) return <Navigate to={target} replace />;
  return children;
}
