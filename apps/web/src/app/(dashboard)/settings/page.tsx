import { Skeleton } from "@repo/ui/components/skeleton";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/auth-server";

import { SettingsClient } from "./client";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  title: "Settings",
};

const SettingsContent = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <SettingsClient
      key={session.user.name ?? ""}
      user={{
        email: session.user.email,
        id: session.user.id,
        name: session.user.name ?? "",
      }}
    />
  );
};

const SettingsSkeleton = () => (
  <div aria-busy="true" className="flex flex-col gap-14">
    <div className="flex flex-col gap-3">
      <Skeleton className="h-12 w-56 rounded-none sm:h-18 sm:w-80" />
      <Skeleton className="h-6 w-72 rounded-none" />
    </div>

    <div className="flex flex-col gap-5 border-t border-border pt-5 sm:pt-6">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-16 rounded-none" />
        <Skeleton className="h-4 w-40 rounded-none" />
      </div>

      <div className="flex max-w-xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-20 rounded-none" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-12 rounded-none" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-4 w-56 rounded-none" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  </div>
);

const SettingsPage = () => (
  <Suspense fallback={<SettingsSkeleton />}>
    <SettingsContent />
  </Suspense>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default SettingsPage;
