import { useState } from "react";
import { AuthMode, authenticate } from "./api/auth";
import { AuthPanel } from "./auth/AuthPanel";
import { useUser } from "./auth/useUser";
import { Dashboard } from "./dashboard/Dashboard";

export function App() {
  const { user, setUser } = useUser();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAuth(email: string, password: string) {
    setIsSubmitting(true);
    setAuthError(null);
    try {
      const next = await authenticate(authMode, email, password);
      setUser(next);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Authentication failed.";
      setAuthError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    setUser(null);
    setAuthMode("login");
  }

  if (user) {
    return (
      <main className="shell shell-app">
        <section className="card card-app">
          <header className="app-header">
            <div className="app-brand">
              <span className="brand-mark" aria-hidden="true">
                IC
              </span>
              <div>
                <p className="brand-eyebrow">Imperial Capital</p>
                <h1 className="brand-title">Watchlist</h1>
              </div>
            </div>
            <div className="app-user">
              <div className="user-meta">
                <p className="muted user-meta-label">Signed in as</p>
                <p className="user-email">{user.email}</p>
              </div>
              <button className="ghost" type="button" onClick={handleLogout}>
                Log out
              </button>
            </div>
          </header>

          <Dashboard user={user} />
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <section className="card card-auth">
        <div className="auth-hero">
          <span className="brand-mark" aria-hidden="true">
            IC
          </span>
          <p className="brand-eyebrow">Imperial Capital</p>
          <h1 className="auth-title">Stock Watchlist</h1>
          <p className="muted auth-tagline">
            Track up to ten tickers and view the last seven days of 5-minute
            price history.
          </p>
        </div>

        <AuthPanel
          mode={authMode}
          error={authError}
          isSubmitting={isSubmitting}
          onModeChange={setAuthMode}
          onSubmit={handleAuth}
        />
      </section>
    </main>
  );
}
