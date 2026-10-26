import { keys } from "./keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateContent, ChangeStatus } from "../api/generated";
import { invalidateWebsite } from "./invalidate";
import { useQuery } from "@tanstack/react-query";
import {
  contentApi,
  type Kind,
  type PublicFilters,
  type AdminFilters,
} from "../api/content";
export const usePublicContents = (kind: Kind, filters: PublicFilters = {}) =>
  useQuery({
    queryKey: keys.publicContents(kind, filters),
    queryFn: ({ signal }) => contentApi.list(kind, filters, signal),
  });
export const usePublicDetail = (kind: Kind, slug: string) =>
  useQuery({
    queryKey: keys.publicContent(kind, slug),
    queryFn: ({ signal }) =>
      contentApi.detail(kind, slug, signal).then((r) => r.data),
    enabled: !!slug,
  });
export const useAdminContents = (filters: AdminFilters = {}) =>
  useQuery({
    queryKey: keys.adminContents(filters),
    queryFn: ({ signal }) => contentApi.adminList(filters, signal),
  });
export const useAdminDetail = (id?: string) =>
  useQuery({
    queryKey: keys.adminContent(id),
    queryFn: ({ signal }) =>
      contentApi.adminDetail(id!, signal).then((r) => r.data),
    enabled: !!id,
  });

export function useContentMutations() {
  const client = useQueryClient();
  const onSuccess = () => invalidateWebsite(client);
  return {
    create: useMutation({ mutationFn: contentApi.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: UpdateContent }) =>
        contentApi.update(id, body),
      onSuccess,
    }),
    status: useMutation({
      mutationFn: ({ id, body }: { id: string; body: ChangeStatus }) =>
        contentApi.status(id, body),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: ({ id, version }: { id: string; version: number }) =>
        contentApi.remove(id, version),
      onSuccess,
    }),
  };
}
