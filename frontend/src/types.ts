export type User = {
  id: string;
  email: string;
};

export type WatchlistItem = {
  id: string;
  ticker: string;
  created_at: string;
};

export type PricePoint = {
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
};

export type PriceHistoryResponse = {
  ticker: string;
  interval: string;
  period: string;
  points: PricePoint[];
  warning: string | null;
};

export type HealthResponse = {
  status: string;
  database: string;
};

export type Tone = "up" | "down" | "flat";
