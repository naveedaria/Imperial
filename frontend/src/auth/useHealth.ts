import { useCallback, useEffect, useState } from "react";
import { fetchHealth } from "../api/health";
import { HealthResponse } from "../types";

type HealthState = HealthResponse & { error?: string };

export function useHealth() {
  const [health, setHealth] = useState<HealthState>({
    status: "checking",
    database: "checking",
  });

  const refresh = useCallback(() => {
    setHealth({ status: "checking", database: "checking" });
    fetchHealth()
      .then(setHealth)
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        setHealth({ status: "error", database: "unknown", error: message });
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { health, refresh };
}
