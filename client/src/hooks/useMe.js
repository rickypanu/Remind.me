import { useQuery } from "@tanstack/react-query";
import { userApi } from "../api";
import { getMeta, setMeta } from "../offline/db";
import { getTokenUserId } from "../utils/auth";
import { queryClient } from "../utils/queryClient";
import { queryKeys } from "./queryKeys";

const isUnauthorized = (error) => error?.response?.status === 401;

/** The profile's id (the API returns `id`; older cached copies may carry `_id`). */
export const userIdOf = (profile) => profile?.id || profile?._id || null;

/**
 * Decide what the profile is, without making the screen wait for a slow server.
 *
 *  1. A copy saved on this device that belongs to the signed-in user is returned AT ONCE, and the server is asked
 *     for a fresh one in the background (`onRefreshed` receives it). Before this, the dashboard waited for the
 *     network first: against a sleeping free-tier server that was up to 16 seconds (8 s timeout, retried once) of
 *     skeleton cards before a single saved reminder appeared.
 *  2. With no usable saved copy (first sign-in on this device), the network answer is awaited.
 *  3. If that fails there is nothing to show but an error (a copy belonging to someone else is never a fallback).
 *
 * A saved copy of a DIFFERENT account is never used in step 1 (the id inside the access token must match).
 * A 401 is never swallowed: the API client has already signed the user out.
 */
export async function resolveProfile({ getSaved, save, fetchProfile, isOnline, tokenUserId, onRefreshed }) {
  const saved = await getSaved().catch(() => null);
  const mine = saved && (!tokenUserId || userIdOf(saved) === tokenUserId);

  const refresh = async () => {
    const profile = await fetchProfile();
    await save(profile).catch(() => {});
    return profile;
  };

  if (mine) {
    if (isOnline()) refresh().then((profile) => onRefreshed?.(profile)).catch(() => {});
    return saved;
  }

  if (isOnline()) {
    try {
      return await refresh();
    } catch (error) {
      if (isUnauthorized(error)) throw error;
      // no answer or a server error: fall through to whatever is saved
    }
  }
  if (mine) return saved; // (a stranger's copy was handled above and is never used)
  throw new Error("No saved profile yet");
}

/**
 * The signed-in user's profile (see `resolveProfile`). Works offline from the saved copy, so the greeting and the
 * reminders keep working with no connection.
 */
export default function useMe({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.me,
    enabled,
    networkMode: "always", // run even with no connection: the saved copy answers
    staleTime: 5 * 60 * 1000,
    retry: (count, error) => !isUnauthorized(error) && count < 1,
    queryFn: () =>
      resolveProfile({
        getSaved: () => getMeta("userInfo"),
        save: (profile) => setMeta("userInfo", profile),
        fetchProfile: () => userApi.me({ timeout: 8000 }),
        isOnline: () => navigator.onLine,
        tokenUserId: getTokenUserId(),
        onRefreshed: (profile) => queryClient.setQueryData(queryKeys.me, profile),
      }),
  });
}
