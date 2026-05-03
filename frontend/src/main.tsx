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

  if (user) {
    return (
      <main className="shell shell-app">
        <section className="card card-app">
          <header className="app-header">
            <div className="app-brand">
              <span className="brand-mark" aria-hidden="true">IC</span>
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
          Manage your private watchlist of up to ten tickers and view the last seven
          days of 5-minute price history for any ticker on it.
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
          onRecheck={setHealth}
        />
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

function Dashboard({ user }: { user: User }) {
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
      <aside className="watchlist-panel">
        <div className="watchlist-header">
          <div>
            <h3>Watchlist</h3>
            <p className="muted">{watchlist.length}/10 tickers</p>
          </div>
          <button
            className="ghost ghost-small"
            type="button"
            onClick={refreshAllPrices}
            disabled={watchlist.length === 0 || loadingTickers.size > 0}
          >
            {loadingTickers.size > 0 ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <form className="ticker-form" onSubmit={handleAddTicker}>
          <input
            aria-label="Ticker symbol"
            maxLength={10}
            onChange={(event) => setTicker(event.target.value.toUpperCase())}
            placeholder="Add ticker (e.g. AAPL)"
            required
            type="text"
            value={ticker}
          />
          <button type="submit" disabled={isSubmitting || watchlist.length >= 10}>
            {isSubmitting ? "Adding..." : "Add"}
          </button>
        </form>

        {message ? <p className="success">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}

        {isLoading ? (
          <p className="muted">Loading watchlist...</p>
        ) : watchlist.length === 0 ? (
          <p className="empty-state">No tickers yet. Add one above to start your watchlist.</p>
        ) : (
          <ul className="ticker-list">
            {watchlist.map((item) => {
              const priceData = pricesByTicker[item.ticker];
              const summary = summarizeHistory(priceData);
              const tone = summaryToneToTone(summary);
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
                    <span className="ticker-row-top">
                      <strong className="ticker-symbol">{item.ticker}</strong>
                      {summary ? (
                        <span className="ticker-price">{formatPrice(summary.latestClose)}</span>
                      ) : isLoadingPrice ? (
                        <span className="muted ticker-loading">Loading...</span>
                      ) : null}
                    </span>
                    <span className="ticker-row-bottom">
                      <span className="ticker-spark">
                        {priceData ? <Sparkline points={priceData.points} tone={tone} /> : null}
                      </span>
                      {summary ? (
                        <span className={`ticker-change ${summary.changeTone}`}>
                          {summary.changeText}
                        </span>
                      ) : priceError ? (
                        <span className="muted">No data</span>
                      ) : priceData?.warning ? (
                        <span className="muted">{priceData.warning}</span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    className="ghost ghost-icon"
                    type="button"
                    onClick={() => handleRemoveTicker(item.ticker)}
                    aria-label={`Remove ${item.ticker}`}
                    title={`Remove ${item.ticker}`}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      <section className="dashboard-main">
        {selectedTicker ? (
          <PricePanel
            ticker={selectedTicker}
            history={pricesByTicker[selectedTicker] ?? null}
            error={priceErrors[selectedTicker] ?? null}
            isLoading={loadingTickers.has(selectedTicker)}
            onRefresh={() => loadPricesFor([selectedTicker])}
            onClose={() => setSelectedTicker(null)}
          />
        ) : (
          <div className="dashboard-empty">
            <p className="eyebrow">Welcome</p>
            <h2>Select a ticker to view its chart</h2>
            <p className="muted">
              {watchlist.length === 0
                ? "Add a ticker on the left to start your watchlist."
                : "Pick a symbol from the watchlist to see the last 7 days at 5-minute granularity."}
            </p>
          </div>
        )}
      </section>
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
  const tone = summaryToneToTone(summary);
  const latestPoint = history?.points[history.points.length - 1] ?? null;
  const latestOpen = history?.points[0] ?? null;

  return (
    <section className={`price-panel tone-${tone}`}>
      <header className="price-hero">
        <div className="price-hero-meta">
          <p className="eyebrow">Price history</p>
          <h2 className="price-hero-symbol">{ticker}</h2>
          {history ? (
            <p className="muted">
              {history.period} - {history.interval} bars - {history.points.length} points
            </p>
          ) : null}
        </div>

        <div className="price-hero-numbers">
          <div className="price-hero-price">{formatPrice(summary?.latestClose)}</div>
          {summary ? (
            <div className={`price-hero-change ${summary.changeTone}`}>
              {summary.changeAbs != null
                ? `${summary.changeAbs >= 0 ? "+" : ""}${summary.changeAbs.toFixed(2)}`
                : "-"}
              {summary.changePct != null
                ? ` (${summary.changePct >= 0 ? "+" : ""}${summary.changePct.toFixed(2)}%)`
                : ""}
            </div>
          ) : null}
          <p className="muted price-hero-time">
            {summary?.latestTimestamp ? `As of ${formatTimestamp(summary.latestTimestamp)}` : "Awaiting data"}
          </p>
        </div>

        <div className="price-hero-actions">
          <button className="secondary" type="button" onClick={onRefresh} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="ghost" type="button" onClick={onClose}>
            Close
          </button>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}
      {history?.warning ? <p className="warning">{history.warning}</p> : null}

      {isLoading && !history ? (
        <p className="muted">Loading price history...</p>
      ) : history && history.points.length > 0 ? (
        <>
          <PriceLineChart points={history.points} tone={tone} />

          <div className="price-stats">
            <StatTile label="Open" value={formatPrice(latestOpen?.open)} />
            <StatTile label="High" value={formatPrice(latestPoint?.high)} />
            <StatTile label="Low" value={formatPrice(latestPoint?.low)} />
            <StatTile label="Close" value={formatPrice(latestPoint?.close)} />
            <StatTile label="Volume" value={latestPoint?.volume?.toLocaleString() ?? "-"} />
          </div>

          <details className="price-table-details">
            <summary>Recent prints</summary>
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
          </details>
        </>
      ) : !error ? (
        <p className="empty-state">No price points to display.</p>
      ) : null}
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

type Tone = "up" | "down" | "flat";

const TONE_COLORS: Record<Tone, string> = {
  up: "#10b981",
  down: "#ef4444",
  flat: "#6b7280",
};

function summaryToneToTone(summary: HistorySummary | null | undefined): Tone {
  if (!summary) return "flat";
  if (summary.changeTone === "ticker-change-up") return "up";
  if (summary.changeTone === "ticker-change-down") return "down";
  return "flat";
}

function PriceLineChart({ points, tone }: { points: PricePoint[]; tone: Tone }) {
  const usable = points.filter((point) => point.close != null);
  if (usable.length < 2) {
    return null;
  }

  const closes = usable.map((point) => point.close as number);
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const padding = (maxClose - minClose) * 0.06 || maxClose * 0.01 || 1;
  const yMin = minClose - padding;
  const yMax = maxClose + padding;
  const yRange = yMax - yMin || 1;

  const viewBoxWidth = 720;
  const viewBoxHeight = 260;
  const chartLeft = 12;
  const chartRight = viewBoxWidth - 60;
  const chartTop = 18;
  const chartBottom = viewBoxHeight - 30;
  const chartWidth = chartRight - chartLeft;
  const chartHeight = chartBottom - chartTop;

  const stepX = chartWidth / (usable.length - 1);
  const color = TONE_COLORS[tone];
  const gradientId = `chart-gradient-${tone}`;

  const pointToCoords = (point: PricePoint, index: number) => {
    const x = chartLeft + index * stepX;
    const y = chartTop + (1 - ((point.close as number) - yMin) / yRange) * chartHeight;
    return { x, y };
  };

  const linePath = usable
    .map((point, index) => {
      const { x, y } = pointToCoords(point, index);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const areaPath = `${linePath} L ${chartRight.toFixed(2)} ${chartBottom.toFixed(2)} L ${chartLeft.toFixed(2)} ${chartBottom.toFixed(2)} Z`;

  const last = usable[usable.length - 1];
  const lastCoords = pointToCoords(last, usable.length - 1);

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label={`Line chart of close prices (${tone})`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.32" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1={chartLeft} x2={chartRight} y1={chartTop} y2={chartTop} className="chart-grid" />
      <line
        x1={chartLeft}
        x2={chartRight}
        y1={chartTop + chartHeight / 2}
        y2={chartTop + chartHeight / 2}
        className="chart-grid"
      />
      <line x1={chartLeft} x2={chartRight} y1={chartBottom} y2={chartBottom} className="chart-grid" />

      <text x={chartRight + 8} y={chartTop + 4} className="chart-label">
        {maxClose.toFixed(2)}
      </text>
      <text x={chartRight + 8} y={chartTop + chartHeight / 2 + 4} className="chart-label">
        {((maxClose + minClose) / 2).toFixed(2)}
      </text>
      <text x={chartRight + 8} y={chartBottom + 4} className="chart-label">
        {minClose.toFixed(2)}
      </text>

      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={linePath}
        className="chart-line"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      <circle cx={lastCoords.x} cy={lastCoords.y} r={4} fill={color} stroke="white" strokeWidth="2" />

      <text x={chartLeft} y={viewBoxHeight - 8} className="chart-label">
        {formatChartTime(usable[0].timestamp)}
      </text>
      <text x={chartRight} y={viewBoxHeight - 8} className="chart-label" textAnchor="end">
        {formatChartTime(usable[usable.length - 1].timestamp)}
      </text>
    </svg>
  );
}

function Sparkline({ points, tone }: { points: PricePoint[]; tone: Tone }) {
  const usable = points.filter((point) => point.close != null);
  if (usable.length < 2) {
    return null;
  }

  const targetSamples = 28;
  const step = Math.max(1, Math.floor(usable.length / targetSamples));
  const samples: PricePoint[] = [];
  for (let i = 0; i < usable.length; i += step) {
    samples.push(usable[i]);
  }
  if (samples[samples.length - 1] !== usable[usable.length - 1]) {
    samples.push(usable[usable.length - 1]);
  }

  const closes = samples.map((point) => point.close as number);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  const viewBoxWidth = 96;
  const viewBoxHeight = 28;
  const padY = 2;
  const usableHeight = viewBoxHeight - padY * 2;
  const stepX = viewBoxWidth / (samples.length - 1);

  const linePath = samples
    .map((point, index) => {
      const x = index * stepX;
      const y = padY + (1 - ((point.close as number) - min) / range) * usableHeight;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-hidden="true"
    >
      <path
        d={linePath}
        fill="none"
        stroke={TONE_COLORS[tone]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
