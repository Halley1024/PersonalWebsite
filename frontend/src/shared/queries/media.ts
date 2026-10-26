import { keys } from "./keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { mediaApi } from "../api/media";
export const useMedia = (
  params: { page?: number; page_size?: number; unused?: boolean } = {},
) =>
  useQuery({
    queryKey: keys.media(params),
    queryFn: ({ signal }) => mediaApi.list(params, signal),
  });

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
    remove: useMutation({ mutationFn: mediaApi.remove, onSuccess }),
  };
}
