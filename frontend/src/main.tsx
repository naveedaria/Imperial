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
  const [pricesByTicker, setPricesByTicker] = useState<Record<string, PriceHistoryResponse>>({});
  const [priceErrors, setPriceErrors] = useState<Record<string, string>>({});
  const [loadingTickers, setLoadingTickers] = useState<Set<string>>(new Set());

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

  const loadPricesFor = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) {
      return;
    }
    setLoadingTickers((current) => {
      const next = new Set(current);
      for (const t of tickers) {
        next.add(t);
      }
      return next;
    });

    await Promise.all(
      tickers.map(async (nextTicker) => {
        try {
          const response = await fetch(`${apiBaseUrl}/prices/${encodeURIComponent(nextTicker)}`);
          const data = await parseApiResponse<PriceHistoryResponse>(response);
          setPricesByTicker((current) => ({ ...current, [nextTicker]: data }));
          setPriceErrors((current) => {
            if (!(nextTicker in current)) {
              return current;
            }
            const { [nextTicker]: _removed, ...rest } = current;
            return rest;
          });
        } catch (priceError: unknown) {
          const detail = priceError instanceof Error ? priceError.message : "Could not load prices.";
          setPriceErrors((current) => ({ ...current, [nextTicker]: detail }));
        } finally {
          setLoadingTickers((current) => {
            const next = new Set(current);
            next.delete(nextTicker);
            return next;
          });
        }
      }),
    );
  }, []);

  useEffect(() => {
    loadWatchlist();
  }, [loadWatchlist]);

  useEffect(() => {
    const tickerSet = new Set(watchlist.map((item) => item.ticker));

    setPricesByTicker((current) => {
      const next: Record<string, PriceHistoryResponse> = {};
      for (const t of tickerSet) {
        if (current[t]) {
          next[t] = current[t];
        }
      }
      return next;
    });
    setPriceErrors((current) => {
      const next: Record<string, string> = {};
      for (const t of tickerSet) {
        if (current[t]) {
          next[t] = current[t];
        }
      }
      return next;
    });

    if (tickerSet.size > 0) {
      loadPricesFor(Array.from(tickerSet));
    }
  }, [watchlist, loadPricesFor]);

  const refreshAllPrices = useCallback(() => {
    if (watchlist.length === 0) {
      return;
    }
    loadPricesFor(watchlist.map((item) => item.ticker));
  }, [watchlist, loadPricesFor]);

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
          <div className="actions">
            <button
              className="secondary"
              type="button"
              onClick={refreshAllPrices}
              disabled={watchlist.length === 0 || loadingTickers.size > 0}
            >
              {loadingTickers.size > 0 ? "Refreshing prices..." : "Refresh prices"}
            </button>
            <button className="secondary" type="button" onClick={loadWatchlist}>
              Reload list
            </button>
          </div>
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
            {watchlist.map((item) => {
              const summary = summarizeHistory(pricesByTicker[item.ticker]);
              const isLoadingPrice = loadingTickers.has(item.ticker);
              const priceError = priceErrors[item.ticker];
              return (
                <li key={item.id} className={selectedTicker === item.ticker ? "selected" : undefined}>
                  <button
                    className="ticker-select"
                    type="button"
                    onClick={() => setSelectedTicker(item.ticker)}
                    aria-pressed={selectedTicker === item.ticker}
                  >
                    <span className="ticker-symbol">
                      <strong>{item.ticker}</strong>
                      {isLoadingPrice && !summary ? (
                        <span className="muted">Loading...</span>
                      ) : null}
                    </span>
                    {summary ? (
                      <span className="ticker-summary">
                        <span className="ticker-price">{formatPrice(summary.latestClose)}</span>
                        <span className={`ticker-change ${summary.changeTone}`}>
                          {summary.changeText}
                        </span>
                      </span>
                    ) : priceError ? (
                      <span className="muted">No data</span>
                    ) : pricesByTicker[item.ticker]?.warning ? (
                      <span className="muted">{pricesByTicker[item.ticker].warning}</span>
                    ) : null}
                  </button>
                  <button className="secondary" type="button" onClick={() => handleRemoveTicker(item.ticker)}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedTicker ? (
        <PricePanel
          ticker={selectedTicker}
          history={pricesByTicker[selectedTicker] ?? null}
          error={priceErrors[selectedTicker] ?? null}
          isLoading={loadingTickers.has(selectedTicker)}
          onRefresh={() => loadPricesFor([selectedTicker])}
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

function PricePanel({
  ticker,
  history,
  error,
  isLoading,
  onRefresh,
  onClose,
}: {
  ticker: string;
  history: PriceHistoryResponse | null;
  error: string | null;
  isLoading: boolean;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const recent = history?.points.slice(-50).reverse() ?? [];
  const summary = summarizeHistory(history);

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
          <button className="secondary" type="button" onClick={onRefresh} disabled={isLoading}>
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
            <SummaryStat label="Latest close" value={formatPrice(summary?.latestClose)} />
            <SummaryStat label="Latest time" value={formatTimestamp(summary?.latestTimestamp)} />
            <SummaryStat
              label="Change"
              value={summary?.changeAbs != null ? `${summary.changeAbs >= 0 ? "+" : ""}${summary.changeAbs.toFixed(2)}` : "-"}
              tone={summary?.changeTone === "ticker-change-up" ? "positive" : summary?.changeTone === "ticker-change-down" ? "negative" : undefined}
            />
            <SummaryStat
              label="Change %"
              value={summary?.changePct != null ? `${summary.changePct >= 0 ? "+" : ""}${summary.changePct.toFixed(2)}%` : "-"}
              tone={summary?.changeTone === "ticker-change-up" ? "positive" : summary?.changeTone === "ticker-change-down" ? "negative" : undefined}
            />
          </div>

          <PriceChart points={history.points} />

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

type HistorySummary = {
  latestClose: number | null;
  latestTimestamp: string | null;
  changeAbs: number | null;
  changePct: number | null;
  changeText: string;
  changeTone: "ticker-change-up" | "ticker-change-down" | "ticker-change-flat";
};

function summarizeHistory(history: PriceHistoryResponse | null | undefined): HistorySummary | null {
  if (!history || history.points.length === 0) {
    return null;
  }

  const closes = history.points.filter((point) => point.close != null);
  if (closes.length === 0) {
    return null;
  }

  const earliest = closes[0];
  const latest = closes[closes.length - 1];
  const earliestClose = earliest.close as number;
  const latestClose = latest.close as number;
  const changeAbs = latestClose - earliestClose;
  const changePct = earliestClose !== 0 ? (changeAbs / earliestClose) * 100 : null;

  const tone =
    changeAbs > 0
      ? "ticker-change-up"
      : changeAbs < 0
        ? "ticker-change-down"
        : "ticker-change-flat";
  const sign = changeAbs > 0 ? "+" : changeAbs < 0 ? "-" : "";
  const absChange = Math.abs(changeAbs).toFixed(2);
  const pctText = changePct != null ? `${sign}${Math.abs(changePct).toFixed(2)}%` : "-";

  return {
    latestClose,
    latestTimestamp: latest.timestamp,
    changeAbs,
    changePct,
    changeText: `${sign}${absChange} (${pctText})`,
    changeTone: tone,
  };
}

function PriceChart({ points }: { points: PricePoint[] }) {
  const usable = points.filter((point) => point.open != null && point.close != null);
  if (usable.length < 2) {
    return null;
  }

  const bars = usable.slice(-60);
  const closes = bars.map((bar) => bar.close as number);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const viewBoxWidth = 640;
  const viewBoxHeight = 240;
  const chartLeft = 8;
  const chartRight = viewBoxWidth - 56;
  const chartTop = 16;
  const chartBottom = viewBoxHeight - 32;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;
  const slotWidth = chartWidth / bars.length;
  const barWidth = Math.max(slotWidth - 1.5, 1);
  const mid = (min + max) / 2;

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label="Bar chart of close prices"
    >
      <line x1={chartLeft} x2={chartRight} y1={chartTop} y2={chartTop} className="chart-grid" />
      <line
        x1={chartLeft}
        x2={chartRight}
        y1={chartTop + chartHeight / 2}
        y2={chartTop + chartHeight / 2}
        className="chart-grid"
      />
      <line x1={chartLeft} x2={chartRight} y1={chartBottom} y2={chartBottom} className="chart-grid" />

      <text x={chartRight + 6} y={chartTop + 4} className="chart-label">
        {max.toFixed(2)}
      </text>
      <text x={chartRight + 6} y={chartTop + chartHeight / 2 + 4} className="chart-label">
        {mid.toFixed(2)}
      </text>
      <text x={chartRight + 6} y={chartBottom + 4} className="chart-label">
        {min.toFixed(2)}
      </text>

      {bars.map((bar, index) => {
        const close = bar.close as number;
        const open = bar.open as number;
        const normalized = (close - min) / range;
        const barHeight = Math.max(normalized * chartHeight, 1.5);
        const barY = chartTop + (chartHeight - barHeight);
        const barX = chartLeft + index * slotWidth;
        const isUp = close >= open;
        return (
          <rect
            key={bar.timestamp}
            x={barX}
            y={barY}
            width={barWidth}
            height={barHeight}
            className={`chart-bar ${isUp ? "chart-bar-up" : "chart-bar-down"}`}
          >
            <title>{`${formatTimestamp(bar.timestamp)} | O ${open.toFixed(2)} | C ${close.toFixed(2)}`}</title>
          </rect>
        );
      })}

      <text x={chartLeft} y={viewBoxHeight - 8} className="chart-label">
        {formatChartTime(bars[0].timestamp)}
      </text>
      <text x={chartRight} y={viewBoxHeight - 8} className="chart-label" textAnchor="end">
        {formatChartTime(bars[bars.length - 1].timestamp)}
      </text>
    </svg>
  );
}

function formatChartTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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
