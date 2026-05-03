import { useState } from "react";
import { AuthMode, authenticate } from "./api/auth";
import { AuthPanel } from "./auth/AuthPanel";
import { useHealth } from "./auth/useHealth";
import { useUser } from "./auth/useUser";
import { Dashboard } from "./dashboard/Dashboard";
import { StatusPill } from "./shared/StatusPill";

export function App() {
  const { user, setUser } = useUser();
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { health, refresh: refreshHealth } = useHealth();

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
      <section className="card">
        <p className="eyebrow">Imperial Capital Take-Home</p>
        <h1>Stock Watchlist</h1>
        <p className="lede">
          Manage your private watchlist of up to ten tickers and view the last
          seven days of 5-minute price history for any ticker on it.
        </p>

        <div className="status-grid">
          <StatusPill label="Frontend" value="ok" />
          <StatusPill label="Backend" value={health.status} />
          <StatusPill label="Postgres" value={health.database} />
        </div>

        {health.error ? <p className="error">{health.error}</p> : null}

        <AuthPanel
          mode={authMode}
          error={authError}
          isSubmitting={isSubmitting}
          onModeChange={setAuthMode}
          onSubmit={handleAuth}
          onRecheck={refreshHealth}
        />
      </section>
    </main>
  );
}
