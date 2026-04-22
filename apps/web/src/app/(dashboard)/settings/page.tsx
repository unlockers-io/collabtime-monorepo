import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth-server";

import { SettingsClient } from "./client";

const SettingsPage = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <SettingsClient
      user={{
        email: session.user.email,
        id: session.user.id,
        name: session.user.name ?? "",
      }}
    />
  );
};

export default SettingsPage;
