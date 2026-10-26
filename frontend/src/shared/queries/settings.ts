import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SettingsUpdate } from "../api/generated";
import { invalidateWebsite } from "./invalidate";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "../api/settings";
import { keys } from "./keys";
export const usePublicSettings = () =>
  useQuery({
    queryKey: keys.settings,
    queryFn: ({ signal }) => settingsApi.public(signal).then((r) => r.data),
  });
export const useAdminSettings = () =>
  useQuery({
    queryKey: keys.adminSettings,
    queryFn: ({ signal }) => settingsApi.admin(signal).then((r) => r.data),
  });

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: SettingsUpdate) => settingsApi.update(body),
    onSuccess: async (result) => {
      client.setQueryData(keys.adminSettings, result.data);
      await invalidateWebsite(client);
    },
  });
}
