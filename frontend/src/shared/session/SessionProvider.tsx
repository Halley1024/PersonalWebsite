import {
  createContext,
  useContext,
  useEffect,
  type PropsWithChildren,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import { setCsrfToken } from "../api/client";
import { shouldRetry } from "../api/errors";
import type { Session, LoginInput } from "../api/generated";
import { keys } from "../queries/keys";
import { clearDrafts } from "./drafts";

type Context = {
  session: Session | undefined;
  loading: boolean;
  error: unknown;
  refresh: () => Promise<unknown>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
};
const SessionContext = createContext<Context | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: keys.session,
    queryFn: ({ signal }) => authApi.session(signal).then((r) => r.data),
    staleTime: 60_000,
    retry: shouldRetry,
  });
  useEffect(() => {
    setCsrfToken(query.data?.authenticated ? query.data.csrf_token : null);
  }, [query.data]);
  useEffect(() => {
    const expired = () => {
      setCsrfToken(null);
      client.setQueryData<Session>(keys.session, { authenticated: false });
      void client
        .cancelQueries({ queryKey: ["admin"] })
        .then(() => client.removeQueries({ queryKey: ["admin"] }));
    };
    window.addEventListener("session:expired", expired);
    return () => window.removeEventListener("session:expired", expired);
  }, [client]);
  // Session checks can also report expiry with HTTP 200 + authenticated=false.
  useEffect(() => {
    if (query.data && !query.data.authenticated) {
      void client
        .cancelQueries({ queryKey: ["admin"] })
        .then(() => client.removeQueries({ queryKey: ["admin"] }));
    }
  }, [client, query.data]);
  const login = async (input: LoginInput) => {
    const { data } = await authApi.login(input);
    setCsrfToken(data.csrf_token);
    client.setQueryData<Session>(keys.session, {
      authenticated: true,
      ...data,
    });
    await client.invalidateQueries({ queryKey: ["admin"] });
  };
  const logout = async () => {
    await authApi.logout();
    setCsrfToken(null);
    clearDrafts();
    await client.cancelQueries({ queryKey: ["admin"] });
    client.removeQueries({ queryKey: ["admin"] });
    client.setQueryData<Session>(keys.session, { authenticated: false });
  };
  return (
    <SessionContext.Provider
      value={{
        session: query.data,
        loading: query.isPending,
        error: query.error,
        refresh: query.refetch,
        login,
        logout,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider 未挂载");
  return value;
}
