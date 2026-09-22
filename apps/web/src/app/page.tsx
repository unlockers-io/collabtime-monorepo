import { dehydrate } from "@tanstack/react-query";
import type { Metadata } from "next";
import { Suspense } from "react";

import { LandingPage } from "@/components/landing";
import { getSession } from "@/lib/auth-server";
import { APP_DESCRIPTION_SHORT, APP_NAME, APP_TITLE } from "@/lib/constants";
import { getMyTeams, getPendingInvitations } from "@/lib/home-data";
import { log } from "@/lib/observability";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { QueryProvider } from "@/providers/query-provider";

import { HomeShell } from "./home-client";
import { HomeLists } from "./home-client/lists";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: {
    description: APP_DESCRIPTION_SHORT,
    locale: "en_US",
    siteName: APP_NAME,
    title: APP_TITLE,
    type: "website",
    url: "/",
  },
};

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

const HomeContent = async () => {
  const session = await getSession();

  if (!session) {
    return <LandingPage />;
  }

  return (
    <HomeShell>
      <Suspense fallback={null}>
        <HomeData email={session.user.email} userId={session.user.id} />
      </Suspense>
    </HomeShell>
  );
};

const Home = () => (
  <Suspense fallback={null}>
    <HomeContent />
  </Suspense>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default Home;
