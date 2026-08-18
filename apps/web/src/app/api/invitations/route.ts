import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth-server";
import { getPendingInvitations } from "@/lib/home-data";
import { log, withEvlog } from "@/lib/observability";

export const GET = withEvlog(async () => {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invitations = await getPendingInvitations(session.user.email);

    return NextResponse.json({ invitations });
  } catch (error) {
    log.error({ error, message: "Failed to fetch invitations", route: "/api/invitations" });
    return NextResponse.json({ error: "Failed to fetch invitations" }, { status: 500 });
  }
});
