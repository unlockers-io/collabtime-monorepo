import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";

import { SettingsClient } from "./client";

const SettingsPage = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    // Keyed by name so the client draft resets when the canonical name
    // changes (e.g. after router.refresh() picks up an update from another tab).
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

export default SettingsPage;
