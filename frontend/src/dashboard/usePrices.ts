import { useCallback, useEffect, useState } from "react";
import { fetchPriceHistory } from "../api/prices";
import { PriceHistoryResponse } from "../types";

export type UsePricesResult = ReturnType<typeof usePrices>;

/**
 * Manage a price-history cache keyed by ticker.
 *
 * The hook reloads whenever the set of `tickers` changes. Pass a referentially
 * stable array (e.g. memoized via `useMemo`) so we don't re-fetch on every
 * parent render.
 */
export function usePrices(tickers: string[]) {
  const [byTicker, setByTicker] = useState<Record<string, PriceHistoryResponse>>(
    {},
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Set<string>>(new Set());

  const refresh = useCallback(async (toLoad: string[]) => {
    if (toLoad.length === 0) {
      return;
    }
    setLoading((current) => {
      const next = new Set(current);
      for (const ticker of toLoad) {
        next.add(ticker);
      }
      return next;
    });

    await Promise.all(
      toLoad.map(async (ticker) => {
        try {
          const data = await fetchPriceHistory(ticker);
          setByTicker((current) => ({ ...current, [ticker]: data }));
          setErrors((current) => {
            if (!(ticker in current)) {
              return current;
            }
            const { [ticker]: _removed, ...rest } = current;
            return rest;
          });
        } catch (priceError: unknown) {
          const detail =
            priceError instanceof Error
              ? priceError.message
              : "Could not load prices.";
          setErrors((current) => ({ ...current, [ticker]: detail }));
        } finally {
          setLoading((current) => {
            const next = new Set(current);
            next.delete(ticker);
            return next;
          });
        }
      }),
    );
  }, []);

  useEffect(() => {
    if (tickers.length === 0) {
      setByTicker({});
      setErrors({});
      return;
    }

    const tickerSet = new Set(tickers);

    setByTicker((current) => {
      const next: Record<string, PriceHistoryResponse> = {};
      for (const ticker of tickerSet) {
        if (current[ticker]) {
          next[ticker] = current[ticker];
        }
      }
      return next;
    });
    setErrors((current) => {
      const next: Record<string, string> = {};
      for (const ticker of tickerSet) {
        if (current[ticker]) {
          next[ticker] = current[ticker];
        }
      }
      return next;
    });

    refresh(Array.from(tickerSet));
  }, [tickers, refresh]);

  const refreshAll = useCallback(() => {
    if (tickers.length === 0) {
      return;
    }
    refresh(tickers);
  }, [tickers, refresh]);

  const refreshOne = useCallback(
    (ticker: string) => refresh([ticker]),
    [refresh],
  );

  return { byTicker, errors, loading, refreshAll, refreshOne };
}
