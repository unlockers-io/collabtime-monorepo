import { Skeleton } from "@repo/ui/components/skeleton";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { getSession } from "@/lib/auth-server";

import { SettingsClient } from "./client";

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
  <div aria-busy="true" className="mx-auto max-w-3xl px-4 py-8">
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-7 w-28 rounded-none" />
        <Skeleton className="h-4 w-36 rounded-none" />
      </div>

      <div className="flex flex-col gap-6 border-y border-border p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-16 rounded-none" />
            <Skeleton className="h-3.5 w-40 rounded-none" />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-10 rounded-none" />
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-10 rounded-none" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-3 w-36 rounded-none" />
          </div>
        </div>
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
