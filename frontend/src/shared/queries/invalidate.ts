import type { QueryClient } from "@tanstack/react-query";
export function invalidateWebsite(client: QueryClient) {
  return client.invalidateQueries({
    predicate: (q) => q.queryKey[0] === "public" || q.queryKey[0] === "admin",
  });
}
