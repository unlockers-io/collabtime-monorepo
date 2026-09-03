import { Skeleton } from "@repo/ui/components/skeleton";
import { dehydrate } from "@tanstack/react-query";
import { Suspense } from "react";

import { LandingPage } from "@/components/landing";
import { getSession } from "@/lib/auth-server";
import { getMyTeams, getPendingInvitations } from "@/lib/home-data";
import { log } from "@/lib/observability";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { QueryProvider } from "@/providers/query-provider";

import { HomeShell } from "./home-client";
import { HomeLists } from "./home-client/lists";

type HomeDataProps = {
  email: string;
  userId: string;
};

const HomeData = async ({ email, userId }: HomeDataProps) => {
  const queryClient = createQueryClient();
  const [teamsResult, invitationsResult] = await Promise.allSettled([
    getMyTeams(userId),
    getPendingInvitations(email),
  ]);

  if (teamsResult.status === "fulfilled") {
    queryClient.setQueryData(queryKeys.myTeams, teamsResult.value);
  } else {
    log.error({ error: teamsResult.reason, message: "Failed to preload teams", route: "/" });
  }

  if (invitationsResult.status === "fulfilled") {
    queryClient.setQueryData(queryKeys.invitations, invitationsResult.value);
  } else {
    log.error({
      error: invitationsResult.reason,
      message: "Failed to preload invitations",
      route: "/",
    });
  }

  return (
    <QueryProvider dehydratedState={dehydrate(queryClient)}>
      <HomeLists />
    </QueryProvider>
  );
};

const HomeDataSkeleton = () => (
  <div aria-hidden className="flex w-full flex-col gap-3">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-15 w-full" />
    <Skeleton className="h-15 w-full" />
  </div>
);

const HomeContent = async () => {
  const session = await getSession();

  if (!session) {
    return <LandingPage />;
  }

  return (
    <HomeShell>
      <Suspense fallback={<HomeDataSkeleton />}>
        <HomeData email={session.user.email} userId={session.user.id} />
      </Suspense>
    </HomeShell>
  );
};

const HomeSkeleton = () => (
  <div aria-hidden className="flex flex-1 flex-col">
    <div className="flex items-center justify-between px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <Skeleton className="size-9" />
        <Skeleton className="h-6 w-28" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="size-8" />
        <Skeleton className="size-8" />
      </div>
    </div>
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-64 sm:h-12 sm:w-80" />
      <Skeleton className="h-6 w-full max-w-sm" />
      <Skeleton className="h-12 w-full sm:h-14 sm:w-72" />
    </div>
  </div>
);

const Home = () => (
  <Suspense fallback={<HomeSkeleton />}>
    <HomeContent />
  </Suspense>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default Home;
