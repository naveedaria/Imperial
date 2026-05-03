import { PriceHistoryResponse } from "../types";

export type ChangeTone =
  | "ticker-change-up"
  | "ticker-change-down"
  | "ticker-change-flat";

export type HistorySummary = {
  latestClose: number | null;
  latestTimestamp: string | null;
  changeAbs: number | null;
  changePct: number | null;
  changeText: string;
  changeTone: ChangeTone;
};

export function summarizeHistory(
  history: PriceHistoryResponse | null | undefined,
): HistorySummary | null {
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
  const changePct =
    earliestClose !== 0 ? (changeAbs / earliestClose) * 100 : null;

  const tone: ChangeTone =
    changeAbs > 0
      ? "ticker-change-up"
      : changeAbs < 0
        ? "ticker-change-down"
        : "ticker-change-flat";
  const sign = changeAbs > 0 ? "+" : changeAbs < 0 ? "-" : "";
  const absChange = Math.abs(changeAbs).toFixed(2);
  const pctText =
    changePct != null ? `${sign}${Math.abs(changePct).toFixed(2)}%` : "-";

  return {
    latestClose,
    latestTimestamp: latest.timestamp,
    changeAbs,
    changePct,
    changeText: `${sign}${absChange} (${pctText})`,
    changeTone: tone,
  };
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null) {
    return "-";
  }
  return value.toFixed(2);
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}
