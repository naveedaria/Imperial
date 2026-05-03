import { StrictMode } from "react";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

type HealthResponse = {
  status: string;
  database: string;
};

function App() {
  const [health, setHealth] = useHealth();

  return (
    <main className="shell">
      <section className="card">
        <p className="eyebrow">Imperial Capital Take-Home</p>
        <h1>Stock Watchlist</h1>
        <p className="lede">
          Increment 1 is running when this page can reach the FastAPI backend and the
          backend can reach Postgres.
        </p>

        <div className="status-grid">
          <StatusPill label="Frontend" value="ok" />
          <StatusPill label="Backend" value={health.status} />
          <StatusPill label="Postgres" value={health.database} />
        </div>

        {health.error ? <p className="error">{health.error}</p> : null}
        <button type="button" onClick={setHealth}>
          Recheck services
        </button>
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
