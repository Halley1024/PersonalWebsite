import { keys } from "./keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RuleUpdate } from "../api/generated";
import { useQuery } from "@tanstack/react-query";
import { accessApi, type RuleFilters } from "../api/access";
export const useRules = (filters: RuleFilters = {}) =>
  useQuery({
    queryKey: keys.rules(filters),
    queryFn: ({ signal }) => accessApi.list(filters, signal),
  });
export const useRegions = () =>
  useQuery({
    queryKey: keys.regions,
    queryFn: ({ signal }) => accessApi.regions(signal).then((r) => r.data),
  });

export function useRuleMutations() {
  const client = useQueryClient();
  const onSuccess = () =>
    client.invalidateQueries({ queryKey: ["admin", "access"] });
  return {
    create: useMutation({ mutationFn: accessApi.create, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, body }: { id: string; body: RuleUpdate }) =>
        accessApi.update(id, body),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: ({ id, version }: { id: string; version: number }) =>
        accessApi.remove(id, version),
      onSuccess,
    }),
  };
}
