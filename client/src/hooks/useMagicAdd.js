import { useMutation } from "@tanstack/react-query";
import { tasksApi } from "../api";
import { syncNow } from "../offline/sync";

/** "Smart add": the server's AI turns a sentence into a reminder, then this device pulls it in. */
export default function useMagicAdd() {
  const mutation = useMutation({
    mutationFn: async (text) => {
      const created = await tasksApi.magicAdd(text);
      await syncNow({ force: true }); // pulls the new reminder into the local database
      return created;
    },
  });
  return { submit: mutation.mutateAsync, busy: mutation.isPending };
}
