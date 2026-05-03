import { StrictMode } from "react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type HealthResponse = {
  status: string;
  database: string;
};

type User = {
  id: string;
  email: string;
};

type AuthMode = "login" | "register";

const storedUser = localStorage.getItem("imperial:user");

function App() {
  const [health, setHealth] = useHealth();
  const [user, setUser] = useState<User | null>(() => {
    if (!storedUser) {
      return null;
    }
    try {
      return JSON.parse(storedUser) as User;
    } catch {
      localStorage.removeItem("imperial:user");
      return null;
    }
  });
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleAuth(email: string, password: string) {
    setIsSubmitting(true);
    setAuthError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/auth/${authMode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail ?? "Authentication failed.");
      }

      const nextUser = data as User;
      localStorage.setItem("imperial:user", JSON.stringify(nextUser));
      setUser(nextUser);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Authentication failed.";
      setAuthError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("imperial:user");
    setUser(null);
    setAuthMode("login");
  }

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">Imperial Capital Take-Home</p>
        <h1>Stock Watchlist</h1>
        <p className="lede">
          Increment 2 adds intentionally lightweight login and registration. The
          frontend stores the returned user locally so later watchlist calls can be
          scoped to that user.
        </p>

        <div className="status-grid">
          <StatusPill label="Frontend" value="ok" />
          <StatusPill label="Backend" value={health.status} />
          <StatusPill label="Postgres" value={health.database} />
        </div>

        {health.error ? <p className="error">{health.error}</p> : null}

        {user ? (
          <Dashboard user={user} onLogout={handleLogout} onRecheck={setHealth} />
        ) : (
          <AuthPanel
            mode={authMode}
            error={authError}
            isSubmitting={isSubmitting}
            onModeChange={setAuthMode}
            onSubmit={handleAuth}
            onRecheck={setHealth}
          />
        )}
      </section>
    </main>
  );
}

function useHealth(): [
  HealthResponse & { error?: string },
  () => void,
] {
  const [health, setHealth] = useState<HealthResponse & { error?: string }>({
    status: "checking",
    database: "checking",
  });

  const refresh = useCallback(() => {
    setHealth({ status: "checking", database: "checking" });
    fetch(`${apiBaseUrl}/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Backend returned ${response.status}`);
        }
        return response.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "Unknown error";
        setHealth({ status: "error", database: "unknown", error: message });
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return [health, refresh];
}

function StatusPill({ label, value }: { label: string; value: string }) {
  return (
    <div className={`status status-${value}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AuthPanel({
  mode,
  error,
  isSubmitting,
  onModeChange,
  onSubmit,
  onRecheck,
}: {
  mode: AuthMode;
  error: string | null;
  isSubmitting: boolean;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (email: string, password: string) => void;
  onRecheck: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(email, password);
  }

  return (
    <div className="auth-layout">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>{mode === "login" ? "Log in" : "Create account"}</h2>
        <label>
          Email
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="error">{error}</p> : null}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Working..." : mode === "login" ? "Log in" : "Register"}
        </button>
      </form>

      <div className="side-panel">
        <p>
          This take-home uses a deliberately simple auth flow: password hash lookup
          on the backend, then local user storage in the browser.
        </p>
        <button
          className="secondary"
          type="button"
          onClick={() => onModeChange(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account?" : "Already have an account?"}
        </button>
        <button className="secondary" type="button" onClick={onRecheck}>
          Recheck services
        </button>
      </div>
    </div>
  );
}

function Dashboard({
  user,
  onLogout,
  onRecheck,
}: {
  user: User;
  onLogout: () => void;
  onRecheck: () => void;
}) {
  return (
    <div className="dashboard">
      <div>
        <p className="eyebrow">Logged in</p>
        <h2>{user.email}</h2>
        <p className="muted">
          User ID: <code>{user.id}</code>
        </p>
        <p className="muted">
          Watchlist management comes next. API calls will use this stored user ID as
          the lightweight owner reference.
        </p>
      </div>
      <div className="actions">
        <button type="button" onClick={onRecheck}>
          Recheck services
        </button>
        <button className="secondary" type="button" onClick={onLogout}>
          Log out
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
