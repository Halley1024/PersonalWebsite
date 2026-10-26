import { keys } from "./keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateWebsite } from "./invalidate";
import { useQuery } from "@tanstack/react-query";
import {
  taxonomyApi,
  type TaxonomyType,
  type TaxonomyRow,
} from "../api/taxonomy";
import type { Kind } from "../api/content";
export const usePublicTaxonomy = (type: TaxonomyType, kind: Kind) =>
  useQuery({
    queryKey: keys.publicTaxonomy(type, kind),
    queryFn: ({ signal }) =>
      taxonomyApi.public(type, kind, signal).then((r) => r.data),
  });
export const useTaxonomyList = (
  type: TaxonomyType,
  params: { kind?: Kind; page?: number; page_size?: number } = {},
) =>
  useQuery({
    queryKey: keys.adminTaxonomy(type, params),
    queryFn: ({ signal }) => taxonomyApi.list(type, params, signal),
  });
export const useTaxonomyOptions = (type: TaxonomyType, kind: Kind) =>
  useQuery({
    queryKey: keys.taxonomyOptions(type, kind),
    queryFn: async ({ signal }) => {
      const result: TaxonomyRow[] = [];
      let page = 1;
      while (true) {
        const data = await taxonomyApi.list(
          type,
          { kind, page, page_size: 100 },
          signal,
        );
        result.push(...data.data);
        if (page >= data.meta.total_pages) break;
        page++;
      }
      return result;
    },
  });

export function useTaxonomyMutations(type: TaxonomyType) {
  const client = useQueryClient();
  const onSuccess = () => invalidateWebsite(client);
  return {
    create: useMutation({
      mutationFn: (body: Parameters<typeof taxonomyApi.create>[1]) =>
        taxonomyApi.create(type, body),
      onSuccess,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        body,
      }: {
        id: string;
        body: Parameters<typeof taxonomyApi.update>[2];
      }) => taxonomyApi.update(type, id, body),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: ({ id, version }: { id: string; version: number }) =>
        taxonomyApi.remove(type, id, version),
      onSuccess,
    }),
  };
}
