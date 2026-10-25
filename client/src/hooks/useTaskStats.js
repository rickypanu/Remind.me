import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "../api";
import useSyncStatus from "../offline/useSyncStatus";
import { queryKeys } from "./queryKeys";

/**
 * `{ streak, best_streak, completed_today }` from the server. Refreshed whenever an upload of local changes
 * finishes (a completion made offline only reaches the server then). Failing quietly is fine: the card then
 * simply leaves the streak out.
 */
export default function useTaskStats({ enabled = true } = {}) {
  const client = useQueryClient();
  const sync = useSyncStatus();
  const syncedAt = sync.lastResult?.type === "success" ? sync.lastResult.at : 0;

  useEffect(() => {
    if (syncedAt) client.invalidateQueries({ queryKey: queryKeys.taskStats });
  }, [syncedAt, client]);

  return useQuery({
    queryKey: queryKeys.taskStats,
    enabled,
    queryFn: tasksApi.stats,
    staleTime: 60 * 1000,
    retry: false, // an older server without /stats (404) or a sleeping one must not slow the dashboard down
  });
}
