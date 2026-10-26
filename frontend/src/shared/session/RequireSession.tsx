import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "./useSession";
import { QueryState } from "../components/ui/query-state/QueryState";
export function RequireSession() {
  const { session, loading, error, refresh } = useSession();
  const location = useLocation();
  if (loading || error)
    return (
      <QueryState
        loading={loading}
        error={error}
        retry={() => void refresh()}
      />
    );
  if (!session?.authenticated)
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ returnTo: location.pathname + location.search }}
      />
    );
  return <Outlet />;
}
