import { QueryClient } from "@tanstack/react-query";

// One shared client so logout can wipe cached (private) data.
// Defaults chosen for speed: data stays fresh for a minute (screens that remount do not refetch), switching tabs or
// windows does not trigger a refetch storm, and a failing request is retried once instead of three times (each retry
// of a slow server is another long wait).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false, retry: 1 },
  },
});
