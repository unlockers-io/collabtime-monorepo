import { QueryClient } from "@tanstack/react-query";

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: true,
        staleTime: 60 * 1000,
      },
    },
  });

export { createQueryClient };
