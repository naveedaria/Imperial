import { Tone } from "../types";
import { HistorySummary } from "../shared/format";

export const TONE_COLORS: Record<Tone, string> = {
  up: "#10b981",
  down: "#ef4444",
  flat: "#6b7280",
};

export function summaryToneToTone(
  summary: HistorySummary | null | undefined,
): Tone {
  if (!summary) return "flat";
  if (summary.changeTone === "ticker-change-up") return "up";
  if (summary.changeTone === "ticker-change-down") return "down";
  return "flat";
}

export function formatChartTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
