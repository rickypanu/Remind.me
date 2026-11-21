import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { socialApi } from "../api";
import { queryKeys } from "./queryKeys";

/** The invite code, friends (with streaks), the buddy and the invite reward progress. */
export function useSocial({ enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.social, queryFn: socialApi.summary, enabled, staleTime: 30 * 1000, retry: false });
}

function useSocialMutation(fn) {
  const client = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.social }) });
}

export const useJoinFriend = () => useSocialMutation(socialApi.join);
export const useUnfriend = () => useSocialMutation(socialApi.unfriend);
export const useSetBuddy = () => useSocialMutation(socialApi.setBuddy);
export const useRemindFriend = () => useSocialMutation(({ id, ...payload }) => socialApi.remind(id, payload));
