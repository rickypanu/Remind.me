import { useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "../api";
import { setMeta } from "../offline/db";
import { queryKeys } from "./queryKeys";

/** Merge a change into the cached profile (and the offline copy) so every screen shows it at once. */
function useProfilePatcher() {
  const queryClient = useQueryClient();
  return (patch) => {
    queryClient.setQueryData(queryKeys.me, (previous) => {
      if (!previous) return previous;
      const next = { ...previous, ...patch };
      setMeta("userInfo", next).catch(() => {});
      return next;
    });
  };
}

export function useRenameUser() {
  const patch = useProfilePatcher();
  return useMutation({
    mutationFn: (username) => userApi.rename(username),
    onSuccess: (_data, username) => patch({ username }),
  });
}

export function useSetAvatarUrl() {
  const patch = useProfilePatcher();
  return useMutation({
    mutationFn: (avatarUrl) => userApi.setAvatarUrl(avatarUrl),
    onSuccess: (_data, avatarUrl) => patch({ avatar_url: avatarUrl }),
  });
}

export function useUploadAvatar() {
  const patch = useProfilePatcher();
  return useMutation({
    mutationFn: (file) => userApi.uploadAvatar(file),
    onSuccess: (data) => {
      if (data?.avatar_url) patch({ avatar_url: data.avatar_url });
    },
  });
}

export function useDeleteAccount() {
  return useMutation({ mutationFn: () => userApi.remove() });
}
