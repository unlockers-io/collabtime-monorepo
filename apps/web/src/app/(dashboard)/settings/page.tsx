import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth-server";

import { SettingsClient } from "./client";

const SettingsPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return (
    <SettingsClient
      user={{
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email,
      }}
    />
  );
};

export default SettingsPage;
