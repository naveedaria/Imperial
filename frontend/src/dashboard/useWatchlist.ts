import { useCallback, useEffect, useState } from "react";
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
} from "../api/watchlist";
import { WatchlistItem } from "../types";

export type UseWatchlistResult = ReturnType<typeof useWatchlist>;

export function useWatchlist(userId: string) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setIsLoading(true);
    setError(null);
    listWatchlist(userId)
      .then(setItems)
      .catch((loadError: unknown) => {
        const errorMessage =
          loadError instanceof Error
            ? loadError.message
            : "Could not load watchlist.";
        setError(errorMessage);
      })
      .finally(() => setIsLoading(false));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const add = useCallback(
    async (ticker: string) => {
      setIsSubmitting(true);
      setError(null);
      setMessage(null);
      try {
        const item = await addToWatchlist(userId, ticker);
        setItems((current) => [...current, item]);
        setMessage(`Added ${item.ticker}.`);
        return item;
      } catch (addError: unknown) {
        const errorMessage =
          addError instanceof Error
            ? addError.message
            : "Could not add ticker.";
        setError(errorMessage);
        throw addError;
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId],
  );

  const remove = useCallback(
    async (ticker: string) => {
      setError(null);
      setMessage(null);
      try {
        await removeFromWatchlist(userId, ticker);
        setItems((current) => current.filter((item) => item.ticker !== ticker));
        setMessage(`Removed ${ticker}.`);
      } catch (removeError: unknown) {
        const errorMessage =
          removeError instanceof Error
            ? removeError.message
            : "Could not remove ticker.";
        setError(errorMessage);
        throw removeError;
      }
    },
    [userId],
  );

  return {
    items,
    isLoading,
    isSubmitting,
    message,
    error,
    reload,
    add,
    remove,
  };
}
