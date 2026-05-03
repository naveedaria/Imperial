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

type WatchlistItem = {
  id: string;
  ticker: string;
  created_at: string;
};

type PricePoint = {
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

type PriceHistoryResponse = {
  ticker: string;
  interval: string;
  period: string;
  points: PricePoint[];
  warning: string | null;
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
          Manage your private watchlist of up to ten tickers and view the last seven
          days of 5-minute price history for any ticker on it.
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
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [ticker, setTicker] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const loadWatchlist = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetch(`${apiBaseUrl}/watchlist`, {
      headers: { "X-User-Id": user.id },
    })
      .then((response) => parseApiResponse<WatchlistItem[]>(response))
      .then(setWatchlist)
      .catch((loadError: unknown) => {
        const errorMessage = loadError instanceof Error ? loadError.message : "Could not load watchlist.";
        setError(errorMessage);
      })
      .finally(() => setIsLoading(false));
  }, [user.id]);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  async function handleAddTicker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const item = await fetch(`${apiBaseUrl}/watchlist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-User-Id": user.id,
        },
        body: JSON.stringify({ ticker }),
      }).then((response) => parseApiResponse<WatchlistItem>(response));

      setWatchlist((current) => [...current, item]);
      setTicker("");
      setMessage(`Added ${item.ticker}.`);
    } catch (addError: unknown) {
      const errorMessage = addError instanceof Error ? addError.message : "Could not add ticker.";
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveTicker(nextTicker: string) {
    setError(null);
    setMessage(null);

    try {
      await fetch(`${apiBaseUrl}/watchlist/${encodeURIComponent(nextTicker)}`, {
        method: "DELETE",
        headers: { "X-User-Id": user.id },
      }).then((response) => parseApiResponse<void>(response));

      setWatchlist((current) => current.filter((item) => item.ticker !== nextTicker));
      setMessage(`Removed ${nextTicker}.`);
      setSelectedTicker((current) => (current === nextTicker ? null : current));
    } catch (removeError: unknown) {
      const errorMessage = removeError instanceof Error ? removeError.message : "Could not remove ticker.";
      setError(errorMessage);
    }
  }

  return (
    <div className="dashboard">
      <div>
        <p className="eyebrow">Logged in</p>
        <h2>{user.email}</h2>
        <p className="muted">
          User ID: <code>{user.id}</code>
        </p>
        <p className="muted">
          This take-home uses your stored user ID as the lightweight owner reference.
        </p>
      </div>

      <section className="watchlist-panel">
        <div className="watchlist-header">
          <div>
            <h3>Watchlist</h3>
            <p className="muted">{watchlist.length}/10 tickers</p>
          </div>
          <button className="secondary" type="button" onClick={loadWatchlist}>
            Refresh
          </button>
        </div>

        <form className="ticker-form" onSubmit={handleAddTicker}>
          <label>
            Ticker
            <input
              maxLength={10}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="AAPL"
              required
              type="text"
              value={ticker}
            />
          </label>
          <button type="submit" disabled={isSubmitting || watchlist.length >= 10}>
            {isSubmitting ? "Adding..." : "Add ticker"}
          </button>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {isLoading ? (
          <p className="muted">Loading watchlist...</p>
        ) : watchlist.length === 0 ? (
          <p className="empty-state">No tickers yet. Add one to start your watchlist.</p>
        ) : (
          <ul className="ticker-list">
            {watchlist.map((item) => (
              <li key={item.id} className={selectedTicker === item.ticker ? "selected" : undefined}>
                <button
                  className="ticker-select"
                  type="button"
                  onClick={() => setSelectedTicker(item.ticker)}
                  aria-pressed={selectedTicker === item.ticker}
                >
                  <strong>{item.ticker}</strong>
                  <span className="muted">View prices</span>
                </button>
                <button className="secondary" type="button" onClick={() => handleRemoveTicker(item.ticker)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedTicker ? (
        <PricePanel
          key={selectedTicker}
          ticker={selectedTicker}
          onClose={() => setSelectedTicker(null)}
        />
      ) : watchlist.length > 0 ? (
        <p className="empty-state">Select a ticker to view its 7-day, 5-minute price history.</p>
      ) : null}

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

function PricePanel({ ticker, onClose }: { ticker: string; onClose: () => void }) {
  const [history, setHistory] = useState<PriceHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadPrices = useCallback(() => {
    setIsLoading(true);
    setError(null);
    fetch(`${apiBaseUrl}/prices/${encodeURIComponent(ticker)}`)
      .then((response) => parseApiResponse<PriceHistoryResponse>(response))
      .then(setHistory)
      .catch((loadError: unknown) => {
        const message = loadError instanceof Error ? loadError.message : "Could not load price history.";
        setError(message);
      })
      .finally(() => setIsLoading(false));
  }, [ticker]);

  useEffect(() => {
    loadPrices();
  }, [loadPrices]);

  const recent = history?.points.slice(-50).reverse() ?? [];
  const latest = history?.points.at(-1) ?? null;
  const earliest = history?.points.at(0) ?? null;
  const change =
    latest && earliest && latest.close != null && earliest.close != null
      ? latest.close - earliest.close
      : null;
  const changePct =
    change != null && earliest?.close ? (change / earliest.close) * 100 : null;

  return (
    <section className="price-panel">
      <div className="price-header">
        <div>
          <p className="eyebrow">Price history</p>
          <h3>{ticker}</h3>
          {history ? (
            <p className="muted">
              {history.period} at {history.interval} - {history.points.length} points
            </p>
          ) : null}
        </div>
        <div className="actions">
          <button className="secondary" type="button" onClick={loadPrices} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {history?.warning ? <p className="warning">{history.warning}</p> : null}

      {isLoading && !history ? (
        <p className="muted">Loading price history...</p>
      ) : history && history.points.length > 0 ? (
        <>
          <div className="price-summary">
            <SummaryStat label="Latest close" value={formatPrice(latest?.close)} />
            <SummaryStat label="Latest time" value={formatTimestamp(latest?.timestamp)} />
            <SummaryStat
              label="Change"
              value={change != null ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}` : "-"}
              tone={change != null ? (change >= 0 ? "positive" : "negative") : undefined}
            />
            <SummaryStat
              label="Change %"
              value={changePct != null ? `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%` : "-"}
              tone={changePct != null ? (changePct >= 0 ? "positive" : "negative") : undefined}
            />
          </div>

          <div className="price-table-scroll">
            <table className="price-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Open</th>
                  <th>High</th>
                  <th>Low</th>
                  <th>Close</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((point) => (
                  <tr key={point.timestamp}>
                    <td>{formatTimestamp(point.timestamp)}</td>
                    <td>{formatPrice(point.open)}</td>
                    <td>{formatPrice(point.high)}</td>
                    <td>{formatPrice(point.low)}</td>
                    <td>{formatPrice(point.close)}</td>
                    <td>{point.volume?.toLocaleString() ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {history.points.length > recent.length ? (
            <p className="muted">Showing most recent {recent.length} of {history.points.length} points.</p>
          ) : null}
        </>
      ) : !error ? (
        <p className="empty-state">No price points to display.</p>
      ) : null}
    </section>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  return (
    <div className={`summary-stat${tone ? ` summary-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatPrice(value: number | null | undefined): string {
  if (value == null) {
    return "-";
  }
  return value.toFixed(2);
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

async function parseApiResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.detail ?? "Request failed.");
  }
  return data as T;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
