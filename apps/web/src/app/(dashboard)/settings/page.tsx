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
    // Keyed by name so the client draft resets when the canonical name changes.
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

// Suspense boundary above session-bound content for cacheComponents.
const SettingsSkeleton = () => (
  <div aria-hidden className="mx-auto max-w-3xl px-4 py-8">
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <div className="h-8 w-32 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-muted" />
    </div>
  </div>
);

const SettingsPage = () => (
  <Suspense fallback={<SettingsSkeleton />}>
    <SettingsContent />
  </Suspense>
);

export default SettingsPage;
