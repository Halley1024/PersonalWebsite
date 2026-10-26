import { ThemeProvider } from "../shared/theme/ThemeProvider";
import { useState, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider } from "../shared/session/SessionProvider";
import { ToastProvider } from "../shared/components/ui/toast/ToastProvider";
import { shouldRetry } from "../shared/api/errors";

export function AppProviders({ children }: PropsWithChildren) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0,
            retry: shouldRetry,
            refetchOnWindowFocus: true,
          },
          mutations: { retry: false },
        },
      }),
  );
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
