import { QueryClient } from "@tanstack/react-query";

const queryClientOptions = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
};

// On the server, create a new QueryClient per request to avoid shared state
// On the client, reuse a singleton to preserve cache across navigations
let browserQueryClient: QueryClient | undefined;

export function makeQueryClient(): QueryClient {
  return new QueryClient(queryClientOptions);
}

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") {
    // Server: always create a new client
    return makeQueryClient();
  }

  // Browser: create once and reuse
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }

  return browserQueryClient;
}

// Named export for direct use in client-side contexts
export const queryClient = getQueryClient();
