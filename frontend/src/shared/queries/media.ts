import { keys } from "./keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { mediaApi, type MediaFilters } from "../api/media";
export const useMedia = (
  params: MediaFilters = {},
) =>
  useQuery({
    queryKey: keys.media(params),
    queryFn: ({ signal }) => mediaApi.list(params, signal),
  });

export const useMediaStats = () => useQuery({ queryKey: ["admin", "media", "stats"], queryFn: ({ signal }) => mediaApi.stats(signal).then((result) => result.data) });

export function useMediaMutations() {
  const client = useQueryClient();
  const onSuccess = () =>
    client.invalidateQueries({ queryKey: ["admin", "media"] });
  return {
    upload: useMutation({
      mutationFn: ({ file, alt }: { file: File; alt: string }) =>
        mediaApi.upload(file, alt),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: string) => mediaApi.remove(id), onSuccess }),
  };
}
