"use client";

import {
  HydrationBoundary,
  QueryClientProvider,
  type DehydratedState,
} from "@tanstack/react-query";
import { useState } from "react";

import { createQueryClient } from "@/lib/query-client";

type QueryProviderProps = {
  children: React.ReactNode;
  dehydratedState?: DehydratedState;
};

const QueryProvider = ({ children, dehydratedState }: QueryProviderProps) => {
  const [queryClient, _setQueryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
    </QueryClientProvider>
  );
};

export { QueryProvider };
