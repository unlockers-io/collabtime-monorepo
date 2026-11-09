import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SkeletonSuspense } from "skullet/react";

import { getSession } from "@/lib/auth-server";
import { withRedirect } from "@/lib/redirect-validation";

import { SettingsClient } from "./client";

/** @public Next.js app-router reads metadata via the module loader */
export const metadata: Metadata = {
  title: "Settings",
};

const SAMPLE_USER = { email: "you@example.com", id: "sample", name: "Your name" };

const SettingsContent = async () => {
  const session = await getSession();

  if (!session) {
    redirect(withRedirect("/login", "/settings"));
  }

  return (
    <SettingsClient
      key={session.user.name ?? ""}
      user={{ email: session.user.email, name: session.user.name ?? "" }}
    />
  );
};

const SettingsPage = () => (
  <SkeletonSuspense label="Loading settings" skeleton={<SettingsClient user={SAMPLE_USER} />}>
    <SettingsContent />
  </SkeletonSuspense>
);

/** @public Next.js app-router reads the instant segment config via the module loader */
export const instant = true;

export default SettingsPage;
