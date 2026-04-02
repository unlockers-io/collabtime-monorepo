import { redirect } from "next/navigation";
import { ViewTransition } from "react";

import { getSession } from "@/lib/auth-server";

import { SettingsClient } from "./client";

const SettingsPage = async () => {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <ViewTransition enter="fade-in" exit="fade-out">
      <SettingsClient
        user={{
          id: session.user.id,
          name: session.user.name ?? "",
          email: session.user.email,
        }}
      />
    </ViewTransition>
  );
};

export default SettingsPage;
