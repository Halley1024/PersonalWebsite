import { keys } from "./keys";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
export const useDashboard = () =>
  useQuery({
    queryKey: keys.dashboard,
    queryFn: ({ signal }) => dashboardApi.get(signal).then((r) => r.data),
  });
