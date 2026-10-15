import { QueryClient } from "@tanstack/react-query";

// One shared client so logout can wipe cached (private) data.
export const queryClient = new QueryClient();
