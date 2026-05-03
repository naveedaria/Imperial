import { FormEvent, useState } from "react";
import { Sparkline } from "../charts/Sparkline";
import { summaryToneToTone } from "../charts/chartUtils";
import { formatPrice, summarizeHistory } from "../shared/format";
import { UsePricesResult } from "./usePrices";
import { UseWatchlistResult } from "./useWatchlist";

export function WatchlistPanel({
  watchlist,
  prices,
  selectedTicker,
  onSelect,
  onRemove,
}: {
  watchlist: UseWatchlistResult;
  prices: UsePricesResult;
  selectedTicker: string | null;
  onSelect: (ticker: string) => void;
  onRemove: (ticker: string) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState("");

  const isAtLimit = watchlist.items.length >= 10;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAtLimit) {
      return;
    }
    try {
      await watchlist.add(draft);
      setDraft("");
    } catch {
      // error is surfaced via watchlist.error
    }
  }

  return (
    <aside className="watchlist-panel">
      <div className="watchlist-header">
        <div>
          <h3>Watchlist</h3>
          <p className="muted">{watchlist.items.length}/10 tickers</p>
        </div>
        <button
          className="ghost ghost-small"
          type="button"
          onClick={prices.refreshAll}
          disabled={watchlist.items.length === 0 || prices.loading.size > 0}
        >
          {prices.loading.size > 0 ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <form className="ticker-form" onSubmit={handleSubmit}>
        <input
          aria-label="Ticker symbol"
          disabled={isAtLimit}
          maxLength={10}
          onChange={(event) => setDraft(event.target.value.toUpperCase())}
          placeholder={isAtLimit ? "Limit reached" : "Add ticker (e.g. AAPL)"}
          required={!isAtLimit}
          type="text"
          value={draft}
        />
        <button type="submit" disabled={watchlist.isSubmitting || isAtLimit}>
          {watchlist.isSubmitting ? "Adding..." : "Add"}
        </button>
      </form>

      {isAtLimit ? (
        <p className="warning limit-notice">
          You've reached the 10-ticker limit. Please remove a ticker to add a
          new one to track.
        </p>
      ) : null}

      {watchlist.message ? (
        <p className="success">{watchlist.message}</p>
      ) : null}
      {watchlist.error ? <p className="error">{watchlist.error}</p> : null}

      {watchlist.isLoading ? (
        <p className="muted">Loading watchlist...</p>
      ) : watchlist.items.length === 0 ? (
        <p className="empty-state">
          No tickers yet. Add one above to start your watchlist.
        </p>
      ) : (
        <ul className="ticker-list">
          {watchlist.items.map((item) => {
            const priceData = prices.byTicker[item.ticker];
            const summary = summarizeHistory(priceData);
            const tone = summaryToneToTone(summary);
            const isLoadingPrice = prices.loading.has(item.ticker);
            const priceError = prices.errors[item.ticker];
            return (
              <li
                key={item.id}
                className={
                  selectedTicker === item.ticker ? "selected" : undefined
                }
              >
                <button
                  className="ticker-select"
                  type="button"
                  onClick={() => onSelect(item.ticker)}
                  aria-pressed={selectedTicker === item.ticker}
                >
                  <span className="ticker-row-top">
                    <strong className="ticker-symbol">{item.ticker}</strong>
                    {summary ? (
                      <span className="ticker-price">
                        {formatPrice(summary.latestClose)}
                      </span>
                    ) : isLoadingPrice ? (
                      <span className="muted ticker-loading">Loading...</span>
                    ) : null}
                  </span>
                  <span className="ticker-row-bottom">
                    <span className="ticker-spark">
                      {priceData ? (
                        <Sparkline points={priceData.points} tone={tone} />
                      ) : null}
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
                  onClick={() => onRemove(item.ticker)}
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
  );
}
