import { PriceLineChart } from "../charts/PriceLineChart";
import { summaryToneToTone } from "../charts/chartUtils";
import {
  formatPrice,
  formatTimestamp,
  summarizeHistory,
} from "../shared/format";
import { PriceHistoryResponse } from "../types";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function PricePanel({
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
  const earliestPoint = history?.points[0] ?? null;

  return (
    <section className={`price-panel tone-${tone}`}>
      <header className="price-hero">
        <div className="price-hero-meta">
          <p className="eyebrow">Price history</p>
          <h2 className="price-hero-symbol">{ticker}</h2>
          {history ? (
            <p className="muted">
              {history.period} - {history.interval} bars -{" "}
              {history.points.length} points
            </p>
          ) : null}
        </div>

        <div className="price-hero-numbers">
          <div className="price-hero-price">
            {formatPrice(summary?.latestClose)}
          </div>
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
            {summary?.latestTimestamp
              ? `As of ${formatTimestamp(summary.latestTimestamp)}`
              : "Awaiting data"}
          </p>
        </div>

        <div className="price-hero-actions">
          <button
            className="secondary"
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
          >
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
            <StatTile label="Open" value={formatPrice(earliestPoint?.open)} />
            <StatTile label="High" value={formatPrice(latestPoint?.high)} />
            <StatTile label="Low" value={formatPrice(latestPoint?.low)} />
            <StatTile label="Close" value={formatPrice(latestPoint?.close)} />
            <StatTile
              label="Volume"
              value={latestPoint?.volume?.toLocaleString() ?? "-"}
            />
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
              <p className="muted">
                Showing most recent {recent.length} of {history.points.length}{" "}
                points.
              </p>
            ) : null}
          </details>
        </>
      ) : !error ? (
        <p className="empty-state">No price points to display.</p>
      ) : null}
    </section>
  );
}
