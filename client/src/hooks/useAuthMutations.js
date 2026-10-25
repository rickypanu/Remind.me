import { useMutation } from "@tanstack/react-query";
import { authApi } from "../api";
import { setSession } from "../utils/auth";

/** Logs in and stores the token pair. Rejects with the original axios error so pages can show the server's message. */
export function useLogin() {
  return useMutation({
    mutationFn: async (credentials) => {
      const tokens = await authApi.login(credentials);
      if (!tokens?.access_token || !tokens?.refresh_token) throw new Error("No token returned");
      setSession(tokens);
      return tokens;
    },
  });
}

export const useSignup = () => useMutation({ mutationFn: authApi.signup });
export const useForgotPassword = () => useMutation({ mutationFn: authApi.forgotPassword });
export const useResetPassword = () => useMutation({ mutationFn: authApi.resetPassword });
