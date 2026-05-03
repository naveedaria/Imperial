import { useMemo, useState } from "react";
import { User } from "../types";
import { PricePanel } from "./PricePanel";
import { WatchlistPanel } from "./WatchlistPanel";
import { usePrices } from "./usePrices";
import { useWatchlist } from "./useWatchlist";

export function Dashboard({ user }: { user: User }) {
  const watchlist = useWatchlist(user.id);
  const tickers = useMemo(
    () => watchlist.items.map((item) => item.ticker),
    [watchlist.items],
  );
  const prices = usePrices(tickers);
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  async function handleRemove(ticker: string) {
    await watchlist.remove(ticker);
    setSelectedTicker((current) => (current === ticker ? null : current));
  }

  return (
    <div className="dashboard">
      <WatchlistPanel
        watchlist={watchlist}
        prices={prices}
        selectedTicker={selectedTicker}
        onSelect={setSelectedTicker}
        onRemove={handleRemove}
      />

      <section className="dashboard-main">
        {selectedTicker ? (
          <PricePanel
            ticker={selectedTicker}
            history={prices.byTicker[selectedTicker] ?? null}
            error={prices.errors[selectedTicker] ?? null}
            isLoading={prices.loading.has(selectedTicker)}
            onRefresh={() => prices.refreshOne(selectedTicker)}
            onClose={() => setSelectedTicker(null)}
          />
        ) : (
          <div className="dashboard-empty">
            <p className="eyebrow">Welcome</p>
            <h2>Select a ticker to view its chart</h2>
            <p className="muted">
              {watchlist.items.length === 0
                ? "Add a ticker on the left to start your watchlist."
                : "Pick a symbol from the watchlist to see the last 7 days at 5-minute granularity."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
