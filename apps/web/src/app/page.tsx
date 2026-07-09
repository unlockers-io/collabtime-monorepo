import { Skeleton } from "@repo/ui/components/skeleton";
import { Suspense } from "react";

import { getSession } from "@/lib/auth-server";

import { HomeClient } from "./home-client";

const HomeContent = async () => {
  const session = await getSession();

  return <HomeClient isAuthenticated={Boolean(session)} />;
};

const HomeSkeleton = () => (
  <div aria-hidden className="flex flex-1 flex-col">
    <div className="h-16 border-b border-border" />
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-10 px-4 py-8 sm:gap-12 sm:px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-2 sm:gap-3">
          <Skeleton className="h-9 w-48 sm:h-12 sm:w-56" />
          <Skeleton className="h-12 w-72" />
        </div>
      </div>
      <Skeleton className="h-12 w-full rounded-xl sm:h-14 sm:w-72" />
    </main>
  </div>
);

// Suspense streams the static hero shell while session-bound content renders.
const Home = () => (
  <Suspense fallback={<HomeSkeleton />}>
    <HomeContent />
  </Suspense>
);

export default Home;
