import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { updatesApi } from "../api";
import { UPDATES_READ_EVENT, getSeenUpdatesCount, setSeenUpdatesCount } from "../utils/auth";
import { queryKeys } from "./queryKeys";

export const updateIdOf = (update) => update?.id || update?._id;

export function useUpdates({ enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.updates, queryFn: updatesApi.list, enabled, staleTime: 60 * 1000 });
}

/** Publishing refreshes the list; the caller decides what to tell the user. */
export function useCreateUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updatesApi.create,
    onSuccess: async () => {
      const list = await queryClient.fetchQuery({ queryKey: queryKeys.updates, queryFn: updatesApi.list, staleTime: 0 });
      setSeenUpdatesCount(list.length);
    },
  });
}

export function useDeleteUpdate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update) => updatesApi.remove(updateIdOf(update)),
    onSuccess: (_data, update) => {
      const id = updateIdOf(update);
      const next = (queryClient.getQueryData(queryKeys.updates) || []).filter((u) => updateIdOf(u) !== id);
      queryClient.setQueryData(queryKeys.updates, next);
      setSeenUpdatesCount(next.length);
    },
  });
}

/** How many product updates the user has not opened yet (for the badge on the profile page). */
export function useUnreadUpdates() {
  const { data } = useUpdates();
  const [seen, setSeen] = useState(getSeenUpdatesCount);

  useEffect(() => {
    const onRead = () => setSeen(getSeenUpdatesCount());
    window.addEventListener(UPDATES_READ_EVENT, onRead);
    return () => window.removeEventListener(UPDATES_READ_EVENT, onRead);
  }, []);

  return Math.max(0, (data?.length || 0) - seen);
}
