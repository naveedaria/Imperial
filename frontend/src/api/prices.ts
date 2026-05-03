import { PriceHistoryResponse } from "../types";
import { apiBaseUrl, parseApiResponse } from "./client";

export async function fetchPriceHistory(
  ticker: string,
): Promise<PriceHistoryResponse> {
  const response = await fetch(
    `${apiBaseUrl}/prices/${encodeURIComponent(ticker)}`,
  );
  return parseApiResponse<PriceHistoryResponse>(response);
}
