import { QueryProvider } from "@/providers/query-provider";

import { TeamSkeleton } from "./team-skeleton";

const Loading = () => (
  <QueryProvider>
    <TeamSkeleton />
  </QueryProvider>
);

export default Loading;
