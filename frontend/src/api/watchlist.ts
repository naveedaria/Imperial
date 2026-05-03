import { WatchlistItem } from "../types";
import { apiBaseUrl, parseApiResponse } from "./client";

function authHeaders(userId: string): Record<string, string> {
  return { "X-User-Id": userId };
}

export async function listWatchlist(userId: string): Promise<WatchlistItem[]> {
  const response = await fetch(`${apiBaseUrl}/watchlist`, {
    headers: authHeaders(userId),
  });
  return parseApiResponse<WatchlistItem[]>(response);
}

export async function addToWatchlist(
  userId: string,
  ticker: string,
): Promise<WatchlistItem> {
  const response = await fetch(`${apiBaseUrl}/watchlist`, {
    method: "POST",
    headers: { ...authHeaders(userId), "Content-Type": "application/json" },
    body: JSON.stringify({ ticker }),
  });
  return parseApiResponse<WatchlistItem>(response);
}

export async function removeFromWatchlist(
  userId: string,
  ticker: string,
): Promise<void> {
  const response = await fetch(
    `${apiBaseUrl}/watchlist/${encodeURIComponent(ticker)}`,
    { method: "DELETE", headers: authHeaders(userId) },
  );
  await parseApiResponse<void>(response);
}
