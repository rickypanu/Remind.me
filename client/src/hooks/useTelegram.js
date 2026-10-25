import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { telegramApi } from "../api";
import { queryKeys } from "./queryKeys";

/** `pollMs` > 0 keeps asking while the user finishes the flow in the Telegram app. */
export function useTelegramStatus({ enabled = true, pollMs = false } = {}) {
  return useQuery({
    queryKey: queryKeys.telegramStatus,
    queryFn: telegramApi.status,
    enabled,
    refetchInterval: pollMs,
    retry: false,
  });
}

export function useTelegramLink() {
  return useMutation({ mutationFn: telegramApi.createLink });
}

export function useTelegramDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: telegramApi.disconnect,
    onSuccess: () => queryClient.setQueryData(queryKeys.telegramStatus, { connected: false }),
  });
}
