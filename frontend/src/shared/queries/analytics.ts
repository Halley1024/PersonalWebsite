import { keys } from "./keys";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi, type VisitFilters } from "../api/analytics";
export const useAnalytics = (days: number) =>
  useQuery({
    queryKey: keys.analytics(days),
    queryFn: ({ signal }) => analyticsApi.get(days, signal).then((r) => r.data),
  });
export const useVisits = (filters: VisitFilters) =>
  useQuery({
    queryKey: keys.visits(filters),
    queryFn: ({ signal }) => analyticsApi.visits(filters, signal),
  });
