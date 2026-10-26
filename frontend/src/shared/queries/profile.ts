import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProfileUpdate } from "../api/generated";
import { invalidateWebsite } from "./invalidate";
import { useQuery } from "@tanstack/react-query";
import { profileApi } from "../api/profile";
import { keys } from "./keys";
export const usePublicProfile = () =>
  useQuery({
    queryKey: keys.profile,
    queryFn: ({ signal }) => profileApi.public(signal).then((r) => r.data),
  });
export const useAdminProfile = () =>
  useQuery({
    queryKey: keys.adminProfile,
    queryFn: ({ signal }) => profileApi.admin(signal).then((r) => r.data),
  });

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => profileApi.update(body),
    onSuccess: async (result) => {
      client.setQueryData(keys.adminProfile, result.data);
      await invalidateWebsite(client);
    },
  });
}
